import { Decimal } from 'decimal.js';
import { pool } from './pool.js';
import { calculateTransactionPayouts } from '../calculator/calculate.js';
import type { Payee, Transaction, PayoutLine } from '../calculator/types.js';

interface PayeeRow {
  id: string;
  name: string;
  commission_rate: string;
  manager_id: string | null;
}

interface TransactionRow {
  id: string;
  payee_id: string;
  amount: string;
  occurred_at: Date;
}

interface PayoutRow {
  id: string;
  transaction_id: string;
  payee_id: string;
  type: 'base' | 'override';
  amount: string;
}

function mapPayeeRow(row: PayeeRow): Payee {
  return {
    id: row.id,
    name: row.name,
    commissionRate: new Decimal(row.commission_rate),
    managerId: row.manager_id,
  };
}

function mapTransactionRow(row: TransactionRow): Transaction {
  return {
    id: row.id,
    payeeId: row.payee_id,
    amount: new Decimal(row.amount),
    occurredAt: row.occurred_at,
  };
}

function mapPayoutRow(row: PayoutRow): PayoutLine {
  return {
    transactionId: row.transaction_id,
    payeeId: row.payee_id,
    type: row.type,
    amount: new Decimal(row.amount),
  };
}

export async function createTransactionWithPayouts(input: {
  payeeId: string;
  amount: Decimal;
  occurredAt: Date;
}): Promise<PayoutLine[]> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const payeesResult = await client.query<PayeeRow>('SELECT * FROM payees');
    const payees = payeesResult.rows.map(mapPayeeRow);

    const transactionResult = await client.query<TransactionRow>(
      'INSERT INTO transactions (payee_id, amount, occurred_at) VALUES ($1, $2, $3) RETURNING *',
      [input.payeeId, input.amount.toString(), input.occurredAt],
    );
    const transaction = mapTransactionRow(transactionResult.rows[0]);

    const payoutLines = calculateTransactionPayouts(transaction, payees);

    for (const line of payoutLines) {
      await client.query(
        'INSERT INTO payouts (transaction_id, payee_id, type, amount) VALUES ($1, $2, $3, $4)',
        [line.transactionId, line.payeeId, line.type, line.amount.toString()],
      );
    }

    await client.query('COMMIT');
    return payoutLines;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function getPayoutsForTransaction(transactionId: string): Promise<PayoutLine[]> {
  const result = await pool.query<PayoutRow>(
    'SELECT * FROM payouts WHERE transaction_id = $1',
    [transactionId],
  );
  return result.rows.map(mapPayoutRow);
}

export async function listAllTransactionsWithPayouts(): Promise<{
  transactions: Transaction[];
  payoutLines: PayoutLine[];
}> {
  const transactionsResult = await pool.query<TransactionRow>(
    'SELECT * FROM transactions ORDER BY occurred_at ASC, id ASC',
  );
  const payoutsResult = await pool.query<PayoutRow>(
    'SELECT * FROM payouts ORDER BY transaction_id ASC, type ASC',
  );

  return {
    transactions: transactionsResult.rows.map(mapTransactionRow),
    payoutLines: payoutsResult.rows.map(mapPayoutRow),
  };
}
