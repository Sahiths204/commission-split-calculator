// Typed API client for the Commission Split Calculator backend.
//
// Conventions matching the backend (src/api/app.ts):
// - All money/rate values are plain strings (exact-decimal on the server), never parsed as
//   numbers here. Parsing/formatting for display is a different ticket's concern.
// - Every function throws a clear Error on a non-2xx response, using the server's `error`
//   message when available.

const BASE_URL: string =
  (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:3999';

export interface Payee {
  id: string;
  name: string;
  commissionRate: string;
  managerId: string | null;
}

export interface PayoutLine {
  transactionId: string;
  payeeId: string;
  type: 'base' | 'override';
  amount: string;
}

interface PayoutsResponse {
  payouts: PayoutLine[];
}

async function parseErrorMessage(response: Response): Promise<string> {
  try {
    const body: unknown = await response.json();
    if (
      body &&
      typeof body === 'object' &&
      'error' in body &&
      typeof (body as { error: unknown }).error === 'string'
    ) {
      return (body as { error: string }).error;
    }
  } catch {
    // Response body wasn't JSON (or was empty) - fall through to the generic message.
  }
  return `Request failed with status ${response.status}`;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...init?.headers,
    },
  });

  if (!response.ok) {
    throw new Error(await parseErrorMessage(response));
  }

  return (await response.json()) as T;
}

export async function getPayees(): Promise<Payee[]> {
  return request<Payee[]>('/payees');
}

export async function createPayee(input: {
  name: string;
  commissionRate: string;
  managerId: string | null;
}): Promise<Payee> {
  return request<Payee>('/payees', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function createTransaction(input: {
  payeeId: string;
  amount: string;
  occurredAt: string;
}): Promise<PayoutLine[]> {
  const { payouts } = await request<PayoutsResponse>('/transactions', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  return payouts;
}

export async function getPayoutsForTransaction(transactionId: string): Promise<PayoutLine[]> {
  const { payouts } = await request<PayoutsResponse>(
    `/transactions/${encodeURIComponent(transactionId)}/payouts`,
  );
  return payouts;
}

export interface TransactionSummary {
  id: string;
  payeeId: string;
  amount: string;
  occurredAt: string;
}

export async function getAllTransactions(): Promise<{
  transactions: TransactionSummary[];
  payoutLines: PayoutLine[];
}> {
  return request<{ transactions: TransactionSummary[]; payoutLines: PayoutLine[] }>(
    '/transactions',
  );
}
