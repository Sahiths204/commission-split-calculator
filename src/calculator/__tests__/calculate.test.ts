import { describe, it, expect } from 'vitest';
import { Decimal } from 'decimal.js';
import { calculateBasePayout, calculateTransactionPayouts, roundToCents } from '../calculate.js';
import type { Payee, Transaction } from '../types.js';

describe('calculateBasePayout', () => {
  it('computes amount * rate as an exact decimal, without IEEE754 float rounding error', () => {
    // 100.10 * 0.15 = 15.015 exactly.
    // Under native IEEE754 floats, 100.10 * 0.15 === 15.014999999999999 (fails strict equality),
    // so this test only passes when the implementation uses exact decimal math.
    const amount = new Decimal('100.10');
    const rate = new Decimal('0.15');

    const result = calculateBasePayout(amount, rate);

    expect(result.equals(new Decimal('15.015'))).toBe(true);
  });
});

describe('calculateTransactionPayouts', () => {
  const manager: Payee = {
    id: 'payee-manager-1',
    name: 'Jordan Lake',
    commissionRate: new Decimal('0.05'),
    managerId: null,
  };

  const rep: Payee = {
    id: 'payee-rep-1',
    name: 'Riley Shaw',
    commissionRate: new Decimal('0.20'),
    managerId: manager.id,
  };

  const soloRep: Payee = {
    id: 'payee-solo-1',
    name: 'Casey Monroe',
    commissionRate: new Decimal('0.18'),
    managerId: null,
  };

  const payees: Payee[] = [manager, rep, soloRep];

  it('produces a base line for the payee and an override line for the manager, using the spread between the manager\'s rate and the payee\'s rate against the transaction amount', () => {
    const transaction: Transaction = {
      id: 'txn-1001',
      payeeId: rep.id,
      amount: new Decimal('500.00'),
      occurredAt: new Date('2026-01-15T00:00:00.000Z'),
    };

    const result = calculateTransactionPayouts(transaction, payees);

    expect(result).toHaveLength(2);

    const basePayout = result.find((line) => line.type === 'base');
    const overridePayout = result.find((line) => line.type === 'override');

    expect(basePayout).toBeDefined();
    expect(basePayout?.transactionId).toBe(transaction.id);
    expect(basePayout?.payeeId).toBe(rep.id);
    expect(basePayout?.amount.equals(transaction.amount.times(rep.commissionRate))).toBe(true);
    expect(basePayout?.amount.equals(new Decimal('100.00'))).toBe(true);

    expect(overridePayout).toBeDefined();
    expect(overridePayout?.transactionId).toBe(transaction.id);
    expect(overridePayout?.payeeId).toBe(manager.id);
    expect(
      overridePayout?.amount.equals(transaction.amount.times(manager.commissionRate.minus(rep.commissionRate))),
    ).toBe(true);
    expect(overridePayout?.amount.equals(new Decimal('-75.00'))).toBe(true);
  });

  it('reverses both the base and override payouts exactly when a refund/chargeback produces a negative-amount transaction', () => {
    const originalTransaction: Transaction = {
      id: 'txn-1001',
      payeeId: rep.id,
      amount: new Decimal('500.00'),
      occurredAt: new Date('2026-01-15T00:00:00.000Z'),
    };

    const refundTransaction: Transaction = {
      id: 'txn-1001-refund',
      payeeId: rep.id,
      amount: new Decimal('-500.00'),
      occurredAt: new Date('2026-01-20T00:00:00.000Z'),
    };

    const originalPayouts = calculateTransactionPayouts(originalTransaction, payees);
    const refundPayouts = calculateTransactionPayouts(refundTransaction, payees);

    expect(refundPayouts).toHaveLength(2);

    const originalBase = originalPayouts.find((line) => line.type === 'base');
    const originalOverride = originalPayouts.find((line) => line.type === 'override');
    const refundBase = refundPayouts.find((line) => line.type === 'base');
    const refundOverride = refundPayouts.find((line) => line.type === 'override');

    expect(originalBase).toBeDefined();
    expect(originalOverride).toBeDefined();
    expect(refundBase).toBeDefined();
    expect(refundOverride).toBeDefined();

    // The refund's payout lines must be the exact negation of the original positive-case payouts,
    // not merely "some negative number" — proving the reversal is precise, not just signed.
    expect(refundBase?.amount.equals(originalBase!.amount.negated())).toBe(true);
    expect(refundOverride?.amount.equals(originalOverride!.amount.negated())).toBe(true);

    expect(refundBase?.amount.equals(new Decimal('-100.00'))).toBe(true);
    expect(refundOverride?.amount.equals(new Decimal('75.00'))).toBe(true);

    // The base payout always flips sign with the transaction amount. The override's sign depends
    // on the spread between manager and payee rates (negative here, since this fixture's manager
    // rate is below the payee's) — what must hold, and is asserted above, is that it is the exact
    // negation of the original override, not any particular sign.
    expect(refundBase?.amount.lessThan(0)).toBe(true);
  });

  it('returns only a base payout line when the payee has no manager', () => {
    const transaction: Transaction = {
      id: 'txn-2002',
      payeeId: soloRep.id,
      amount: new Decimal('300.00'),
      occurredAt: new Date('2026-02-01T00:00:00.000Z'),
    };

    const result = calculateTransactionPayouts(transaction, payees);

    expect(result).toHaveLength(1);
    expect(result[0].type).toBe('base');
    expect(result[0].payeeId).toBe(soloRep.id);
    expect(result[0].amount.equals(transaction.amount.times(soloRep.commissionRate))).toBe(true);
    expect(result[0].amount.equals(new Decimal('54.00'))).toBe(true);
  });

  it('walks the full chain: every level above the seller gets the spread against the level directly below it', () => {
    const sahith: Payee = {
      id: 'payee-sahith-1',
      name: 'Sahith',
      commissionRate: new Decimal('1.60'),
      managerId: null,
    };

    const varun: Payee = {
      id: 'payee-varun-1',
      name: 'Varun',
      commissionRate: new Decimal('1.35'),
      managerId: sahith.id,
    };

    const deepak: Payee = {
      id: 'payee-deepak-1',
      name: 'Deepak',
      commissionRate: new Decimal('1.20'),
      managerId: varun.id,
    };

    const chainPayees: Payee[] = [sahith, varun, deepak];

    const transaction: Transaction = {
      id: 'txn-3003',
      payeeId: deepak.id,
      amount: new Decimal('5000.00'),
      occurredAt: new Date('2026-03-01T00:00:00.000Z'),
    };

    const result = calculateTransactionPayouts(transaction, chainPayees);

    // Three payout lines, not two: the chain is walked all the way up, not capped at one level.
    expect(result).toHaveLength(3);

    const basePayout = result.find((line) => line.payeeId === deepak.id);
    const varunOverride = result.find((line) => line.payeeId === varun.id);
    const sahithOverride = result.find((line) => line.payeeId === sahith.id);

    expect(basePayout).toBeDefined();
    expect(basePayout?.type).toBe('base');
    expect(basePayout?.amount.equals(new Decimal('6000.00'))).toBe(true);

    expect(varunOverride).toBeDefined();
    expect(varunOverride?.type).toBe('override');
    expect(varunOverride?.amount.equals(new Decimal('750.00'))).toBe(true);

    expect(sahithOverride).toBeDefined();
    expect(sahithOverride?.type).toBe('override');
    expect(sahithOverride?.amount.equals(new Decimal('1250.00'))).toBe(true);

    // Proves it's the spread (1.60 - 1.35 = 0.25), not sahith's full rate (1.60), that was applied.
    expect(sahithOverride?.amount.equals(transaction.amount.times(sahith.commissionRate))).toBe(false);
  });
});

