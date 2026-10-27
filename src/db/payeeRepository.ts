import { Decimal } from 'decimal.js';

import { pool } from './pool.js';
import { Payee } from '../calculator/types.js';

interface PayeeRow {
  id: string;
  name: string;
  commission_rate: string;
  manager_id: string | null;
}

function mapRowToPayee(row: PayeeRow): Payee {
  return {
    id: row.id,
    name: row.name,
    commissionRate: new Decimal(row.commission_rate),
    managerId: row.manager_id,
  };
}

export async function insertPayee(payee: {
  name: string;
  commissionRate: Decimal;
  managerId: string | null;
}): Promise<Payee> {
  const result = await pool.query<PayeeRow>(
    `INSERT INTO payees (name, commission_rate, manager_id)
     VALUES ($1, $2, $3)
     RETURNING id, name, commission_rate, manager_id`,
    [payee.name, payee.commissionRate.toString(), payee.managerId],
  );

  return mapRowToPayee(result.rows[0]);
}

export async function getPayeeById(id: string): Promise<Payee | null> {
  const result = await pool.query<PayeeRow>(
    'SELECT id, name, commission_rate, manager_id FROM payees WHERE id = $1',
    [id],
  );

  return result.rows[0] ? mapRowToPayee(result.rows[0]) : null;
}

export async function listPayees(): Promise<Payee[]> {
  const result = await pool.query<PayeeRow>(
    'SELECT id, name, commission_rate, manager_id FROM payees',
  );

  return result.rows.map(mapRowToPayee);
}
