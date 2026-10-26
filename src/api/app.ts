import express, { Request, Response } from 'express';
import cors from 'cors';
import { Decimal } from 'decimal.js';

import { insertPayee, listPayees } from '../db/payeeRepository.js';
import { createTransactionWithPayouts, getPayoutsForTransaction } from '../db/transactionRepository.js';
import type { Payee, PayoutLine } from '../calculator/types.js';

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

app.get('/transactions/:id/payouts', async (req: Request, res: Response) => {
  const transactionId = String(req.params.id);
  const payouts = await getPayoutsForTransaction(transactionId);
  res.status(200).json({ payouts: payouts.map(serializePayoutLine) });
});
