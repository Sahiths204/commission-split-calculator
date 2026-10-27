import express, { Request, Response } from 'express';
import cors from 'cors';
import { Decimal } from 'decimal.js';

import { getPayeeById, insertPayee, listPayees } from '../db/payeeRepository.js';
import {
  createTransactionWithPayouts,
  getPayoutsForTransaction,
  listAllTransactionsWithPayouts,
} from '../db/transactionRepository.js';
import type { Payee, PayoutLine, Transaction } from '../calculator/types.js';

function serializePayee(payee: Payee) {
  return {
    id: payee.id,
    name: payee.name,
    commissionRate: payee.commissionRate.toString(),
    managerId: payee.managerId,
  };
}

function serializePayoutLine(line: PayoutLine) {
  return {
    transactionId: line.transactionId,
    payeeId: line.payeeId,
    type: line.type,
    amount: line.amount.toString(),
  };
}

function serializeTransaction(transaction: Transaction) {
  return {
    id: transaction.id,
    payeeId: transaction.payeeId,
    amount: transaction.amount.toString(),
    occurredAt: transaction.occurredAt.toISOString(),
  };
}

export const app = express();

// Allowed origin is configurable via env (e.g. the frontend's dev-server URL or deployed
// origin); defaults to the frontend's local dev port for a working setup with no extra config.
app.use(cors({ origin: process.env.CORS_ORIGIN ?? 'http://localhost:5173' }));
app.use(express.json());

app.post('/payees', async (req: Request, res: Response) => {
  const { name, commissionRate, managerId } = req.body ?? {};

  if (typeof name !== 'string' || name.trim().length === 0) {
    res.status(400).json({ error: 'name is required and must be a non-empty string' });
    return;
  }

  if (commissionRate === undefined || commissionRate === null) {
    res.status(400).json({ error: 'commissionRate is required' });
    return;
  }

  if (managerId !== null && typeof managerId !== 'string') {
    res.status(400).json({ error: 'managerId must be a string or null' });
    return;
  }

  let parsedRate: Decimal;
  try {
    parsedRate = new Decimal(commissionRate);
  } catch {
    res.status(400).json({ error: 'commissionRate must be a valid decimal string' });
    return;
  }

  if (managerId !== null) {
    if (!/^\d+$/.test(managerId)) {
      res.status(400).json({ error: 'managerId does not reference an existing payee' });
      return;
    }

    const manager = await getPayeeById(managerId);
    if (!manager) {
      res.status(400).json({ error: 'managerId does not reference an existing payee' });
      return;
    }

    if (manager.commissionRate.lte(parsedRate)) {
      res.status(400).json({
        error: `manager's commission rate (${manager.commissionRate.toString()}) must be greater than the payee's own commission rate (${parsedRate.toString()})`,
      });
      return;
    }
  }

  const payee = await insertPayee({ name, commissionRate: parsedRate, managerId });
  res.status(201).json(serializePayee(payee));
});

app.get('/payees', async (_req: Request, res: Response) => {
  const payees = await listPayees();
  res.status(200).json(payees.map(serializePayee));
});

app.post('/transactions', async (req: Request, res: Response) => {
  const { payeeId, amount, occurredAt } = req.body ?? {};

  try {
    const payouts = await createTransactionWithPayouts({
      payeeId,
      amount: new Decimal(amount),
      occurredAt: new Date(occurredAt),
    });

    res.status(201).json({ payouts: payouts.map(serializePayoutLine) });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(400).json({ error: message });
  }
});

app.get('/transactions', async (_req: Request, res: Response) => {
  const { transactions, payoutLines } = await listAllTransactionsWithPayouts();
  res.status(200).json({
    transactions: transactions.map(serializeTransaction),
    payoutLines: payoutLines.map(serializePayoutLine),
  });
});

app.get('/transactions/:id/payouts', async (req: Request, res: Response) => {
  const transactionId = String(req.params.id);
  const payouts = await getPayoutsForTransaction(transactionId);
  res.status(200).json({ payouts: payouts.map(serializePayoutLine) });
});
