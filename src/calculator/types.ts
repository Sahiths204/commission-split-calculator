import { Decimal } from 'decimal.js';

export interface Payee {
  id: string;
  name: string;
  commissionRate: Decimal;
  managerId: string | null;
}

export interface Transaction {
  id: string;
  payeeId: string;
  amount: Decimal;
  occurredAt: Date;
}

export interface PayoutLine {
  transactionId: string;
  payeeId: string;
  type: 'base' | 'override';
  amount: Decimal;
}
