import { describe, expect, it } from "vitest";
import { Money } from "./money";
import { validateTransactionInput, type TransactionInput } from "./transaction";

const valid: TransactionInput = {
  kind: "expense",
  amount: Money.fromCents(1000),
  date: "2026-10-20",
  accountId: 1,
  toAccountId: null,
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
