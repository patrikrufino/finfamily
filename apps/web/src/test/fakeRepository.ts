import {
  accountBalance,
  budgetForMonth,
  budgetProgress,
  Money,
  type Account,
  type BudgetEntry,
  type Transaction,
} from "@finfamily/domain";
import {
  ApiError,
  type AccountDto,
  type CategoryDto,
  type NewCategory,
  type FinanceRepository,
  type NewAccount,
  type NewTransaction,
  type TransactionDto,
} from "../data/types";

/** In-memory repository mirroring the API behaviour, for ViewModel and component tests. */
export function createFakeRepository(
  seed: { accounts?: NewAccount[]; transactions?: NewTransaction[]; categories?: NewCategory[] } = {},
) {
  const people = [
    { id: 1, name: "Patrik" },
    { id: 2, name: "Heloisa" },
  ];
  let accounts: (NewAccount & { id: number; archived: boolean })[] = [];
  let transactions: TransactionDto[] = [];
  let categories: CategoryDto[] = [];
  const budgetEntries: BudgetEntry[] = [];
  let nextCategoryId = 1;
  let nextAccountId = 1;
  let nextTransactionId = 1;

  const toAccountDto = (a: (typeof accounts)[number]): AccountDto => {
    const domain: Account = { ...a, initialBalance: Money.fromCents(a.initialBalanceCents) };
    const txs: Transaction[] = transactions.map((t) => ({ ...t, amount: Money.fromCents(t.amountCents) }));
    return {
      ...a,
      balanceCents: accountBalance(domain, txs).cents,
      projectedBalanceCents: accountBalance(domain, txs, { includeScheduled: true }).cents,
    };
  };

  const repo: FinanceRepository & { calls: string[] } = {
    calls: [],
    listPeople: async () => people,
    listAccounts: async () => accounts.filter((a) => !a.archived).map(toAccountDto),
    createAccount: async (input) => {
      repo.calls.push("createAccount");
      if (accounts.some((a) => !a.archived && a.name === input.name)) throw new ApiError(409, ["account_name_taken"]);
      const account = { ...input, id: nextAccountId++, archived: false };
      accounts.push(account);
      return toAccountDto(account);
    },
    updateAccount: async (id, patch) => {
      accounts = accounts.map((a) => (a.id === id ? { ...a, ...patch } : a));
      return toAccountDto(accounts.find((a) => a.id === id)!);
    },
    listTransactions: async ({ month, accountId, personId, categoryId }) =>
      transactions
        .filter((t) => t.date.startsWith(`${month}-`))
        .filter((t) => !accountId || t.accountId === accountId || t.toAccountId === accountId)
        .filter((t) => !personId || t.personId === personId)
        .filter((t) => !categoryId || t.categoryId === categoryId)
        .sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id),
    createTransaction: async (input) => {
      repo.calls.push("createTransaction");
      const created = { ...input, id: nextTransactionId++ };
      transactions.push(created);
      return created;
    },
    updateTransaction: async (id, input) => {
      repo.calls.push("updateTransaction");
      transactions = transactions.map((t) => (t.id === id ? { ...input, id } : t));
      return transactions.find((t) => t.id === id)!;
    },
    deleteTransaction: async (id) => {
      repo.calls.push("deleteTransaction");
      transactions = transactions.filter((t) => t.id !== id);
    },
    listCategories: async () => categories.filter((c) => !c.archived),
    createCategory: async (input) => {
      repo.calls.push("createCategory");
      if (categories.some((c) => !c.archived && c.name.toLowerCase() === input.name.toLowerCase())) {
        throw new ApiError(409, ["category_name_taken"]);
      }
      const category = { ...input, id: nextCategoryId++, archived: false };
      categories.push(category);
      return category;
    },
    updateCategory: async (id, patch) => {
      categories = categories.map((c) => (c.id === id ? { ...c, ...patch } : c));
      return categories.find((c) => c.id === id)!;
    },
    setBudget: async (categoryId, month, amountCents) => {
      repo.calls.push("setBudget");
      const existing = budgetEntries.find((e) => e.categoryId === categoryId && e.fromMonth === month);
      if (existing) existing.amount = Money.fromCents(amountCents);
      else budgetEntries.push({ categoryId, fromMonth: month, amount: Money.fromCents(amountCents) });
    },
    getBudget: async (month) => {
      const inMonth = transactions.filter((t) => t.kind === "expense" && t.date.startsWith(`${month}-`));
      const sum = (categoryId: number | null, status: string) =>
        inMonth.filter((t) => t.categoryId === categoryId && t.status === status).reduce((s, t) => s + t.amountCents, 0);
      const rows = categories.filter((c) => !c.archived).map((c) => {
        const p = budgetProgress(
          budgetForMonth(budgetEntries, c.id, month),
          Money.fromCents(sum(c.id, "settled")),
          Money.fromCents(sum(c.id, "scheduled")),
        );
        return {
          categoryId: c.id, name: c.name, kind: c.kind, archived: c.archived,
          budgetCents: p.budget.cents, spentCents: p.spent.cents, committedCents: p.committed.cents,
          remainingCents: p.remaining.cents, availableAfterCommittedCents: p.availableAfterCommitted.cents,
          ratio: p.ratio, status: p.status,
        };
      });
      const budgeted = rows.filter((r) => r.budgetCents > 0);
      return {
        month,
        categories: rows,
        uncategorized: { spentCents: sum(null, "settled"), committedCents: sum(null, "scheduled") },
        totals: {
          budgetCents: budgeted.reduce((s, r) => s + r.budgetCents, 0),
          spentCents: budgeted.reduce((s, r) => s + r.spentCents, 0),
          remainingCents: budgeted.reduce((s, r) => s + r.remainingCents, 0),
        },
      };
    },
  };

  seed.categories?.forEach((c) => categories.push({ ...c, id: nextCategoryId++, archived: false }));
  seed.accounts?.forEach((a) => {
    const account = { ...a, id: nextAccountId++, archived: false };
    accounts.push(account);
  });
  seed.transactions?.forEach((t) => transactions.push({ ...t, id: nextTransactionId++ }));
  return repo;
}
