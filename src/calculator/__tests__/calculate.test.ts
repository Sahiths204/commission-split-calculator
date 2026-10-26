import { describe, it, expect } from 'vitest';
import { Decimal } from 'decimal.js';
import { calculateBasePayout, calculateTransactionPayouts } from '../calculate.js';
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

  it('produces a base line for the payee and an override line for the manager, using the manager\'s own rate against the transaction amount', () => {
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
    expect(overridePayout?.amount.equals(transaction.amount.times(manager.commissionRate))).toBe(true);
    expect(overridePayout?.amount.equals(new Decimal('25.00'))).toBe(true);
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
    expect(refundOverride?.amount.equals(new Decimal('-25.00'))).toBe(true);

    expect(refundBase?.amount.lessThan(0)).toBe(true);
    expect(refundOverride?.amount.lessThan(0)).toBe(true);
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
});
