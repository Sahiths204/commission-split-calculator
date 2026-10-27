import { Decimal } from 'decimal.js';
import type { Payee, Transaction, PayoutLine } from './types.js';
import { MONEY_ROUNDING_MODE } from './config.js';

export function calculateBasePayout(amount: Decimal, rate: Decimal): Decimal {
  return amount.times(rate);
}

// The spread between one level's rate and the level directly below it, applied to the
// transaction amount. Not the upline's full rate — this is what lets the override walk every
// level of the hierarchy without double-paying the rate the downline already earned.
export function calculateOverridePayout(amount: Decimal, uplineRate: Decimal, downlineRate: Decimal): Decimal {
  return amount.times(uplineRate.minus(downlineRate));
}

export function calculateTransactionPayouts(
  transaction: Transaction,
  payees: Payee[],
): PayoutLine[] {
  const payee = payees.find((p) => p.id === transaction.payeeId);
  if (!payee) {
    throw new Error(`Payee '${transaction.payeeId}' not found for transaction '${transaction.id}'`);
  }

  const payoutLines: PayoutLine[] = [
    {
      transactionId: transaction.id,
      payeeId: payee.id,
      type: 'base',
      amount: calculateBasePayout(transaction.amount, payee.commissionRate),
    },
  ];

  let downline = payee;
  let uplineId = payee.managerId;
  while (uplineId) {
    const upline = payees.find((p) => p.id === uplineId);
    if (!upline) {
      throw new Error(`Manager '${uplineId}' not found for payee '${downline.id}'`);
    }
    payoutLines.push({
      transactionId: transaction.id,
      payeeId: upline.id,
      type: 'override',
      amount: calculateOverridePayout(transaction.amount, upline.commissionRate, downline.commissionRate),
    });
    downline = upline;
    uplineId = upline.managerId;
  }

  return payoutLines;
}

// Apply this at a display or persistence boundary only — rounding happens exactly once, there,
// never inside the calculation functions above, which must keep returning full exact precision.
export function roundToCents(amount: Decimal): Decimal {
  return amount.toDecimalPlaces(2, MONEY_ROUNDING_MODE);
}
