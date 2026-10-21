import { Money } from "./money";
import { isValidIsoDate, type Transaction } from "./transaction";

export interface Debt {
  id: number;
  creditor: string;
  original: Money;
  openedOn: string;
}

export type DebtEntryKind = "interest" | "discount";

export interface DebtEntry {
  id: number;
  debtId: number;
  kind: DebtEntryKind;
  amount: Money;
  date: string;
  note: string;
}

export type DebtStatus = "open" | "settled";

export interface DebtSummary {
  originalCents: number;
  interestCents: number;
  discountCents: number;
  paidCents: number;
  balanceCents: number;
  status: DebtStatus;
}

/** Payments of a debt are its settled expenses (the baixas), recorded as ordinary transactions. */
export function debtPayments(debt: Debt, transactions: readonly Transaction[]): Transaction[] {
  return transactions.filter((t) => t.debtId === debt.id && t.kind === "expense" && t.status === "settled");
}

const sum = (items: readonly { amount: Money }[]) => items.reduce((s, i) => s + i.amount.cents, 0);

export function summarizeDebt(
  debt: Debt,
  entries: readonly DebtEntry[],
  transactions: readonly Transaction[],
): DebtSummary {
  const mine = entries.filter((e) => e.debtId === debt.id);
  const interestCents = sum(mine.filter((e) => e.kind === "interest"));
  const discountCents = sum(mine.filter((e) => e.kind === "discount"));
  const paidCents = sum(debtPayments(debt, transactions));
  const balanceCents = debt.original.cents + interestCents - discountCents - paidCents;
  return {
    originalCents: debt.original.cents, interestCents, discountCents, paidCents, balanceCents,
    status: balanceCents <= 0 ? "settled" : "open",
  };
}

export type LedgerLineType = "opening" | "interest" | "discount" | "payment";

export interface LedgerLine {
  type: LedgerLineType;
  id: number;
  date: string;
  amountCents: number;
  note: string;
  accountId: number | null;
  /** Debt balance right after this line. */
  balanceAfterCents: number;
}

const ORDER: Record<LedgerLineType, number> = { opening: 0, interest: 1, discount: 2, payment: 3 };

/** The debt statement: opening first, then entries and payments by date (interest before payments on the same day). */
export function debtLedger(
  debt: Debt,
  entries: readonly DebtEntry[],
  transactions: readonly Transaction[],
): LedgerLine[] {
  const raw: Omit<LedgerLine, "balanceAfterCents">[] = [
    { type: "opening", id: 0, date: debt.openedOn, amountCents: debt.original.cents, note: "", accountId: null },
    ...entries.filter((e) => e.debtId === debt.id).map((e) => ({
      type: e.kind, id: e.id, date: e.date, amountCents: e.amount.cents, note: e.note, accountId: null,
    })),
    ...debtPayments(debt, transactions).map((t) => ({
      type: "payment" as const, id: t.id, date: t.date, amountCents: t.amount.cents, note: t.description, accountId: t.accountId,
    })),
  ];
  raw.sort((a, b) =>
    a.type === "opening" ? -1 : b.type === "opening" ? 1
      : a.date.localeCompare(b.date) || ORDER[a.type] - ORDER[b.type] || a.id - b.id);
  let balance = 0;
  return raw.map((line) => {
    balance += line.type === "opening" || line.type === "interest" ? line.amountCents : -line.amountCents;
    return { ...line, balanceAfterCents: balance };
  });
}

export type DebtError =
  | "amount_must_be_positive"
  | "invalid_date"
  | "payment_above_balance"
  | "payment_date_in_future"
  | "discount_above_balance";

export function validateDebtPayment(balance: Money, amount: Money, date: string, today: string): DebtError[] {
  const errors: DebtError[] = [];
  if (amount.cents <= 0) errors.push("amount_must_be_positive");
  else if (amount.cents > balance.cents) errors.push("payment_above_balance");
  if (!isValidIsoDate(date)) errors.push("invalid_date");
  else if (date > today) errors.push("payment_date_in_future");
  return errors;
}

export function validateDebtDiscount(balance: Money, amount: Money, date: string): DebtError[] {
  const errors: DebtError[] = [];
  if (amount.cents <= 0) errors.push("amount_must_be_positive");
  else if (amount.cents > balance.cents) errors.push("discount_above_balance");
  if (!isValidIsoDate(date)) errors.push("invalid_date");
  return errors;
}

export function validateDebtInterest(amount: Money, date: string): DebtError[] {
  const errors: DebtError[] = [];
  if (amount.cents <= 0) errors.push("amount_must_be_positive");
  if (!isValidIsoDate(date)) errors.push("invalid_date");
  return errors;
}

/** Removing an entry is fine as long as the balance does not become negative. */
export function canRemoveEntry(
  debt: Debt,
  entries: readonly DebtEntry[],
  transactions: readonly Transaction[],
  entryId: number,
): boolean {
  return summarizeDebt(debt, entries.filter((e) => e.id !== entryId), transactions).balanceCents >= 0;
}
