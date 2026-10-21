import { describe, expect, it } from "vitest";
import { Money } from "./money";
import { validateTransactionCategory, validateTransactionInput, type TransactionInput } from "./transaction";

const valid: TransactionInput = {
  kind: "expense",
  amount: Money.fromCents(1000),
  date: "2026-10-20",
  accountId: 1,
  toAccountId: null,
  categoryId: null,
  description: "Groceries",
  status: "settled",
  personId: 1,
};

describe("validateTransactionInput", () => {
  it("accepts a valid expense", () => {
    expect(validateTransactionInput(valid)).toEqual([]);
  });

  it("rejects zero and negative amounts", () => {
    expect(validateTransactionInput({ ...valid, amount: Money.zero() })).toContain("amount_must_be_positive");
    expect(validateTransactionInput({ ...valid, amount: Money.fromCents(-1) })).toContain("amount_must_be_positive");
  });

  it("rejects malformed or impossible dates", () => {
    expect(validateTransactionInput({ ...valid, date: "20/10/2026" })).toContain("invalid_date");
    expect(validateTransactionInput({ ...valid, date: "2026-02-30" })).toContain("invalid_date");
  });

  it("requires a different destination for transfers", () => {
    expect(validateTransactionInput({ ...valid, kind: "transfer", toAccountId: null })).toContain("transfer_needs_destination");
    expect(validateTransactionInput({ ...valid, kind: "transfer", toAccountId: 1 })).toContain("transfer_same_account");
    expect(validateTransactionInput({ ...valid, kind: "transfer", toAccountId: 2 })).toEqual([]);
  });

  it("forbids a destination on income and expense", () => {
    expect(validateTransactionInput({ ...valid, toAccountId: 2 })).toContain("destination_only_for_transfer");
  });
});

describe("validateTransactionCategory", () => {
  const food = { id: 1, name: "Food", kind: "expense" as const, archived: false };
  const salary = { id: 2, name: "Salary", kind: "both" as const, archived: false };

  it("accepts no category for income and expenses", () => {
    expect(validateTransactionCategory("expense", null)).toEqual([]);
    expect(validateTransactionCategory("income", null)).toEqual([]);
  });

  it("rejects an expense-only category on income", () => {
    expect(validateTransactionCategory("income", food)).toContain("category_not_allowed");
    expect(validateTransactionCategory("income", salary)).toEqual([]);
  });

  it("rejects archived categories", () => {
    expect(validateTransactionCategory("expense", { ...food, archived: true })).toContain("category_archived");
  });

  it("rejects any category on transfers", () => {
    expect(validateTransactionCategory("transfer", salary)).toContain("category_not_allowed");
  });
});

describe("card rules", () => {
  it("accepts a card purchase: expense, card, no account", () => {
    expect(validateTransactionInput({ ...valid, accountId: null, cardId: 3 })).toEqual([]);
  });

  it("requires an account or a card", () => {
    expect(validateTransactionInput({ ...valid, accountId: null, cardId: null })).toContain("account_required");
  });

  it("only allows expenses on a card without account", () => {
    expect(validateTransactionInput({ ...valid, kind: "income", accountId: null, cardId: 3 })).toContain("card_purchase_must_be_expense");
  });

  it("accepts a statement payment: transfer from an account to a card", () => {
    expect(validateTransactionInput({ ...valid, kind: "transfer", cardId: 3, statementMonth: "2026-10" })).toEqual([]);
  });

  it("rejects a statement payment without a statement month", () => {
    expect(validateTransactionInput({ ...valid, kind: "transfer", cardId: 3 })).toContain("statement_month_required");
  });

  it("rejects an account transfer that also targets a card", () => {
    expect(validateTransactionInput({ ...valid, kind: "transfer", cardId: 3, toAccountId: 2, statementMonth: "2026-10" })).toContain("transfer_single_destination");
  });
});
