import { addDays, addMonthsToDate } from "./dates";
import { Money } from "./money";
import { isValidIsoDate } from "./transaction";

export const FREQUENCIES = ["weekly", "monthly", "yearly"] as const;
export type Frequency = (typeof FREQUENCIES)[number];

export interface RecurringRule {
  id: number;
  kind: "income" | "expense";
  amount: Money;
  description: string;
  accountId: number | null;
  cardId: number | null;
  categoryId: number | null;
  personId: number;
  frequency: Frequency;
  startDate: string;
  endDate: string | null;
  /** Index of the next occurrence that has not been posted yet. */
  nextIndex: number;
  active: boolean;
}

/** Safety net so a long outage cannot post an unbounded number of transactions at once. */
export const MAX_POSTINGS_PER_CALL = 500;

/** Date of occurrence `index` (0-based), always computed from the start so the day of the month never drifts. */
export function occurrenceDate(startDate: string, frequency: Frequency, index: number): string {
  if (frequency === "weekly") return addDays(startDate, 7 * index);
  return addMonthsToDate(startDate, frequency === "monthly" ? index : 12 * index);
}

const dayNumber = (date: string) => Math.floor(Date.parse(`${date}T00:00:00Z`) / 86_400_000);
const monthNumber = (date: string) => Number(date.slice(0, 4)) * 12 + Number(date.slice(5, 7)) - 1;

/** First occurrence on or after `date`. Past occurrences are skipped on purpose: rules never backfill. */
export function firstIndexOnOrAfter(startDate: string, frequency: Frequency, date: string): number {
  if (startDate >= date) return 0;
  const estimate =
    frequency === "weekly"
      ? Math.floor((dayNumber(date) - dayNumber(startDate)) / 7)
      : Math.floor((monthNumber(date) - monthNumber(startDate)) / (frequency === "monthly" ? 1 : 12));
  let index = Math.max(0, estimate - 1);
  while (occurrenceDate(startDate, frequency, index) < date) index++;
  return index;
}

const withinEnd = (rule: RecurringRule, date: string) => rule.endDate === null || date <= rule.endDate;

/** Occurrences that should already have been posted (date reached) and were not. */
export function dueOccurrences(rule: RecurringRule, today: string): { index: number; date: string }[] {
  if (!rule.active) return [];
  const due: { index: number; date: string }[] = [];
  for (let index = rule.nextIndex; due.length < MAX_POSTINGS_PER_CALL; index++) {
    const date = occurrenceDate(rule.startDate, rule.frequency, index);
    if (date > today || !withinEnd(rule, date)) break;
    due.push({ index, date });
  }
  return due;
}

/** Future occurrences in `[from, to]`, starting from the next one to post. Used by the forecast. */
export function occurrencesBetween(rule: RecurringRule, from: string, to: string): string[] {
  if (!rule.active) return [];
  const dates: string[] = [];
  for (let index = rule.nextIndex; index < rule.nextIndex + 10_000; index++) {
    const date = occurrenceDate(rule.startDate, rule.frequency, index);
    if (date > to || !withinEnd(rule, date)) break;
    if (date >= from) dates.push(date);
  }
  return dates;
}

export type RecurringError =
  | "amount_must_be_positive"
  | "invalid_date"
  | "end_before_start"
  | "recurring_source_required"
  | "recurring_single_source"
  | "recurring_income_needs_account";

export function validateRecurring(input: {
  kind: "income" | "expense";
  amount: Money;
  frequency: Frequency;
  startDate: string;
  endDate: string | null;
  accountId: number | null;
  cardId: number | null;
}): RecurringError[] {
  const errors: RecurringError[] = [];
  if (input.amount.cents <= 0) errors.push("amount_must_be_positive");
  const startOk = isValidIsoDate(input.startDate);
  if (!startOk) errors.push("invalid_date");
  if (input.endDate !== null) {
    if (!isValidIsoDate(input.endDate)) {
      if (!errors.includes("invalid_date")) errors.push("invalid_date");
    } else if (startOk && input.endDate < input.startDate) errors.push("end_before_start");
  }
  if (input.accountId === null && input.cardId === null) errors.push("recurring_source_required");
  else if (input.accountId !== null && input.cardId !== null) errors.push("recurring_single_source");
  else if (input.kind === "income" && input.cardId !== null) errors.push("recurring_income_needs_account");
  return errors;
}

