import { useEffect, useState } from 'react';
import type { CSSProperties } from 'react';
import { getAllTransactions, getPayees, type Payee, type PayoutLine } from './api';
import { PayeesPanel } from './components/PayeesPanel';
import { TransactionForm } from './components/TransactionForm';
import { AuditTrail } from './components/AuditTrail';

interface TransactionSummary {
  id: string;
  payeeId: string;
  amount: string;
  occurredAt: string;
}

const metricCardStyle: CSSProperties = {
  background: '#f6f6f9',
  border: '1px solid #e2e2e7',
  borderRadius: '12px',
  padding: '16px 20px',
  flex: '1 1 160px',
  minWidth: '160px',
};

const metricLabelStyle: CSSProperties = {
  fontSize: '12px',
  fontWeight: 600,
  color: '#6b6b76',
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
  margin: '0 0 6px 0',
};

const metricValueStyle: CSSProperties = {
  fontSize: '28px',
  fontWeight: 700,
  margin: 0,
};

function App() {
  const [payees, setPayees] = useState<Payee[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [transactions, setTransactions] = useState<TransactionSummary[]>([]);
  const [payoutLines, setPayoutLines] = useState<PayoutLine[]>([]);

  useEffect(() => {
    let cancelled = false;
    Promise.all([getPayees(), getAllTransactions()])
      .then(([fetchedPayees, fetchedTransactions]) => {
        if (!cancelled) {
          setPayees(fetchedPayees);
          setTransactions(fetchedTransactions.transactions);
          setPayoutLines(fetchedTransactions.payoutLines);
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setLoadError(error instanceof Error ? error.message : 'Failed to load data');
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function handleTransactionCreated(payouts: PayoutLine[]) {
    const baseLine = payouts.find((line) => line.type === 'base');
    if (baseLine) {
      const payee = payees.find((candidate) => candidate.id === baseLine.payeeId);
      // The base payout line's amount is `transaction.amount * payee.commissionRate`, and the
      // original transaction amount isn't returned to us separately, so we reconstruct it here
      // purely as a display label for the audit trail's "Amount" column (not re-doing the
      // server's exact-decimal money math, which already happened on the backend).
      const rate = payee ? Number(payee.commissionRate) : NaN;
      const amount =
        payee && rate !== 0 && !Number.isNaN(rate)
          ? (Number(baseLine.amount) / rate).toFixed(2)
          : baseLine.amount;
      setTransactions((prev) => [
        ...prev,
        {
          id: baseLine.transactionId,
          payeeId: baseLine.payeeId,
          amount,
          // The exact submitted date isn't returned either; "now" is a reasonable stand-in for
          // this session-only, in-memory audit list.
          occurredAt: new Date().toISOString(),
        },
      ]);
    }
    setPayoutLines((prev) => [...prev, ...payouts]);
  }

  const netPaidOut = payoutLines
    .filter((line) => line.type === 'base')
    .reduce((sum, line) => sum + Number(line.amount), 0)
    .toFixed(2);

  return (
    <div className="page">
      <header>
        <h1 style={{ margin: '0 0 4px 0', fontSize: '28px', fontWeight: 700 }}>
          Commission split calculator
        </h1>
        <p style={{ margin: '0 0 24px 0', color: '#6b6b76', fontSize: '14px' }}>
          Add payees, record transactions, and review the exact-math payout audit trail.
        </p>
      </header>

      {loading ? (
        <p>Loading…</p>
      ) : (
        <>
          {loadError ? (
            <p style={{ color: '#b3261e' }}>{loadError}</p>
          ) : null}

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', marginBottom: '24px' }}>
            <div style={metricCardStyle}>
              <p style={metricLabelStyle}>Payees</p>
              <p style={metricValueStyle}>{payees.length}</p>
            </div>
            <div style={metricCardStyle}>
              <p style={metricLabelStyle}>Transactions</p>
              <p style={metricValueStyle}>{transactions.length}</p>
            </div>
            <div style={metricCardStyle}>
              <p style={metricLabelStyle}>Net paid out</p>
              <p style={metricValueStyle}>{netPaidOut}</p>
            </div>
          </div>

          <div className="two-column">
            <PayeesPanel payees={payees} onPayeesChanged={setPayees} />
            <TransactionForm payees={payees} onTransactionCreated={handleTransactionCreated} />
          </div>

          <div style={{ marginTop: '24px' }}>
            <AuditTrail transactions={transactions} payoutLines={payoutLines} payees={payees} />
          </div>
        </>
      )}
    </div>
  );
}

export default App;
