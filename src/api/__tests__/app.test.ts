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
      .send({ name: 'Jordan Lake', commissionRate: '0.30', managerId: null });

    expect(res.status).toBe(201);
    expect(res.body.name).toBe('Jordan Lake');
    expect(typeof res.body.commissionRate).toBe('string');
    expect(res.body.commissionRate).toBe('0.3');
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

    // rep rate 0.20 against 500.00 -> 100.00 base; override spread (0.30 - 0.20) against 500.00 -> 50.00.
    expect(new Decimal(base!.amount).equals(new Decimal('100.00'))).toBe(true);
    expect(new Decimal(override!.amount).equals(new Decimal('50.00'))).toBe(true);

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
    expect(new Decimal(refundOverride!.amount).equals(new Decimal('-50.00'))).toBe(true);
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

  it("POST /payees with a manager whose rate is not strictly greater than the payee's returns 400", async () => {
    const equalRateManagerRes = await request(app)
      .post('/payees')
      .send({ name: 'Pat Flat', commissionRate: '0.15', managerId: null });
    expect(equalRateManagerRes.status).toBe(201);
    const equalRateManagerId = equalRateManagerRes.body.id;

    const res = await request(app)
      .post('/payees')
      .send({ name: 'Casey Low', commissionRate: '0.15', managerId: equalRateManagerId });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe(
      "manager's commission rate (0.15) must be greater than the payee's own commission rate (0.15)",
    );
  });

  it('POST /payees with a malformed (non-numeric) managerId returns 400, not a raw 500', async () => {
    const res = await request(app)
      .post('/payees')
      .send({ name: 'Jamie Garbled', commissionRate: '0.10', managerId: '__not-an-id__' });

    expect(res.status).toBe(400);
    expect(typeof res.body.error).toBe('string');
    expect(res.body.error).toBe('managerId does not reference an existing payee');
  });

  it("POST /payees with a manager whose rate is strictly greater than the payee's succeeds", async () => {
    const seniorRes = await request(app)
      .post('/payees')
      .send({ name: 'Taylor High', commissionRate: '0.30', managerId: null });
    expect(seniorRes.status).toBe(201);
    const seniorId = seniorRes.body.id;

    const res = await request(app)
      .post('/payees')
      .send({ name: 'Morgan Junior', commissionRate: '0.12', managerId: seniorId });

    expect(res.status).toBe(201);
    expect(res.body.managerId).toBe(seniorId);
    expect(res.body.commissionRate).toBe('0.12');
  });

  it('GET /transactions returns 200 with all persisted transactions and their payout lines, ordered sensibly', async () => {
    // A third transaction, created here, so this test also has something created in its own flow
    // rather than relying solely on the earlier tests' state.
    const thirdRes = await request(app)
      .post('/transactions')
      .send({ payeeId: repId, amount: '200.00', occurredAt: '2026-01-25T00:00:00.000Z' });
    expect(thirdRes.status).toBe(201);
    const thirdTransactionId = (thirdRes.body.payouts as PayoutLineJson[])[0].transactionId;

    const res = await request(app).get('/transactions');

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.transactions)).toBe(true);
    expect(Array.isArray(res.body.payoutLines)).toBe(true);

    const transactions = res.body.transactions as Array<{
      id: string;
      payeeId: string;
      amount: string;
      occurredAt: string;
    }>;
    const payoutLines = res.body.payoutLines as PayoutLineJson[];

    // All transactions created so far in this run (base+override, refund, and the one just above)
    // must be present -- exact order isn't asserted since several share close timestamps.
    const transactionIds = transactions.map((t) => t.id);
    expect(transactionIds).toContain(transactionId);
    expect(transactionIds).toContain(thirdTransactionId);
    expect(transactions.length).toBeGreaterThanOrEqual(3);

    // The transaction/payout data recorded by the earlier base+override test must reflect real
    // persisted state through this new endpoint, not just freshly-created-in-this-test data.
    const earlierTransaction = transactions.find((t) => t.id === transactionId);
    expect(earlierTransaction).toBeDefined();
    expect(earlierTransaction?.payeeId).toBe(repId);
    expect(new Decimal(earlierTransaction!.amount).equals(new Decimal('500.00'))).toBe(true);

    const earlierLines = payoutLines.filter((p) => p.transactionId === transactionId);
    expect(earlierLines).toHaveLength(2);
    const earlierBase = earlierLines.find((p) => p.type === 'base');
    const earlierOverride = earlierLines.find((p) => p.type === 'override');
    expect(earlierBase?.payeeId).toBe(repId);
    expect(earlierOverride?.payeeId).toBe(managerId);
    expect(new Decimal(earlierBase!.amount).equals(new Decimal('100.00'))).toBe(true);
    expect(new Decimal(earlierOverride!.amount).equals(new Decimal('50.00'))).toBe(true);

    // Sensible ordering: occurredAt should be non-decreasing across the returned transactions.
    for (let i = 1; i < transactions.length; i += 1) {
      expect(
        new Date(transactions[i].occurredAt).getTime() >=
          new Date(transactions[i - 1].occurredAt).getTime(),
      ).toBe(true);
    }
  });
});
