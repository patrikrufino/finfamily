import { addMonthsToDate } from "./dates";
import { Money } from "./money";
import { isValidIsoDate, type Transaction, type TransactionStatus } from "./transaction";

export const MIN_INSTALLMENTS = 2;
export const MAX_INSTALLMENTS = 120;

export interface InstallmentScheduleItem {
  number: number;
  date: string;
  amount: Money;
}

/** Equal installments (remainder cents on the last one), monthly, keeping the day of the month. */
export function buildInstallmentSchedule(total: Money, count: number, firstDate: string): InstallmentScheduleItem[] {
  return total.split(count).map((amount, i) => ({ number: i + 1, date: addMonthsToDate(firstDate, i), amount }));
}

export type InstallmentError =
  | "installment_count_invalid"
  | "amount_must_be_positive"
  | "amount_too_small"
  | "invalid_date"
  | "installment_source_required"
  | "installment_single_source";

export interface InstallmentPlanInput {
  total: Money;
  count: number;
  firstDate: string;
  accountId: number | null;
  cardId: number | null;
}

export function validateInstallmentPlan(input: InstallmentPlanInput): InstallmentError[] {
  const errors: InstallmentError[] = [];
  const countOk = Number.isInteger(input.count) && input.count >= MIN_INSTALLMENTS && input.count <= MAX_INSTALLMENTS;
  if (!countOk) errors.push("installment_count_invalid");
  if (input.total.cents <= 0) errors.push("amount_must_be_positive");
  else if (countOk && input.total.cents < input.count) errors.push("amount_too_small");
  if (!isValidIsoDate(input.firstDate)) errors.push("invalid_date");
  if (input.accountId === null && input.cardId === null) errors.push("installment_source_required");
  else if (input.accountId !== null && input.cardId !== null) errors.push("installment_single_source");
  return errors;
}

/** Installments whose date has arrived are settled; the others stay scheduled. */
export function installmentStatusFor(date: string, today: string): TransactionStatus {
  return date <= today ? "settled" : "scheduled";
}

const planOf = (t: Transaction) => t.planId ?? null;
const numberOf = (t: Transaction) => t.installmentNumber ?? null;

/** Only real installments that are still scheduled and dated after today can be anticipated. */
export function isAnticipable(t: Transaction, today: string): boolean {
  return planOf(t) !== null && numberOf(t) !== null && t.status === "scheduled" && t.date > today;
}

export function anticipationSummary(picked: readonly Transaction[], paid: Money) {
  const nominal = picked.reduce((sum, t) => sum.add(t.amount), Money.zero());
  return { nominal, paid, saving: nominal.subtract(paid) };
}

export type AnticipationError =
  | "nothing_to_anticipate"
  | "installment_not_anticipable"
  | "amount_must_be_positive"
  | "anticipation_above_nominal";

/** `installments` are the plan's transactions; `ids` the ones the user picked. */
export function validateAnticipation(
  installments: readonly Transaction[],
  ids: readonly number[],
  paid: Money,
  today: string,
): AnticipationError[] {
  if (ids.length === 0) return ["nothing_to_anticipate"];
  const picked = ids.map((id) => installments.find((t) => t.id === id));
  if (picked.some((t) => !t || !isAnticipable(t, today))) return ["installment_not_anticipable"];
  const errors: AnticipationError[] = [];
  if (paid.cents <= 0) errors.push("amount_must_be_positive");
  else if (paid.cents > anticipationSummary(picked as Transaction[], paid).nominal.cents) errors.push("anticipation_above_nominal");
  return errors;
}

export interface PlanProgress {
  paidCount: number;
  remainingCount: number;
  paidCents: number;
  remainingCents: number;
  nextDate: string | null;
  nextCents: number | null;
}

/** `items` are all the transactions of a plan (installments and anticipations). */
export function planProgress(items: readonly Transaction[]): PlanProgress {
  const settled = items.filter((t) => t.status === "settled");
  const scheduled = items.filter((t) => t.status === "scheduled");
  const sum = (list: readonly Transaction[]) => list.reduce((s, t) => s + t.amount.cents, 0);
  const next = scheduled
    .filter((t) => numberOf(t) !== null)
    .sort((a, b) => a.date.localeCompare(b.date) || (numberOf(a) ?? 0) - (numberOf(b) ?? 0))[0];
  return {
    paidCount: settled.filter((t) => numberOf(t) !== null).length,
    remainingCount: scheduled.filter((t) => numberOf(t) !== null).length,
    paidCents: sum(settled),
    remainingCents: sum(scheduled),
    nextDate: next?.date ?? null,
    nextCents: next?.amount.cents ?? null,
  };
}
