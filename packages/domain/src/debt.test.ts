import { describe, expect, it } from "vitest";
import {
  canRemoveEntry,
  debtLedger,
  summarizeDebt,
  validateDebtDiscount,
  validateDebtInterest,
  validateDebtPayment,
  type Debt,
  type DebtEntry,
} from "./debt";
import { Money } from "./money";
import type { Transaction } from "./transaction";

const debt: Debt = { id: 1, creditor: "Bank", original: Money.fromCents(100000), openedOn: "2026-01-10" };
let nextId = 1;
const entry = (kind: "interest" | "discount", cents: number, date: string): DebtEntry => ({
  id: nextId++, debtId: 1, kind, amount: Money.fromCents(cents), date, note: "",
});
const payment = (cents: number, date: string, over: Partial<Transaction> = {}): Transaction => ({
  id: nextId++, kind: "expense", amount: Money.fromCents(cents), date, accountId: 1, toAccountId: null, categoryId: null,
  description: "", status: "settled", personId: 1, debtId: 1, ...over,
});

describe("summarizeDebt", () => {
  it("is original + interest - discounts - payments", () => {
    const s = summarizeDebt(debt, [entry("interest", 8000, "2026-02-01"), entry("discount", 2000, "2026-03-01")], [payment(30000, "2026-03-05")]);
    expect(s).toEqual({ originalCents: 100000, interestCents: 8000, discountCents: 2000, paidCents: 30000, balanceCents: 76000, status: "open" });
  });

  it("is settled when the balance reaches zero", () => {
    expect(summarizeDebt(debt, [], [payment(100000, "2026-02-01")])).toMatchObject({ balanceCents: 0, status: "settled" });
  });

  it("only counts settled expenses of this debt", () => {
    const others = [
      payment(5000, "2026-02-01", { debtId: 2 }),
      payment(5000, "2026-02-01", { status: "scheduled" }),
      payment(5000, "2026-02-01", { debtId: null }),
      payment(5000, "2026-02-01", { kind: "income" }),
    ];
    expect(summarizeDebt(debt, [], others).paidCents).toBe(0);
  });
});

describe("debtLedger", () => {
  it("lists opening, interest, discount and payments by date with the running balance", () => {
    const ledger = debtLedger(
      debt,
      [entry("interest", 8000, "2026-02-01"), entry("discount", 2000, "2026-03-01")],
      [payment(30000, "2026-02-15")],
    );
    expect(ledger.map((l) => [l.type, l.date, l.amountCents, l.balanceAfterCents])).toEqual([
      ["opening", "2026-01-10", 100000, 100000],
      ["interest", "2026-02-01", 8000, 108000],
      ["payment", "2026-02-15", 30000, 78000],
      ["discount", "2026-03-01", 2000, 76000],
    ]);
  });

  it("keeps entries of the same day in a stable order and puts the opening first", () => {
    const ledger = debtLedger(debt, [entry("interest", 1000, "2026-01-10")], [payment(500, "2026-01-10")]);
    expect(ledger.map((l) => l.type)).toEqual(["opening", "interest", "payment"]);
  });

  it("skips scheduled or unrelated payments", () => {
    const ledger = debtLedger(debt, [], [payment(500, "2026-02-01", { status: "scheduled" })]);
    expect(ledger.map((l) => l.type)).toEqual(["opening"]);
  });
});

describe("validation", () => {
  const balance = Money.fromCents(78000);
  const today = "2026-10-20";

  it("accepts a payment up to the balance dated today or earlier", () => {
    expect(validateDebtPayment(balance, Money.fromCents(78000), "2026-10-20", today)).toEqual([]);
    expect(validateDebtPayment(balance, Money.fromCents(1), "2026-01-01", today)).toEqual([]);
  });

  it("rejects non-positive, above-balance and future payments and bad dates", () => {
    expect(validateDebtPayment(balance, Money.zero(), today, today)).toContain("amount_must_be_positive");
    expect(validateDebtPayment(balance, Money.fromCents(78001), today, today)).toContain("payment_above_balance");
    expect(validateDebtPayment(balance, Money.fromCents(100), "2026-10-21", today)).toContain("payment_date_in_future");
    expect(validateDebtPayment(balance, Money.fromCents(100), "2026-02-30", today)).toContain("invalid_date");
  });

  it("validates discounts against the balance", () => {
    expect(validateDebtDiscount(balance, Money.fromCents(78000), "2026-10-20")).toEqual([]);
    expect(validateDebtDiscount(balance, Money.fromCents(78001), "2026-10-20")).toContain("discount_above_balance");
    expect(validateDebtDiscount(balance, Money.zero(), "2026-10-20")).toContain("amount_must_be_positive");
  });

  it("validates interest", () => {
    expect(validateDebtInterest(Money.fromCents(100), "2026-10-20")).toEqual([]);
    expect(validateDebtInterest(Money.zero(), "2026-10-20")).toContain("amount_must_be_positive");
    expect(validateDebtInterest(Money.fromCents(1), "nope")).toContain("invalid_date");
  });
});

describe("canRemoveEntry", () => {
  it("refuses to remove interest that payments already depend on", () => {
    const interest = entry("interest", 8000, "2026-02-01");
    expect(canRemoveEntry(debt, [interest], [payment(105000, "2026-02-10")], interest.id)).toBe(false);
    expect(canRemoveEntry(debt, [interest], [payment(50000, "2026-02-10")], interest.id)).toBe(true);
  });

  it("always allows removing a discount", () => {
    const discount = entry("discount", 8000, "2026-02-01");
    expect(canRemoveEntry(debt, [discount], [payment(90000, "2026-02-10")], discount.id)).toBe(true);
    expect(canRemoveEntry(debt, [discount], [payment(90000, "2026-02-10")], 999)).toBe(true);
  });
});
