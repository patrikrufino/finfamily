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
  /** Null for card purchases, which are charged to a card instead of an account. */
  accountId: number | null;
  toAccountId: number | null;
  categoryId: number | null;
  /** Card purchase, statement payment (transfer) or statement fee (expense with `feeKind`). */
  cardId?: number | null;
  /** Statement (`YYYY-MM`) a payment or fee refers to. */
  statementMonth?: string | null;
  feeKind?: "interest" | "fine" | null;
  /** Balance adjustment: keeps the account balance right but is not spending or earning. */
  adjustment?: boolean;
  /** Installment plan this transaction belongs to; `installmentNumber` is null for an anticipation item. */
  planId?: number | null;
  installmentNumber?: number | null;
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
  | "category_archived"
  | "account_required"
  | "card_purchase_must_be_expense"
  | "transfer_single_destination"
  | "statement_month_required"
  | "fee_needs_statement";

export function isValidIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value);
}

export function validateTransactionInput(input: TransactionInput): TransactionError[] {
  const errors: TransactionError[] = [];
  if (input.amount.cents <= 0) errors.push("amount_must_be_positive");
  if (!isValidIsoDate(input.date)) errors.push("invalid_date");
  const cardId = input.cardId ?? null;
  if (input.accountId === null) {
    if (cardId === null) errors.push("account_required");
    else if (input.kind !== "expense") errors.push("card_purchase_must_be_expense");
  }
  if (input.kind === "transfer") {
    if (input.toAccountId === null && cardId === null) errors.push("transfer_needs_destination");
    else if (input.toAccountId !== null && cardId !== null) errors.push("transfer_single_destination");
    else if (input.toAccountId !== null && input.toAccountId === input.accountId) errors.push("transfer_same_account");
    if (cardId !== null && !input.statementMonth) errors.push("statement_month_required");
  } else if (input.toAccountId !== null) {
    errors.push("destination_only_for_transfer");
  }
  if (input.feeKind && (cardId === null || !input.statementMonth)) errors.push("fee_needs_statement");
  return errors;
}

/** `category` is the resolved category the transaction points to, or null when it has none. */
export function validateTransactionCategory(kind: TransactionKind, category: Category | null): TransactionError[] {
  if (!category) return [];
  if (!categoryAllows(category, kind)) return ["category_not_allowed"];
  return category.archived ? ["category_archived"] : [];
}
