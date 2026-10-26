import { useState } from 'react';
import type { Payee, PayoutLine } from '../api';

const PAGE_SIZE = 10;

const styles = {
  card: {
    background: '#ffffff',
    border: '1px solid #e2e2e7',
    borderRadius: '12px',
    padding: '20px',
  },
  headerRow: {
    display: 'flex',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: '16px',
  },
  heading: {
    margin: 0,
    fontSize: '18px',
    fontWeight: 600,
  },
  count: {
    fontSize: '13px',
    color: '#6b6b76',
  },
  empty: {
    fontSize: '13px',
    color: '#6b6b76',
  },
  tableWrap: {
    overflowX: 'auto' as const,
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse' as const,
    fontSize: '14px',
  },
  th: {
    textAlign: 'left' as const,
    padding: '8px 10px',
    fontSize: '12px',
    fontWeight: 600,
    color: '#6b6b76',
    borderBottom: '1px solid #e2e2e7',
    whiteSpace: 'nowrap' as const,
  },
  tdBase: {
    padding: '10px',
    verticalAlign: 'top' as const,
    borderBottom: '1px solid #e2e2e7',
  },
  trSuccess: {
    background: '#eafaf0',
  },
  trDanger: {
    background: '#fdecea',
  },
  subtext: {
    fontSize: '12px',
    color: '#6b6b76',
  },
  dash: {
    color: '#6b6b76',
  },
  badge: {
    display: 'inline-block',
    background: '#b3261e',
    color: '#ffffff',
    fontSize: '11px',
    fontWeight: 700,
    letterSpacing: '0.04em',
    textTransform: 'uppercase' as const,
    borderRadius: '999px',
    padding: '2px 8px',
    marginLeft: '8px',
  },
  pagination: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: '16px',
    flexWrap: 'wrap' as const,
    gap: '10px',
  },
  pageSummary: {
    fontSize: '13px',
    color: '#6b6b76',
  },
  pageButtons: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  },
  pageButton: {
    minWidth: '28px',
    padding: '6px 8px',
    border: '1px solid #d4d4db',
    borderRadius: '6px',
    background: '#ffffff',
    color: '#1a1a1f',
    fontSize: '13px',
    cursor: 'pointer',
  },
  pageButtonActive: {
    border: '1px solid #2f4bb3',
    background: '#2f4bb3',
    color: '#ffffff',
  },
  pageButtonDisabled: {
    opacity: 0.4,
    cursor: 'not-allowed',
  },
};

interface TransactionSummary {
  id: string;
  payeeId: string;
  amount: string;
  occurredAt: string;
}

interface TransactionGroup {
  transactionId: string;
  payeeId: string;
  amount: string;
  occurredAt: string;
  base: PayoutLine | undefined;
  override: PayoutLine | undefined;
  isRefund: boolean;
}

function payeeName(payees: Payee[], payeeId: string | undefined): string {
  if (!payeeId) {
    return '—';
  }
  const payee = payees.find((candidate) => candidate.id === payeeId);
  return payee ? payee.name : payeeId;
}

/**
 * Groups the flat payout-line list (one base/override line per transaction, as the backend
 * returns them) into one row per transaction, joined against the `transactions` prop for the
 * payee/amount/date (rather than reverse-engineering the original amount from the base line and
 * the payee's commission rate, which would be fragile and duplicate money math that belongs on
 * the server).
 */
function buildGroups(
  transactions: TransactionSummary[],
  payoutLines: PayoutLine[],
): TransactionGroup[] {
  const linesByTransaction = new Map<string, { base?: PayoutLine; override?: PayoutLine }>();
  for (const line of payoutLines) {
    const entry = linesByTransaction.get(line.transactionId) ?? {};
    if (line.type === 'base') {
      entry.base = line;
    } else {
      entry.override = line;
    }
    linesByTransaction.set(line.transactionId, entry);
  }

  const groups: TransactionGroup[] = transactions.map((transaction) => {
    const lines = linesByTransaction.get(transaction.id);
    return {
      transactionId: transaction.id,
      payeeId: transaction.payeeId,
      amount: transaction.amount,
      occurredAt: transaction.occurredAt,
      base: lines?.base,
      override: lines?.override,
      isRefund: false,
    };
  });

  // Refund detection: a group is a refund of the earliest prior group for the same payee whose
  // base-line amount is the exact negation of this group's base-line amount. Parsing as numbers
  // here is purely a display-logic comparison, not the money math itself.
  const originalIndexByGroupIndex = new Map<number, number>();
  for (let i = 0; i < groups.length; i += 1) {
    const current = groups[i];
    const currentBase = current.base ? Number(current.base.amount) : undefined;
    if (currentBase === undefined) {
      continue;
    }
    for (let j = 0; j < i; j += 1) {
      const earlier = groups[j];
      if (earlier.payeeId !== current.payeeId || !earlier.base) {
        continue;
      }
      const earlierBase = Number(earlier.base.amount);
      if (earlierBase === -currentBase) {
        current.isRefund = true;
        originalIndexByGroupIndex.set(i, j);
        break;
      }
    }
  }

  return groupsWithPagingHint(groups, originalIndexByGroupIndex);
}