describe('calculateTransactionPayouts error paths', () => {
  it('throws when the transaction references a payeeId not present in the payee list', () => {
    const knownPayee: Payee = {
      id: 'payee-known-1',
      name: 'Taylor Finch',
      commissionRate: new Decimal('0.10'),
      managerId: null,
    };

    const transaction: Transaction = {
      id: 'txn-4004',
      payeeId: 'payee-unknown-404',
      amount: new Decimal('150.00'),
      occurredAt: new Date('2026-04-01T00:00:00.000Z'),
    };

    expect(() => calculateTransactionPayouts(transaction, [knownPayee])).toThrow(/payee-unknown-404/i);
  });

  it('throws when a payee\'s managerId references a manager not present in the payee list', () => {
    const orphanedPayee: Payee = {
      id: 'payee-orphan-1',
      name: 'Jamie Voss',
      commissionRate: new Decimal('0.12'),
      managerId: 'payee-missing-manager-1',
    };

    const transaction: Transaction = {
      id: 'txn-5005',
      payeeId: orphanedPayee.id,
      amount: new Decimal('200.00'),
      occurredAt: new Date('2026-05-01T00:00:00.000Z'),
    };

    expect(() => calculateTransactionPayouts(transaction, [orphanedPayee])).toThrow(/payee-missing-manager-1/i);
  });
});

describe('roundToCents', () => {
  it('rounds a value needing rounding up to 2 decimal places under ROUND_HALF_UP', () => {
    const result = roundToCents(new Decimal('12.345'));

    expect(result.equals(new Decimal('12.35'))).toBe(true);
  });

  it('leaves a value already at 2 decimal places unchanged', () => {
    const result = roundToCents(new Decimal('10.00'));

    expect(result.equals(new Decimal('10.00'))).toBe(true);
  });

  it('rounds a negative value away from zero under ROUND_HALF_UP', () => {
    const result = roundToCents(new Decimal('-12.345'));

    expect(result.equals(new Decimal('-12.35'))).toBe(true);
  });
});
