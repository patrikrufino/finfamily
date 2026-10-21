import { addDays, addMonths, isoDate, monthOf } from "./dates";
import { Money } from "./money";
import type { Transaction } from "./transaction";

export interface Card {
  id: number;
  name: string;
  limit: Money;
  archived: boolean;
}

/** Closing/due days that apply to statements from `fromMonth` onward. */
export interface CycleRule {
  cardId: number;
  fromMonth: string;
  closingDay: number;
  dueDay: number;
}

/** Initial rules start at this month so they apply to every statement. */
export const ALWAYS_FROM = "0000-01";

export function ruleForMonth(rules: readonly CycleRule[], month: string): CycleRule {
  const sorted = [...rules].sort((a, b) => a.fromMonth.localeCompare(b.fromMonth));
  const applicable = sorted.filter((r) => r.fromMonth <= month);
  const rule = applicable[applicable.length - 1] ?? sorted[0];
  if (!rule) throw new RangeError("A card needs at least one cycle rule");
  return rule;
}

export function closingDate(rules: readonly CycleRule[], month: string): string {
  return isoDate(month, ruleForMonth(rules, month).closingDay);
}

export function dueDate(rules: readonly CycleRule[], month: string): string {
  const rule = ruleForMonth(rules, month);
  const dueMonth = rule.dueDay > rule.closingDay ? month : addMonths(month, 1);
  return isoDate(dueMonth, rule.dueDay);
}

/** The statement a purchase date belongs to. The closing day itself is part of the current statement. */
export function statementMonthFor(rules: readonly CycleRule[], date: string): string {
  const month = monthOf(date);
  return date <= closingDate(rules, month) ? month : addMonths(month, 1);
}

export function statementPeriod(rules: readonly CycleRule[], month: string): { start: string; end: string } {
  return { start: addDays(closingDate(rules, addMonths(month, -1)), 1), end: closingDate(rules, month) };
}

export type StatementStatus = "open" | "closed" | "paid";

export interface Statement {
  cardId: number;
  month: string;
  start: string;
  end: string;
  dueDate: string;
  totalCents: number;
  paidCents: number;
  feesCents: number;
  remainingCents: number;
  status: StatementStatus;
  purchases: Transaction[];
  payments: Transaction[];
  fees: Transaction[];
}

const cardOf = (t: Transaction) => t.cardId ?? null;
const isPurchase = (t: Transaction) => t.kind === "expense" && t.accountId === null && cardOf(t) !== null;
const isPayment = (t: Transaction) => t.kind === "transfer" && cardOf(t) !== null;
const isFee = (t: Transaction) => t.kind === "expense" && t.accountId !== null && cardOf(t) !== null && !!t.feeKind;
const sum = (txs: readonly Transaction[]) => txs.reduce((s, t) => s + t.amount.cents, 0);

export function buildStatement(
  card: Card,
  rules: readonly CycleRule[],
  transactions: readonly Transaction[],
  month: string,
  today: string,
): Statement {
  const mine = transactions.filter((t) => cardOf(t) === card.id);
  const purchases = mine.filter((t) => isPurchase(t) && statementMonthFor(rules, t.date) === month);
  const payments = mine.filter((t) => isPayment(t) && t.statementMonth === month);
  const fees = mine.filter((t) => isFee(t) && t.statementMonth === month);
  const { start, end } = statementPeriod(rules, month);
  const totalCents = sum(purchases);
  const paidCents = sum(payments);
  const remainingCents = totalCents - paidCents;
  const status: StatementStatus = today <= end ? "open" : remainingCents <= 0 ? "paid" : "closed";
  return {
    cardId: card.id, month, start, end, dueDate: dueDate(rules, month),
    totalCents, paidCents, feesCents: sum(fees), remainingCents, status, purchases, payments, fees,
  };
}

export function cardUsage(card: Card, transactions: readonly Transaction[]) {
  const mine = transactions.filter((t) => cardOf(t) === card.id);
  const usedCents = sum(mine.filter(isPurchase)) - sum(mine.filter(isPayment));
  return { limitCents: card.limit.cents, usedCents, availableCents: card.limit.subtract(Money.fromCents(usedCents)).cents };
}
