import {
  ApiError,
  type AccountDto,
  type FinanceRepository,
  type PersonDto,
  type TransactionDto,
} from "./types";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: init?.body ? { "content-type": "application/json" } : undefined,
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { errors?: string[] };
    throw new ApiError(res.status, body.errors ?? []);
  }
  return res.status === 204 ? (undefined as T) : ((await res.json()) as T);
}

const send = (method: string, body?: unknown): RequestInit => ({
  method,
  body: body === undefined ? undefined : JSON.stringify(body),
});

export const httpRepository: FinanceRepository = {
  listPeople: () => request<PersonDto[]>("/api/people"),
  listAccounts: () => request<AccountDto[]>("/api/accounts"),
  createAccount: (input) => request<AccountDto>("/api/accounts", send("POST", input)),
  updateAccount: (id, patch) => request<AccountDto>(`/api/accounts/${id}`, send("PATCH", patch)),
  listTransactions: ({ month, accountId, personId }) => {
    const qs = new URLSearchParams({ month });
    if (accountId) qs.set("accountId", String(accountId));
    if (personId) qs.set("personId", String(personId));
    return request<TransactionDto[]>(`/api/transactions?${qs}`);
  },
  createTransaction: (input) => request<TransactionDto>("/api/transactions", send("POST", input)),
  updateTransaction: (id, input) => request<TransactionDto>(`/api/transactions/${id}`, send("PUT", input)),
  deleteTransaction: (id) => request<void>(`/api/transactions/${id}`, send("DELETE")),
};
