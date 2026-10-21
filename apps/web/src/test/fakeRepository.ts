import {
  ALWAYS_FROM,
  DEFAULT_CATEGORIES,
  accountBalance,
  balanceAdjustment,
  budgetForMonth,
  budgetProgress,
  buildForecast,
  buildInstallmentSchedule,
  buildStatement,
  canRemoveEntry,
  cardUsage,
  debtLedger,
  dueOccurrences,
  firstIndexOnOrAfter,
  installmentStatusFor,
  isAnticipable,
  monthSummary,
  occurrenceDate,
  Money,
  planProgress,
  ruleForMonth,
  statementMonthFor,
  summarizeDebt,
  validateAnticipation,
  validateDebtDiscount,
  validateDebtInterest,
  validateDebtPayment,
  validateRecurring,
  validateInstallmentPlan,
  type Account,
  type BudgetEntry,
  type CycleRule,
  type RecurringRule,
  type Debt,
  type DebtEntry,
  type Transaction,
} from "@finfamily/domain";
import {
  ApiError,
  type AccountDto,
  type BackupInfoDto,
  type CardDto,
  type CategoryDto,
  type DashboardDto,
  type DebtDetailDto,
  type DebtDto,
  type NewCard,
  type NewCategory,
  type NewPlan,
  type PlanDetailDto,
  type NewRecurring,
  type PlanDto,
  type RecurringDto,
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
    recurring?: NewRecurring[];
    /** Set to false to simulate a server without backups (the default is enabled and empty). */
    backups?: boolean | BackupInfoDto[];
    /** Overrides parts of the computed dashboard (for scenarios the fake does not model, like card statements due). */
    dashboard?: Partial<DashboardDto>;
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
  let debtRows: { id: number; creditor: string; originalCents: number; openedOn: string; categoryId: number | null; personId: number }[] = [];
  let debtEntryRows: { id: number; debtId: number; kind: "interest" | "discount"; amountCents: number; date: string; note: string }[] = [];
  let recurringRules: RecurringRule[] = [];
  let nextRecurringId = 1;
  const backupList: BackupInfoDto[] = Array.isArray(seed.backups) ? [...seed.backups] : [];
  let nextDebtId = 1;
  let nextEntryId = 1;
  let plans: (NewPlan & { id: number })[] = [];
  let nextPlanId = 1;
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
    cardId: null, statementMonth: null, feeKind: null, adjustment: false, planId: null, installmentNumber: null, debtId: null, recurringId: null, ...input, id,
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

  const toDebt = (d: (typeof debtRows)[number]): Debt => ({ id: d.id, creditor: d.creditor, original: Money.fromCents(d.originalCents), openedOn: d.openedOn });
  const entriesOfDebt = (id: number): DebtEntry[] =>
    debtEntryRows.filter((e) => e.debtId === id).map((e) => ({ ...e, amount: Money.fromCents(e.amountCents) }));
  const debtSummary = (d: (typeof debtRows)[number]): DebtDto => ({
    id: d.id, creditor: d.creditor, openedOn: d.openedOn, categoryId: d.categoryId, personId: d.personId,
    ...summarizeDebt(toDebt(d), entriesOfDebt(d.id), transactions.map(toDomainTx)),
  });
  const debtDetail = (d: (typeof debtRows)[number]): DebtDetailDto => ({
    ...debtSummary(d), ledger: debtLedger(toDebt(d), entriesOfDebt(d.id), transactions.map(toDomainTx)),
  });
  const debtBalance = (d: (typeof debtRows)[number]) => Money.fromCents(debtSummary(d).balanceCents);

  const recurringDto = (r: RecurringRule): RecurringDto => {
    const nextDate = occurrenceDate(r.startDate, r.frequency, r.nextIndex);
    const ended = r.endDate !== null && nextDate > r.endDate;
    return {
      id: r.id, kind: r.kind, amountCents: r.amount.cents, description: r.description, accountId: r.accountId, cardId: r.cardId,
      categoryId: r.categoryId, personId: r.personId, frequency: r.frequency, startDate: r.startDate, endDate: r.endDate,
      active: r.active, nextDate, postedCount: transactions.filter((t) => t.recurringId === r.id).length,
      status: ended ? "ended" : r.active ? "active" : "paused",
    };
  };
  const postDueRecurring = () => {
    for (const rule of recurringRules) {
      const due = dueOccurrences(rule, today());
      for (const o of due) {
        transactions.push(withDefaults({
          kind: rule.kind, amountCents: rule.amount.cents, date: o.date, accountId: rule.accountId, cardId: rule.cardId,
          toAccountId: null, categoryId: rule.categoryId, description: rule.description, status: "settled",
          personId: rule.personId, recurringId: rule.id,
        }, nextTransactionId++));
      }
      const last = due[due.length - 1];
      if (last) rule.nextIndex = last.index + 1;
    }
  };

  const planSummary = (p: (typeof plans)[number]): PlanDto => {
    const progress = planProgress(transactions.filter((t) => t.planId === p.id).map(toDomainTx));
    return { ...p, ...progress, status: progress.remainingCount > 0 ? "active" : "done" };
  };
  const planDetail = (p: (typeof plans)[number]): PlanDetailDto => ({
    ...planSummary(p),
    installments: transactions
      .filter((t) => t.planId === p.id)
      .sort((a, b) => (a.installmentNumber ?? 1e9) - (b.installmentNumber ?? 1e9) || a.date.localeCompare(b.date))
      .map((t) => ({ ...t, anticipable: isAnticipable(toDomainTx(t), today()) })),
  });

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
      // Like the API, an update never changes the plan link or the adjustment flag.
      transactions = transactions.map((t) =>
        t.id === id ? withDefaults({ ...input, planId: t.planId, installmentNumber: t.installmentNumber, adjustment: t.adjustment, debtId: t.debtId, recurringId: t.recurringId }, id) : t,
      );
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
        status: "settled" as const, personId: input.personId, adjustment: false, planId: null, installmentNumber: null, debtId: null, recurringId: null,
      };
      transactions.push({ ...base, id: nextTransactionId++, kind: "transfer", amountCents: input.amountCents, feeKind: null, description: `${card.name} ${month}` });
      if (input.interestCents > 0) transactions.push({ ...base, id: nextTransactionId++, kind: "expense", amountCents: input.interestCents, feeKind: "interest", description: "interest" });
      if (input.fineCents > 0) transactions.push({ ...base, id: nextTransactionId++, kind: "expense", amountCents: input.fineCents, feeKind: "fine", description: "fine" });
      return statementFor(cardId, month);
    },
    getBackupStatus: async () =>
      seed.backups === false
        ? null
        : { backups: [...backupList].reverse(), lastBackupAt: backupList[backupList.length - 1]?.createdAt ?? null, schedule: { intervalHours: 24, keep: 14 } },
    createBackup: async () => {
      repo.calls.push("createBackup");
      const info = { name: `finfamily-20261021-1000${String(backupList.length).padStart(2, "0")}.db`, sizeBytes: 81920, createdAt: new Date().toISOString() };
      backupList.push(info);
      return info;
    },
    getDashboard: async () => {
      const txs = transactions.map(toDomainTx);
      const accountDtos = accounts.filter((a) => !a.archived).map(toAccountDto);
      const balanceCents = accountDtos.reduce((sum, a) => sum + a.balanceCents, 0);
      const month = today().slice(0, 7);
      const budget = await repo.getBudget(month);
      const forecast = buildForecast({
        today: today(), months: 6, startingBalanceCents: balanceCents, transactions: txs,
        cards: cardRows.map(domainCard), cycleRules, recurring: recurringRules,
      });
      const open = debtRows.map(debtSummary).filter((d) => d.status === "open");
      const dashboard: DashboardDto = {
        today: today(), month, balanceCents, projectedEndOfMonthCents: forecast[0]?.endBalanceCents ?? balanceCents,
        monthSummary: monthSummary(txs, month),
        budget: {
          totals: budget.totals,
          highlights: budget.categories.filter((c) => c.status === "warning" || c.status === "over")
            .map(({ categoryId, name, icon, status, ratio, budgetCents, spentCents, remainingCents }) => ({ categoryId, name, icon, status, ratio, budgetCents, spentCents, remainingCents })),
        },
        cardsDue: [], debts: { totalOwedCents: open.reduce((s2, d) => s2 + d.balanceCents, 0), openCount: open.length },
        installments: { committedThisMonthCents: 0, activePlans: plans.length }, forecast,
      };
      return { ...dashboard, ...seed.dashboard };
    },
    listRecurring: async () => recurringRules.map(recurringDto),
    createRecurring: async (input) => {
      repo.calls.push("createRecurring");
      const errors = validateRecurring({
        kind: input.kind, amount: Money.fromCents(input.amountCents), frequency: input.frequency, startDate: input.startDate,
        endDate: input.endDate, accountId: input.accountId, cardId: input.cardId,
      });
      if (errors.length) throw new ApiError(422, errors);
      const rule: RecurringRule = {
        id: nextRecurringId++, kind: input.kind, amount: Money.fromCents(input.amountCents), description: input.description,
        accountId: input.accountId, cardId: input.cardId, categoryId: input.categoryId, personId: input.personId,
        frequency: input.frequency, startDate: input.startDate, endDate: input.endDate,
        nextIndex: firstIndexOnOrAfter(input.startDate, input.frequency, today()), active: true,
      };
      recurringRules.push(rule);
      postDueRecurring();
      return recurringDto(rule);
    },
    updateRecurring: async (id, patch) => {
      repo.calls.push("updateRecurring");
      const rule = recurringRules.find((r) => r.id === id)!;
      if (patch.amountCents !== undefined) rule.amount = Money.fromCents(patch.amountCents);
      if (patch.description !== undefined) rule.description = patch.description;
      if (patch.categoryId !== undefined) rule.categoryId = patch.categoryId;
      if (patch.endDate !== undefined) rule.endDate = patch.endDate;
      if (patch.active !== undefined) {
        if (patch.active && !rule.active) rule.nextIndex = Math.max(rule.nextIndex, firstIndexOnOrAfter(rule.startDate, rule.frequency, today()));
        rule.active = patch.active;
      }
      return recurringDto(rule);
    },
    deleteRecurring: async (id) => {
      repo.calls.push("deleteRecurring");
      if (transactions.some((t) => t.recurringId === id)) throw new ApiError(422, ["rule_has_postings"]);
      recurringRules = recurringRules.filter((r) => r.id !== id);
    },
    listDebts: async () =>
      debtRows.map(debtSummary).sort((a, b) => Number(b.status === "open") - Number(a.status === "open") || a.creditor.localeCompare(b.creditor)),
    getDebt: async (id) => debtDetail(debtRows.find((d) => d.id === id)!),
    createDebt: async (input) => {
      repo.calls.push("createDebt");
      const row = { id: nextDebtId++, creditor: input.creditor, originalCents: input.originalCents, openedOn: input.openedOn ?? today(), categoryId: input.categoryId, personId: input.personId };
      debtRows.push(row);
      return debtDetail(row);
    },
    addDebtInterest: async (id, input) => {
      repo.calls.push("addDebtInterest");
      const errors = validateDebtInterest(Money.fromCents(input.amountCents), input.date);
      if (errors.length) throw new ApiError(422, errors);
      debtEntryRows.push({ id: nextEntryId++, debtId: id, kind: "interest", amountCents: input.amountCents, date: input.date, note: input.note });
      return debtDetail(debtRows.find((d) => d.id === id)!);
    },
    addDebtDiscount: async (id, input) => {
      repo.calls.push("addDebtDiscount");
      const d = debtRows.find((x) => x.id === id)!;
      const errors = validateDebtDiscount(debtBalance(d), Money.fromCents(input.amountCents), input.date);
      if (errors.length) throw new ApiError(422, errors);
      debtEntryRows.push({ id: nextEntryId++, debtId: id, kind: "discount", amountCents: input.amountCents, date: input.date, note: input.note });
      return debtDetail(d);
    },
    payDebt: async (id, input) => {
      repo.calls.push("payDebt");
      const d = debtRows.find((x) => x.id === id)!;
      const errors = validateDebtPayment(debtBalance(d), Money.fromCents(input.amountCents), input.date, today());
      if (errors.length) throw new ApiError(422, errors);
      transactions.push(withDefaults({
        kind: "expense", amountCents: input.amountCents, date: input.date, accountId: input.accountId, toAccountId: null,
        categoryId: input.categoryId ?? d.categoryId, description: `Pagamento · ${d.creditor}`, status: "settled",
        personId: input.personId, debtId: id,
      }, nextTransactionId++));
      return debtDetail(d);
    },
    removeDebtEntry: async (debtId, entryId) => {
      repo.calls.push("removeDebtEntry");
      const d = debtRows.find((x) => x.id === debtId)!;
      if (!canRemoveEntry(toDebt(d), entriesOfDebt(debtId), transactions.map(toDomainTx), entryId)) {
        throw new ApiError(422, ["balance_would_be_negative"]);
      }
      debtEntryRows = debtEntryRows.filter((e) => e.id !== entryId);
    },
    deleteDebt: async (id) => {
      repo.calls.push("deleteDebt");
      if (transactions.some((t) => t.debtId === id)) throw new ApiError(422, ["debt_has_payments"]);
      debtEntryRows = debtEntryRows.filter((e) => e.debtId !== id);
      debtRows = debtRows.filter((d) => d.id !== id);
    },
    listPlans: async () => plans.map(planSummary),
    getPlan: async (id) => planDetail(plans.find((p) => p.id === id)!),
    createPlan: async (input) => {
      repo.calls.push("createPlan");
      const errors = validateInstallmentPlan({
        total: Money.fromCents(input.totalCents), count: input.count, firstDate: input.firstDate,
        accountId: input.accountId, cardId: input.cardId,
      });
      if (errors.length) throw new ApiError(422, errors);
      const plan = { ...input, id: nextPlanId++ };
      plans.push(plan);
      for (const item of buildInstallmentSchedule(Money.fromCents(input.totalCents), input.count, input.firstDate)) {
        transactions.push(withDefaults({
          kind: "expense", amountCents: item.amount.cents, date: item.date, accountId: input.accountId, cardId: input.cardId,
          toAccountId: null, categoryId: input.categoryId, description: input.description,
          status: installmentStatusFor(item.date, today()), personId: input.personId, planId: plan.id, installmentNumber: item.number,
        }, nextTransactionId++));
      }
      return planDetail(plan);
    },
    anticipatePlan: async (id, input) => {
      repo.calls.push("anticipatePlan");
      const plan = plans.find((p) => p.id === id)!;
      const errors = validateAnticipation(
        transactions.filter((t) => t.planId === id).map(toDomainTx), input.installmentIds, Money.fromCents(input.amountCents), today(),
      );
      if (errors.length) throw new ApiError(422, errors);
      transactions = transactions.filter((t) => !input.installmentIds.includes(t.id));
      transactions.push(withDefaults({
        kind: "expense", amountCents: input.amountCents, date: input.date, accountId: plan.accountId, cardId: plan.cardId,
        toAccountId: null, categoryId: plan.categoryId, description: `Antecipação · ${plan.description}`,
        status: installmentStatusFor(input.date, today()), personId: plan.personId, planId: id, installmentNumber: null,
      }, nextTransactionId++));
      return planDetail(plan);
    },
    cancelPlan: async (id) => {
      repo.calls.push("cancelPlan");
      transactions = transactions.filter((t) => !(t.planId === id && t.status === "scheduled"));
      if (!transactions.some((t) => t.planId === id)) plans = plans.filter((p) => p.id !== id);
    },
    listCategories: async () => categories.filter((c) => !c.archived),
    createCategory: async (input) => {
      repo.calls.push("createCategory");
      if (categories.some((c) => !c.archived && c.kind === input.kind && c.name.toLowerCase() === input.name.toLowerCase())) {
        throw new ApiError(409, ["category_name_taken"]);
      }
      const category: CategoryDto = { name: input.name, kind: input.kind, icon: input.icon ?? null, id: nextCategoryId++, archived: false };
      categories.push(category);
      return category;
    },
    updateCategory: async (id, patch) => {
      repo.calls.push("updateCategory");
      const current = categories.find((c) => c.id === id)!;
      const next = { ...current, ...patch };
      if (!next.archived && categories.some((c) => c.id !== id && !c.archived && c.kind === current.kind && c.name.toLowerCase() === next.name.toLowerCase())) {
        throw new ApiError(409, ["category_name_taken"]);
      }
      categories = categories.map((c) => (c.id === id ? next : c));
      return next;
    },
    addDefaultCategories: async () => {
      repo.calls.push("addDefaultCategories");
      const missing = DEFAULT_CATEGORIES.filter((d) => !categories.some((c) => c.kind === d.kind && c.name.toLowerCase() === d.name.toLowerCase()));
      for (const d of missing) categories.push({ id: nextCategoryId++, name: d.name, kind: d.kind, icon: d.icon, archived: false });
      return { created: missing.length };
    },
    setBudget: async (categoryId, month, amountCents) => {
      repo.calls.push("setBudget");
      if (categories.find((c) => c.id === categoryId)?.kind !== "expense") throw new ApiError(422, ["budget_only_for_expense"]);
      const existing = budgetEntries.find((e) => e.categoryId === categoryId && e.fromMonth === month);
      if (existing) existing.amount = Money.fromCents(amountCents);
      else budgetEntries.push({ categoryId, fromMonth: month, amount: Money.fromCents(amountCents) });
    },
    getBudget: async (month) => {
      const inMonth = transactions.filter((t) => t.kind === "expense" && t.date.startsWith(`${month}-`));
      const sum = (categoryId: number | null, status: string) =>
        inMonth.filter((t) => t.categoryId === categoryId && t.status === status).reduce((s, t) => s + t.amountCents, 0);
      const rows = categories.filter((c) => !c.archived && c.kind === "expense").map((c) => {
        const p = budgetProgress(
          budgetForMonth(budgetEntries, c.id, month),
          Money.fromCents(sum(c.id, "settled")),
          Money.fromCents(sum(c.id, "scheduled")),
        );
        return {
          categoryId: c.id, name: c.name, kind: c.kind, icon: c.icon, archived: c.archived,
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

  seed.categories?.forEach((c) => categories.push({ name: c.name, kind: c.kind, icon: c.icon ?? null, id: nextCategoryId++, archived: false }));
  seed.cards?.forEach((c) => {
    const row = { id: nextCardId++, name: c.name, limitCents: c.limitCents, archived: false };
    cardRows.push(row);
    cycleRules.push({ cardId: row.id, fromMonth: ALWAYS_FROM, closingDay: c.closingDay, dueDay: c.dueDay });
  });
  seed.recurring?.forEach((r) => {
    recurringRules.push({
      id: nextRecurringId++, kind: r.kind, amount: Money.fromCents(r.amountCents), description: r.description, accountId: r.accountId,
      cardId: r.cardId, categoryId: r.categoryId, personId: r.personId, frequency: r.frequency, startDate: r.startDate,
      endDate: r.endDate, nextIndex: firstIndexOnOrAfter(r.startDate, r.frequency, today()), active: true,
    });
  });
  seed.accounts?.forEach((a) => {
    const account = { ...a, id: nextAccountId++, archived: false };
    accounts.push(account);
  });
  seed.transactions?.forEach((t) => transactions.push(withDefaults(t, nextTransactionId++)));
  postDueRecurring();
  return repo;
}
