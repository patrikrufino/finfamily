import {
  ApiError,
  type AccountDto,
  type BudgetReportDto,
  type CardDto,
  type PlanDetailDto,
  type PlanDto,
  type StatementDto,
  type CategoryDto,
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
  adjustAccount: (id, input) => request<TransactionDto>(`/api/accounts/${id}/adjust`, send("POST", input)),
  listTransactions: ({ month, accountId, personId, categoryId, cardId }) => {
    const qs = new URLSearchParams({ month });
    if (accountId) qs.set("accountId", String(accountId));
    if (personId) qs.set("personId", String(personId));
    if (categoryId) qs.set("categoryId", String(categoryId));
    if (cardId) qs.set("cardId", String(cardId));
    return request<TransactionDto[]>(`/api/transactions?${qs}`);
  },
  createTransaction: (input) => request<TransactionDto>("/api/transactions", send("POST", input)),
  updateTransaction: (id, input) => request<TransactionDto>(`/api/transactions/${id}`, send("PUT", input)),
  deleteTransaction: (id) => request<void>(`/api/transactions/${id}`, send("DELETE")),
  listCategories: () => request<CategoryDto[]>("/api/categories"),
  createCategory: (input) => request<CategoryDto>("/api/categories", send("POST", input)),
  updateCategory: (id, patch) => request<CategoryDto>(`/api/categories/${id}`, send("PATCH", patch)),
  setBudget: (categoryId, month, amountCents) =>
    request<void>(`/api/budgets/${categoryId}`, send("PUT", { month, amountCents })),
  getBudget: (month) => request<BudgetReportDto>(`/api/budget?month=${month}`),
  listCards: () => request<CardDto[]>("/api/cards"),
  createCard: (input) => request<CardDto>("/api/cards", send("POST", input)),
  updateCard: (id, patch) => request<CardDto>(`/api/cards/${id}`, send("PATCH", patch)),
  setCardRule: (cardId, rule) => request<void>(`/api/cards/${cardId}/rules`, send("POST", rule)),
  getStatement: (cardId, month) =>
    request<StatementDto>(`/api/cards/${cardId}/statement${month ? `?month=${month}` : ""}`),
  listPlans: () => request<PlanDto[]>("/api/installment-plans"),
  getPlan: (id) => request<PlanDetailDto>(`/api/installment-plans/${id}`),
  createPlan: (input) => request<PlanDetailDto>("/api/installment-plans", send("POST", input)),
  anticipatePlan: (id, input) => request<PlanDetailDto>(`/api/installment-plans/${id}/anticipate`, send("POST", input)),
  cancelPlan: (id) => request<void>(`/api/installment-plans/${id}`, send("DELETE")),
  payStatement: (cardId, month, input) =>
    request<StatementDto>(`/api/cards/${cardId}/statements/${month}/payments`, send("POST", input)),
};
