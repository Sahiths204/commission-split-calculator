import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { Decimal } from 'decimal.js';

import { app } from '../app.js';
import { pool } from '../../db/pool.js';

// These tests exercise app.ts -> repositories -> a real Postgres database (no DB mocking).
// DATABASE_URL is provided via vitest.config.ts's `test.env` so that src/db/pool.ts (which
// throws at import time if DATABASE_URL is unset) has it available before any top-level
// `import` in this file is evaluated.

interface PayoutLineJson {
  transactionId: string;
  payeeId: string;
  type: 'base' | 'override';
  amount: string;
}

describe('app (integration against real Postgres)', () => {
  beforeAll(async () => {
    // Clean slate so this suite doesn't interfere with other runs or leftover manual-test data.
    await pool.query('DELETE FROM payouts');
    await pool.query('DELETE FROM transactions');
    await pool.query('DELETE FROM payees');
  });

  afterAll(async () => {
    await pool.end();
  });

  let managerId: string;
  let repId: string;
  let transactionId: string;
  let originalPayouts: PayoutLineJson[];

  it('POST /payees creates a payee and returns 201 with a string commissionRate', async () => {
    const res = await request(app)
      .post('/payees')
      .send({ name: 'Jordan Lake', commissionRate: '0.05', managerId: null });

    expect(res.status).toBe(201);
    expect(res.body.name).toBe('Jordan Lake');
    expect(typeof res.body.commissionRate).toBe('string');
    expect(res.body.commissionRate).toBe('0.05');
    expect(res.body.managerId).toBeNull();
    expect(typeof res.body.id).toBe('string');

    managerId = res.body.id;
  });

  it('POST /payees creates a payee reporting to the manager created above', async () => {
    const res = await request(app)
      .post('/payees')
      .send({ name: 'Riley Shaw', commissionRate: '0.20', managerId });

    expect(res.status).toBe(201);
    expect(res.body.name).toBe('Riley Shaw');
    expect(res.body.commissionRate).toBe('0.2');
    expect(res.body.managerId).toBe(managerId);

    repId = res.body.id;
  });

  it('GET /payees returns the created payees', async () => {
    const res = await request(app).get('/payees');

    expect(res.status).toBe(200);
    const ids = (res.body as Array<{ id: string }>).map((p) => p.id);
    expect(ids).toContain(managerId);
    expect(ids).toContain(repId);
  });

  it('POST /transactions for a payee with a manager returns 201 with exactly 2 payout lines (base + override)', async () => {
    const res = await request(app)
      .post('/transactions')
      .send({ payeeId: repId, amount: '500.00', occurredAt: '2026-01-15T00:00:00.000Z' });

    expect(res.status).toBe(201);
    expect(res.body.payouts).toHaveLength(2);

    const payouts = res.body.payouts as PayoutLineJson[];
    const base = payouts.find((p) => p.type === 'base');
    const override = payouts.find((p) => p.type === 'override');

    expect(base).toBeDefined();
    expect(override).toBeDefined();
    expect(base?.payeeId).toBe(repId);
    expect(override?.payeeId).toBe(managerId);

    // rep rate 0.20 against 500.00 -> 100.00 base; manager rate 0.05 against 500.00 -> 25.00 override.
    expect(new Decimal(base!.amount).equals(new Decimal('100.00'))).toBe(true);
    expect(new Decimal(override!.amount).equals(new Decimal('25.00'))).toBe(true);

    transactionId = base!.transactionId;
    originalPayouts = payouts;
  });

  it('a refund (negative amount) transaction for the same payee returns payouts that are the exact negation of the original', async () => {
    const res = await request(app)
      .post('/transactions')
      .send({ payeeId: repId, amount: '-500.00', occurredAt: '2026-01-20T00:00:00.000Z' });

    expect(res.status).toBe(201);
    expect(res.body.payouts).toHaveLength(2);

    const payouts = res.body.payouts as PayoutLineJson[];
    const refundBase = payouts.find((p) => p.type === 'base');
    const refundOverride = payouts.find((p) => p.type === 'override');
    const originalBase = originalPayouts.find((p) => p.type === 'base')!;
    const originalOverride = originalPayouts.find((p) => p.type === 'override')!;

    expect(
      new Decimal(refundBase!.amount).equals(new Decimal(originalBase.amount).negated()),
    ).toBe(true);
    expect(
      new Decimal(refundOverride!.amount).equals(new Decimal(originalOverride.amount).negated()),
    ).toBe(true);

    expect(new Decimal(refundBase!.amount).equals(new Decimal('-100.00'))).toBe(true);
    expect(new Decimal(refundOverride!.amount).equals(new Decimal('-25.00'))).toBe(true);
  });

  it('GET /transactions/:id/payouts returns the same payout lines that were returned by the creating POST', async () => {
    const res = await request(app).get(`/transactions/${transactionId}/payouts`);

    expect(res.status).toBe(200);

    const byType = (lines: PayoutLineJson[]) =>
      [...lines].sort((a, b) => a.type.localeCompare(b.type));

    expect(byType(res.body.payouts as PayoutLineJson[])).toEqual(byType(originalPayouts));
  });

  it('POST /transactions with an unknown payeeId returns 400 with an error field', async () => {
    const res = await request(app)
      .post('/transactions')
      .send({ payeeId: '999999999', amount: '100.00', occurredAt: '2026-01-01T00:00:00.000Z' });

    expect(res.status).toBe(400);
    expect(typeof res.body.error).toBe('string');
    expect(res.body.error.length).toBeGreaterThan(0);
  });

  it('POST /payees with a missing name returns 400 with an error field', async () => {
    const res = await request(app)
      .post('/payees')
      .send({ commissionRate: '0.10', managerId: null });

    expect(res.status).toBe(400);
    expect(typeof res.body.error).toBe('string');
    expect(res.body.error.length).toBeGreaterThan(0);
  });
});
