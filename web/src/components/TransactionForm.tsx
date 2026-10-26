import { useState } from 'react';
import type { FormEvent } from 'react';
import { createTransaction, type Payee, type PayoutLine } from '../api';

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function isValidDecimalString(value: string): boolean {
  // Accepts an optional leading '-', digits, and an optional decimal part.
  // Rejects empty string, bare '-', bare '.', and anything non-numeric.
  return /^-?\d+(\.\d+)?$/.test(value.trim());
}

interface TransactionFormProps {
  payees: Payee[];
  onTransactionCreated: (payouts: PayoutLine[]) => void;
}

export function TransactionForm({ payees, onTransactionCreated }: TransactionFormProps) {
  const [payeeId, setPayeeId] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(todayIsoDate());
  const [payeeError, setPayeeError] = useState<string | null>(null);
  const [amountError, setAmountError] = useState<string | null>(null);
  const [dateError, setDateError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setPayeeError(null);
    setAmountError(null);
    setDateError(null);
    setSubmitError(null);

    let hasError = false;

    if (!payeeId) {
      setPayeeError('Select a payee.');
      hasError = true;
    }

    const trimmedAmount = amount.trim();
    if (!trimmedAmount || !isValidDecimalString(trimmedAmount)) {
      setAmountError('Enter a valid amount (e.g. 100.00 or -25.50).');
      hasError = true;
    }

    if (!date) {
      setDateError('Select a date.');
      hasError = true;
    }

    if (hasError) {
      return;
    }

    setIsSubmitting(true);
    try {
      const payouts = await createTransaction({
        payeeId,
        amount: trimmedAmount,
        occurredAt: new Date(date).toISOString(),
      });
      onTransactionCreated(payouts);
      setAmount('');
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'Failed to create transaction.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div
      style={{
        background: '#ffffff',
        border: '1px solid #e2e8f0',
        borderRadius: '12px',
        padding: '24px',
        maxWidth: '420px',
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.06)',
      }}
    >
      <h2 style={{ marginTop: 0, marginBottom: '16px', fontSize: '18px', fontWeight: 600 }}>
        New transaction
      </h2>
      <form onSubmit={(event) => void handleSubmit(event)}>
        <div style={{ marginBottom: '16px' }}>
          <label
            htmlFor="transaction-payee"
            style={{ display: 'block', marginBottom: '6px', fontSize: '14px', fontWeight: 500 }}
          >
            Payee
          </label>
          <select
            id="transaction-payee"
            value={payeeId}
            onChange={(event) => setPayeeId(event.target.value)}
            style={{
              width: '100%',
              padding: '8px 10px',
              borderRadius: '6px',
              border: '1px solid #cbd5e1',
              fontSize: '14px',
            }}
          >
            <option value="">Select a payee…</option>
            {payees.map((payee) => (
              <option key={payee.id} value={payee.id}>
                {payee.name}
              </option>
            ))}
          </select>
          {payeeError && (
            <div style={{ color: '#dc2626', fontSize: '13px', marginTop: '4px' }}>{payeeError}</div>
          )}
        </div>

        <div style={{ marginBottom: '16px' }}>
          <label
            htmlFor="transaction-amount"
            style={{ display: 'block', marginBottom: '6px', fontSize: '14px', fontWeight: 500 }}
          >
            Amount
          </label>
          <input
            id="transaction-amount"
            type="text"
            inputMode="decimal"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            placeholder="100.00"
            style={{
              width: '100%',
              padding: '8px 10px',
              borderRadius: '6px',
              border: '1px solid #cbd5e1',
              fontSize: '14px',
              boxSizing: 'border-box',
            }}
          />
          <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>
            Negative amount = refund or chargeback.
          </div>
          {amountError && (
            <div style={{ color: '#dc2626', fontSize: '13px', marginTop: '4px' }}>{amountError}</div>
          )}
        </div>

        <div style={{ marginBottom: '20px' }}>
          <label
            htmlFor="transaction-date"
            style={{ display: 'block', marginBottom: '6px', fontSize: '14px', fontWeight: 500 }}
          >
            Date
          </label>
          <input
            id="transaction-date"
            type="date"
            value={date}
            onChange={(event) => setDate(event.target.value)}
            style={{
              width: '100%',
              padding: '8px 10px',
              borderRadius: '6px',
              border: '1px solid #cbd5e1',
              fontSize: '14px',
              boxSizing: 'border-box',
            }}
          />
          {dateError && (
            <div style={{ color: '#dc2626', fontSize: '13px', marginTop: '4px' }}>{dateError}</div>
          )}
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          style={{
            width: '100%',
            padding: '10px 16px',
            borderRadius: '6px',
            border: 'none',
            background: isSubmitting ? '#93c5fd' : '#2563eb',
            color: '#ffffff',
            fontSize: '14px',
            fontWeight: 600,
            cursor: isSubmitting ? 'default' : 'pointer',
          }}
        >
          {isSubmitting ? 'Submitting…' : 'Add transaction'}
        </button>

        {submitError && (
          <div style={{ color: '#dc2626', fontSize: '13px', marginTop: '10px' }}>{submitError}</div>
        )}
      </form>
    </div>
  );
}
