import { Decimal } from 'decimal.js';
import type { Payee, Transaction, PayoutLine } from './types.js';

export function calculateBasePayout(amount: Decimal, rate: Decimal): Decimal {
  return amount.times(rate);
}

export function calculateOverridePayout(amount: Decimal, managerRate: Decimal): Decimal {
  return amount.times(managerRate);
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

  if (payee.managerId) {
    const manager = payees.find((p) => p.id === payee.managerId);
    if (!manager) {
      throw new Error(`Manager '${payee.managerId}' not found for payee '${payee.id}'`);
    }
    payoutLines.push({
      transactionId: transaction.id,
      payeeId: manager.id,
      type: 'override',
      amount: calculateOverridePayout(transaction.amount, manager.commissionRate),
    });
  }

  return payoutLines;
}
