import {
  ALWAYS_FROM,
  accountBalance,
  balanceAdjustment,
  budgetForMonth,
  budgetProgress,
  buildStatement,
  cardUsage,
  Money,
  ruleForMonth,
  statementMonthFor,
  type Account,
  type BudgetEntry,
  type CycleRule,
  type Transaction,
} from "@finfamily/domain";
import {
  ApiError,
  type AccountDto,
  type CardDto,
  type CategoryDto,
  type NewCard,
  type NewCategory,
  type StatementDto,
  type FinanceRepository,
  type NewAccount,
  type NewTransaction,
  type TransactionDto,
} from "../data/types";

/** In-memory repository mirroring the API behaviour, for ViewModel and component tests. */
export function createFakeRepository(
  seed: {
    accounts?: NewAccount[];
    transactions?: NewTransaction[];
    categories?: NewCategory[];
    cards?: NewCard[];
    /** Fixed current date (`YYYY-MM-DD`) for statement logic. */
    today?: string;
  } = {},
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
  const today = () => seed.today ?? new Date().toLocaleDateString("sv-SE");
  let cardRows: { id: number; name: string; limitCents: number; archived: boolean }[] = [];
  const cycleRules: CycleRule[] = [];
  let nextCardId = 1;
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

  const withDefaults = (input: NewTransaction, id: number): TransactionDto => ({
    cardId: null, statementMonth: null, feeKind: null, adjustment: false, ...input, id,
  });
  const toDomainTx = (t: TransactionDto): Transaction => ({ ...t, amount: Money.fromCents(t.amountCents) });
  const domainCard = (c: (typeof cardRows)[number]) => ({ id: c.id, name: c.name, limit: Money.fromCents(c.limitCents), archived: c.archived });
  const rulesOf = (cardId: number) => cycleRules.filter((r) => r.cardId === cardId);

  const statementFor = (cardId: number, month: string): StatementDto => {
    const card = cardRows.find((c) => c.id === cardId)!;
    const rules = rulesOf(cardId);
    const s = buildStatement(domainCard(card), rules, transactions.map(toDomainTx), month, today());
    const rule = ruleForMonth(rules, month);
    const dto = (list: Transaction[]) => list.map((t) => transactions.find((x) => x.id === t.id)!);
    return {
      ...s, closingDay: rule.closingDay, dueDay: rule.dueDay,
      purchases: dto(s.purchases).sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id),
      payments: dto(s.payments), fees: dto(s.fees),
    };
  };
  const cardDto = (c: (typeof cardRows)[number]): CardDto => {
    const rules = rulesOf(c.id);
    const openStatementMonth = statementMonthFor(rules, today());
    const { purchases: _p, payments: _pay, fees: _f, closingDay, dueDay, ...openStatement } = statementFor(c.id, openStatementMonth);
    const usage = cardUsage(domainCard(c), transactions.map(toDomainTx));
    return {
      id: c.id, name: c.name, archived: c.archived, limitCents: c.limitCents, usedCents: usage.usedCents,
      availableCents: usage.availableCents, closingDay, dueDay, openStatementMonth, openStatement,
    };
  };

  const repo: FinanceRepository & { calls: string[] } = {
    calls: [],
    listPeople: async () => people,
    adjustAccount: async (id, input) => {
      repo.calls.push("adjustAccount");
      const account = accounts.find((a) => a.id === id)!;
      const current = Money.fromCents(toAccountDto(account).balanceCents);
      const adjustment = balanceAdjustment(current, Money.fromCents(input.targetBalanceCents));
      if (!adjustment) throw new ApiError(422, ["no_adjustment_needed"]);
      const created = withDefaults({
        kind: adjustment.kind, amountCents: adjustment.amount.cents, date: input.date ?? today(), accountId: id,
        toAccountId: null, categoryId: null, description: "Ajuste de saldo", status: "settled", personId: input.personId,
        adjustment: true,
      }, nextTransactionId++);
      transactions.push(created);
      return created;
    },
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
    listTransactions: async ({ month, accountId, personId, categoryId, cardId }) =>
      transactions
        .filter((t) => t.date.startsWith(`${month}-`))
        .filter((t) => !accountId || t.accountId === accountId || t.toAccountId === accountId)
        .filter((t) => !personId || t.personId === personId)
        .filter((t) => !categoryId || t.categoryId === categoryId)
        .filter((t) => !cardId || t.cardId === cardId)
        .sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id),
    createTransaction: async (input) => {
      repo.calls.push("createTransaction");
      const created = withDefaults(input, nextTransactionId++);
      transactions.push(created);
      return created;
    },
    updateTransaction: async (id, input) => {
      repo.calls.push("updateTransaction");
      transactions = transactions.map((t) => (t.id === id ? withDefaults(input, id) : t));
      return transactions.find((t) => t.id === id)!;
    },
    deleteTransaction: async (id) => {
      repo.calls.push("deleteTransaction");
      transactions = transactions.filter((t) => t.id !== id);
    },
    listCards: async () => cardRows.filter((c) => !c.archived).map(cardDto),
    createCard: async (input) => {
      repo.calls.push("createCard");
      if (cardRows.some((c) => !c.archived && c.name.toLowerCase() === input.name.toLowerCase())) {
        throw new ApiError(409, ["card_name_taken"]);
      }
      const row = { id: nextCardId++, name: input.name, limitCents: input.limitCents, archived: false };
      cardRows.push(row);
      cycleRules.push({ cardId: row.id, fromMonth: ALWAYS_FROM, closingDay: input.closingDay, dueDay: input.dueDay });
      return cardDto(row);
    },
    updateCard: async (id, patch) => {
      cardRows = cardRows.map((c) => (c.id === id ? { ...c, ...patch } : c));
      return cardDto(cardRows.find((c) => c.id === id)!);
    },
    setCardRule: async (cardId, rule) => {
      repo.calls.push("setCardRule");
      if (rule.fromMonth < statementMonthFor(rulesOf(cardId), today())) throw new ApiError(422, ["rule_in_past"]);
      const existing = cycleRules.find((r) => r.cardId === cardId && r.fromMonth === rule.fromMonth);
      if (existing) Object.assign(existing, rule);
      else cycleRules.push({ cardId, ...rule });
    },
    getStatement: async (cardId, month) => statementFor(cardId, month ?? statementMonthFor(rulesOf(cardId), today())),
    payStatement: async (cardId, month, input) => {
      repo.calls.push("payStatement");
      const card = cardRows.find((c) => c.id === cardId)!;
      if (statementFor(cardId, month).totalCents <= 0) throw new ApiError(422, ["statement_empty"]);
      const base = {
        date: input.date, accountId: input.accountId, toAccountId: null, categoryId: null, cardId, statementMonth: month,
        status: "settled" as const, personId: input.personId, adjustment: false,
      };
      transactions.push({ ...base, id: nextTransactionId++, kind: "transfer", amountCents: input.amountCents, feeKind: null, description: `${card.name} ${month}` });
      if (input.interestCents > 0) transactions.push({ ...base, id: nextTransactionId++, kind: "expense", amountCents: input.interestCents, feeKind: "interest", description: "interest" });
      if (input.fineCents > 0) transactions.push({ ...base, id: nextTransactionId++, kind: "expense", amountCents: input.fineCents, feeKind: "fine", description: "fine" });
      return statementFor(cardId, month);
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
  seed.cards?.forEach((c) => {
    const row = { id: nextCardId++, name: c.name, limitCents: c.limitCents, archived: false };
    cardRows.push(row);
    cycleRules.push({ cardId: row.id, fromMonth: ALWAYS_FROM, closingDay: c.closingDay, dueDay: c.dueDay });
  });
  seed.accounts?.forEach((a) => {
    const account = { ...a, id: nextAccountId++, archived: false };
    accounts.push(account);
  });
  seed.transactions?.forEach((t) => transactions.push(withDefaults(t, nextTransactionId++)));
  return repo;
}
