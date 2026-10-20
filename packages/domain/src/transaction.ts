import { categoryAllows, type Category } from "./category";
import type { Money } from "./money";

export const TRANSACTION_KINDS = ["income", "expense", "transfer"] as const;
export type TransactionKind = (typeof TRANSACTION_KINDS)[number];

export const TRANSACTION_STATUSES = ["settled", "scheduled"] as const;
export type TransactionStatus = (typeof TRANSACTION_STATUSES)[number];

export interface TransactionInput {
  kind: TransactionKind;
  amount: Money;
  /** ISO date, `YYYY-MM-DD`. */
  date: string;
  accountId: number;
  toAccountId: number | null;
  categoryId: number | null;
  description: string;
  status: TransactionStatus;
  personId: number;
}

export interface Transaction extends TransactionInput {
  id: number;
}

export type TransactionError =
  | "amount_must_be_positive"
  | "invalid_date"
  | "transfer_needs_destination"
  | "transfer_same_account"
  | "destination_only_for_transfer"
  | "category_not_allowed"
  | "category_archived";

export function isValidIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value);
}

export function validateTransactionInput(input: TransactionInput): TransactionError[] {
  const errors: TransactionError[] = [];
  if (input.amount.cents <= 0) errors.push("amount_must_be_positive");
  if (!isValidIsoDate(input.date)) errors.push("invalid_date");
  if (input.kind === "transfer") {
    if (input.toAccountId === null) errors.push("transfer_needs_destination");
    else if (input.toAccountId === input.accountId) errors.push("transfer_same_account");
  } else if (input.toAccountId !== null) {
    errors.push("destination_only_for_transfer");
  }
  return errors;
}

/** `category` is the resolved category the transaction points to, or null when it has none. */
export function validateTransactionCategory(kind: TransactionKind, category: Category | null): TransactionError[] {
  if (!category) return [];
  if (!categoryAllows(category, kind)) return ["category_not_allowed"];
  return category.archived ? ["category_archived"] : [];
}
