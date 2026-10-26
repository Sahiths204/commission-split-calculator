import { useState } from 'react';
import type { FormEvent } from 'react';
import { createPayee, type Payee } from '../api';

const styles = {
  card: {
    background: '#ffffff',
    border: '1px solid #e2e2e7',
    borderRadius: '12px',
    padding: '20px',
    maxWidth: '480px',
  },
  heading: {
    margin: '0 0 16px 0',
    fontSize: '18px',
    fontWeight: 600,
  },
  list: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '8px',
    marginBottom: '20px',
  },
  row: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    background: '#f6f6f9',
    borderRadius: '8px',
    padding: '10px 12px',
  },
  rowMain: {
    display: 'flex',
    flexDirection: 'column' as const,
  },
  rowName: {
    fontSize: '14px',
    fontWeight: 500,
  },
  rowManager: {
    fontSize: '12px',
    color: '#6b6b76',
  },
  badge: {
    background: '#e6edff',
    color: '#2f4bb3',
    fontSize: '12px',
    fontWeight: 600,
    borderRadius: '999px',
    padding: '2px 10px',
  },
  empty: {
    fontSize: '13px',
    color: '#6b6b76',
    marginBottom: '20px',
  },
  form: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '10px',
    borderTop: '1px solid #e2e2e7',
    paddingTop: '16px',
  },
  input: {
    padding: '8px 10px',
    border: '1px solid #d4d4db',
    borderRadius: '6px',
    fontSize: '14px',
  },
  select: {
    padding: '8px 10px',
    border: '1px solid #d4d4db',
    borderRadius: '6px',
    fontSize: '14px',
  },
  button: {
    padding: '8px 10px',
    border: 'none',
    borderRadius: '6px',
    background: '#2f4bb3',
    color: '#ffffff',
    fontSize: '14px',
    fontWeight: 600,
    cursor: 'pointer',
  },
  error: {
    fontSize: '13px',
    color: '#b3261e',
  },
};

function formatRate(rate: string): string {
  const parsed = parseFloat(rate);
  if (Number.isNaN(parsed)) {
    return rate;
  }
  return `${parsed * 100}%`;
}

function normalizeRateInput(raw: string): string {
  const parsed = parseFloat(raw);
  if (Number.isNaN(parsed)) {
    throw new Error('Rate must be a number');
  }
  // If the user typed something that looks like a plain percentage (e.g. "20"),
  // treat it as a percentage and convert to a decimal fraction. If they already
  // typed a fraction (e.g. "0.2"), keep it as-is.
  const decimal = parsed > 1 ? parsed / 100 : parsed;
  return String(decimal);
}

export function PayeesPanel({
  payees,
  onPayeesChanged,
}: {
  payees: Payee[];
  onPayeesChanged: (payees: Payee[]) => void;
}) {
  const [name, setName] = useState('');
  const [rate, setRate] = useState('');
  const [managerId, setManagerId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    let commissionRate: string;
    try {
      commissionRate = normalizeRateInput(rate);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid rate');
      return;
    }

    setSubmitting(true);
    try {
      const created = await createPayee({
        name,
        commissionRate,
        managerId: managerId === '' ? null : managerId,
      });
      onPayeesChanged([...payees, created]);
      setName('');
      setRate('');
      setManagerId('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add payee');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={styles.card}>
      <h2 style={styles.heading}>Payees</h2>

      {payees.length === 0 ? (
        <p style={styles.empty}>No payees yet.</p>
      ) : (
        <div style={styles.list}>
          {payees.map((payee) => {
            const manager = payee.managerId
              ? payees.find((candidate) => candidate.id === payee.managerId)
              : undefined;
            return (
              <div style={styles.row} key={payee.id}>
                <div style={styles.rowMain}>
                  <span style={styles.rowName}>{payee.name}</span>
                  {manager ? (
                    <span style={styles.rowManager}>reports to {manager.name}</span>
                  ) : null}
                </div>
                <span style={styles.badge}>{formatRate(payee.commissionRate)}</span>
              </div>
            );
          })}
        </div>
      )}

      <form style={styles.form} onSubmit={handleSubmit}>
        <input
          style={styles.input}
          type="text"
          placeholder="Name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          required
        />
        <input
          style={styles.input}
          type="text"
          placeholder="Rate (e.g. 20 for 20%, or 0.20)"
          value={rate}
          onChange={(event) => setRate(event.target.value)}
          required
        />
        <select
          style={styles.select}
          value={managerId}
          onChange={(event) => setManagerId(event.target.value)}
        >
          <option value="">None</option>
          {payees.map((payee) => (
            <option key={payee.id} value={payee.id}>
              {payee.name}
            </option>
          ))}
        </select>
        <button style={styles.button} type="submit" disabled={submitting}>
          {submitting ? 'Adding...' : 'Add payee'}
        </button>
        {error ? <span style={styles.error}>{error}</span> : null}
      </form>
    </div>
  );
}
