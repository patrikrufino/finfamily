import { buildStatement, statementMonthFor, type Card, type CycleRule } from "./card";
import { addDays, addMonths, isoDate, monthOf } from "./dates";
import { occurrencesBetween, type RecurringRule } from "./recurring";
import type { Transaction } from "./transaction";

export interface MonthSummary {
  incomeCents: number;
  expenseCents: number;
  resultCents: number;
}

/**
 * What came in and went out in a month. Settled transactions only; transfers (including card payments) and balance adjustments
 * are not income or expense. Card purchases count on their purchase date.
 */
export function monthSummary(transactions: readonly Transaction[], month: string): MonthSummary {
  let incomeCents = 0;
  let expenseCents = 0;
  for (const t of transactions) {
    if (t.status !== "settled" || t.adjustment || monthOf(t.date) !== month) continue;
    if (t.kind === "income") incomeCents += t.amount.cents;
    else if (t.kind === "expense") expenseCents += t.amount.cents;
  }
  return { incomeCents, expenseCents, resultCents: incomeCents - expenseCents };
}

export interface ForecastInput {
  today: string;
  months: number;
  /** Current settled balance across the accounts. */
  startingBalanceCents: number;
  transactions: readonly Transaction[];
  cards: readonly Card[];
  cycleRules: readonly CycleRule[];
  recurring: readonly RecurringRule[];
}

export interface ForecastMonth {
  month: string;
  incomeCents: number;
  expenseCents: number;
  /** Credit card statements leaving the account (on their due date). */
  cardPaymentsCents: number;
  netCents: number;
  endBalanceCents: number;
}

/**
 * Cash-flow projection from today: scheduled and recurring income/expenses on accounts, plus the unpaid part of every card
 * statement on its due date. The current month only covers what is still ahead.
 */
export function buildForecast(input: ForecastInput): ForecastMonth[] {
  const { today, months } = input;
  const current = monthOf(today);
  const monthList = Array.from({ length: months }, (_, i) => addMonths(current, i));
  const horizonEnd = isoDate(monthList[monthList.length - 1] ?? current, 31);
  const tomorrow = addDays(today, 1);

  const buckets = new Map(monthList.map((m) => [m, { income: 0, expense: 0, card: 0 }]));
  /** Overdue items fall in the current month; anything past the horizon is ignored. */
  const bucketFor = (date: string) => buckets.get(date <= today ? current : monthOf(date));

  for (const t of input.transactions) {
    if (t.status !== "scheduled" || t.accountId === null || t.adjustment) continue;
    if (t.kind !== "income" && t.kind !== "expense") continue;
    const bucket = bucketFor(t.date);
    if (!bucket) continue;
    if (t.kind === "income") bucket.income += t.amount.cents;
    else bucket.expense += t.amount.cents;
  }

  for (const rule of input.recurring) {
    if (rule.accountId === null) continue;
    for (const date of occurrencesBetween(rule, tomorrow, horizonEnd)) {
      const bucket = bucketFor(date);
      if (!bucket) continue;
      if (rule.kind === "income") bucket.income += rule.amount.cents;
      else bucket.expense += rule.amount.cents;
    }
  }

  let virtualId = -1;
  for (const card of input.cards) {
    const rules = input.cycleRules.filter((r) => r.cardId === card.id);
    if (rules.length === 0) continue;
    const virtual: Transaction[] = input.recurring
      .filter((r) => r.cardId === card.id && r.kind === "expense")
      .flatMap((r) =>
        occurrencesBetween(r, tomorrow, horizonEnd).map((date) => ({
          id: virtualId--, kind: "expense" as const, amount: r.amount, date, accountId: null, toAccountId: null,
          categoryId: r.categoryId, cardId: card.id, description: r.description, status: "scheduled" as const, personId: r.personId,
        })),
      );
    const all = [...input.transactions, ...virtual];
    const statementMonths = new Set(
      all.filter((t) => t.cardId === card.id && t.kind === "expense" && t.accountId === null).map((t) => statementMonthFor(rules, t.date)),
    );
    for (const month of statementMonths) {
      const statement = buildStatement(card, rules, all, month, today);
      if (statement.remainingCents <= 0) continue;
      const bucket = bucketFor(statement.dueDate);
      if (bucket) bucket.card += statement.remainingCents;
    }
  }

  let balance = input.startingBalanceCents;
  return monthList.map((month) => {
    const b = buckets.get(month)!;
    const netCents = b.income - b.expense - b.card;
    balance += netCents;
    return { month, incomeCents: b.income, expenseCents: b.expense, cardPaymentsCents: b.card, netCents, endBalanceCents: balance };
  });
}