// Attaches the "final page" each group belongs to, pulling a refund's original forward onto the
// refund's own natural page whenever the plain index/PAGE_SIZE split would separate them. This
// only ever moves an original later (never a refund earlier), so row order is untouched.
function groupsWithPagingHint(
  groups: TransactionGroup[],
  originalIndexByGroupIndex: Map<number, number>,
): TransactionGroup[] {
  const finalPage = groups.map((_, i) => Math.floor(i / PAGE_SIZE));
  originalIndexByGroupIndex.forEach((originalIndex, refundIndex) => {
    const refundPage = finalPage[refundIndex];
    if (finalPage[originalIndex] < refundPage) {
      finalPage[originalIndex] = refundPage;
    }
  });

  (groups as (TransactionGroup & { __page?: number })[]).forEach((group, i) => {
    group.__page = finalPage[i];
  });
  return groups;
}

function paginate(groups: TransactionGroup[]): TransactionGroup[][] {
  const buckets = new Map<number, TransactionGroup[]>();
  for (const group of groups) {
    const page = (group as TransactionGroup & { __page?: number }).__page ?? 0;
    const bucket = buckets.get(page) ?? [];
    bucket.push(group);
    buckets.set(page, bucket);
  }
  return Array.from(buckets.keys())
    .sort((a, b) => a - b)
    .map((key) => buckets.get(key)!);
}

export function AuditTrail({
  transactions,
  payoutLines,
  payees,
}: {
  transactions: TransactionSummary[];
  payoutLines: PayoutLine[];
  payees: Payee[];
}) {
  const [currentPage, setCurrentPage] = useState(1);

  const groups = buildGroups(transactions, payoutLines);
  const pages = paginate(groups);
  const pageCount = pages.length;
  const safePage = Math.min(Math.max(currentPage, 1), Math.max(pageCount, 1));
  const activeRows = pages[safePage - 1] ?? [];

  const rowsBeforeActivePage = pages
    .slice(0, safePage - 1)
    .reduce((sum, page) => sum + page.length, 0);
  const rangeStart = groups.length === 0 ? 0 : rowsBeforeActivePage + 1;
  const rangeEnd = rowsBeforeActivePage + activeRows.length;

  function goToPage(page: number) {
    setCurrentPage(Math.min(Math.max(page, 1), Math.max(pageCount, 1)));
  }

  return (
    <div style={styles.card}>
      <div style={styles.headerRow}>
        <h2 style={styles.heading}>Audit trail</h2>
        <span style={styles.count}>{transactions.length} transactions</span>
      </div>

      {groups.length === 0 ? (
        <p style={styles.empty}>No transactions yet</p>
      ) : (
        <>
          <div style={styles.tableWrap}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Txn</th>
                  <th style={styles.th}>Payee</th>
                  <th style={styles.th}>Amount</th>
                  <th style={styles.th}>Base</th>
                  <th style={styles.th}>Override</th>
                </tr>
              </thead>
              <tbody>
                {activeRows.map((group) => {
                  const rowStyle = {
                    ...(group.isRefund ? styles.trDanger : styles.trSuccess),
                  };
                  return (
                    <tr key={group.transactionId} style={rowStyle}>
                      <td style={styles.tdBase}>
                        {group.transactionId}
                        {group.isRefund ? <span style={styles.badge}>Refund</span> : null}
                      </td>
                      <td style={styles.tdBase}>{payeeName(payees, group.payeeId)}</td>
                      <td style={styles.tdBase}>{group.amount}</td>
                      <td style={styles.tdBase}>
                        {group.base ? (
                          <>
                            <div>{group.base.amount}</div>
                            <div style={styles.subtext}>
                              {payeeName(payees, group.base.payeeId)}
                            </div>
                          </>
                        ) : (
                          <span style={styles.dash}>—</span>
                        )}
                      </td>
                      <td style={styles.tdBase}>
                        {group.override ? (
                          <>
                            <div>{group.override.amount}</div>
                            <div style={styles.subtext}>
                              {payeeName(payees, group.override.payeeId)}
                            </div>
                          </>
                        ) : (
                          <span style={styles.dash}>—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div style={styles.pagination}>
            <span style={styles.pageSummary}>
              Showing {rangeStart}–{rangeEnd} of {groups.length}
            </span>
            <div style={styles.pageButtons}>
              <button
                type="button"
                style={{
                  ...styles.pageButton,
                  ...(safePage === 1 ? styles.pageButtonDisabled : {}),
                }}
                onClick={() => goToPage(safePage - 1)}
                disabled={safePage === 1}
              >
                ‹
              </button>
              {Array.from({ length: pageCount }, (_, i) => i + 1).map((page) => (
                <button
                  key={page}
                  type="button"
                  style={{
                    ...styles.pageButton,
                    ...(page === safePage ? styles.pageButtonActive : {}),
                  }}
                  onClick={() => goToPage(page)}
                >
                  {page}
                </button>
              ))}
              <button
                type="button"
                style={{
                  ...styles.pageButton,
                  ...(safePage === pageCount ? styles.pageButtonDisabled : {}),
                }}
                onClick={() => goToPage(safePage + 1)}
                disabled={safePage === pageCount}
              >
                ›
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
