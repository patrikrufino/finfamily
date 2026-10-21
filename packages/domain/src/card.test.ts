import { describe, expect, it } from "vitest";
import { Money } from "./money";
import {
  buildStatement,
  cardUsage,
  dueDate,
  closingDate,
  statementMonthFor,
  statementPeriod,
  type Card,
  type CycleRule,
} from "./card";
import type { Transaction } from "./transaction";

const rule = (fromMonth: string, closingDay: number, dueDay: number): CycleRule => ({ cardId: 1, fromMonth, closingDay, dueDay });
const base = [rule("0000-01", 25, 5)];
const card: Card = { id: 1, name: "Visa", limit: Money.fromCents(500000), archived: false };

let nextId = 1;
const purchase = (date: string, cents: number, over: Partial<Transaction> = {}): Transaction => ({
  id: nextId++, kind: "expense", amount: Money.fromCents(cents), date, accountId: null, toAccountId: null,
  categoryId: null, cardId: 1, statementMonth: null, feeKind: null, description: "", status: "settled", personId: 1, ...over,
});
const payment = (month: string, cents: number): Transaction =>
  purchase("2026-11-05", cents, { kind: "transfer", accountId: 10, statementMonth: month });

describe("closing and due dates", () => {
  it("clamps the closing day to the month length", () => {
    expect(closingDate([rule("0000-01", 31, 10)], "2026-02")).toBe("2026-02-28");
  });

  it("puts the due date in the next month when the due day is not after the closing day", () => {
    expect(dueDate(base, "2026-10")).toBe("2026-11-05");
  });

  it("keeps the due date in the same month when the due day is after the closing day", () => {
    expect(dueDate([rule("0000-01", 5, 12)], "2026-10")).toBe("2026-10-12");
  });

  it("clamps the due date to the month length", () => {
    expect(dueDate([rule("0000-01", 25, 31)], "2026-12")).toBe("2026-12-31");
    expect(dueDate([rule("0000-01", 28, 30)], "2026-02")).toBe("2026-02-28");
  });
});

describe("statementMonthFor", () => {
  it("includes the closing day in the current statement", () => {
    expect(statementMonthFor(base, "2026-10-25")).toBe("2026-10");
    expect(statementMonthFor(base, "2026-10-26")).toBe("2026-11");
  });

  it("rolls over the year", () => {
    expect(statementMonthFor(base, "2026-12-31")).toBe("2027-01");
    expect(statementMonthFor(base, "2026-01-01")).toBe("2026-01");
  });

  it("handles short months with a high closing day", () => {
    const rules = [rule("0000-01", 31, 10)];
    expect(statementMonthFor(rules, "2026-02-28")).toBe("2026-02");
    expect(statementMonthFor(rules, "2026-03-01")).toBe("2026-03");
  });

  it("does not move past purchases when the rule changes", () => {
    const rules = [rule("0000-01", 25, 5), rule("2026-11", 10, 20)];
    expect(statementMonthFor(rules, "2026-10-20")).toBe("2026-10");
    expect(statementMonthFor(rules, "2026-10-28")).toBe("2026-11");
    expect(statementMonthFor(rules, "2026-11-08")).toBe("2026-11");
    expect(statementMonthFor(rules, "2026-11-11")).toBe("2026-12");
  });
});

describe("statementPeriod", () => {
  it("runs from the day after the previous closing to the closing date", () => {
    expect(statementPeriod(base, "2026-10")).toEqual({ start: "2026-09-26", end: "2026-10-25" });
  });

  it("follows a rule change", () => {
    const rules = [rule("0000-01", 25, 5), rule("2026-11", 10, 20)];
    expect(statementPeriod(rules, "2026-11")).toEqual({ start: "2026-10-26", end: "2026-11-10" });
  });
});

describe("buildStatement", () => {
  const txs = [
    purchase("2026-10-02", 30000),
    purchase("2026-10-25", 70000),
    purchase("2026-10-26", 99900),
    purchase("2026-09-20", 5000),
  ];

  it("totals the purchases that fall in the statement", () => {
    const s = buildStatement(card, base, txs, "2026-10", "2026-10-10");
    expect(s.totalCents).toBe(100000);
    expect(s.purchases).toHaveLength(2);
    expect(s).toMatchObject({ start: "2026-09-26", end: "2026-10-25", dueDate: "2026-11-05", status: "open" });
  });

  it("ignores other cards and account transactions", () => {
    const others = [purchase("2026-10-02", 1, { cardId: 2 }), purchase("2026-10-02", 1, { cardId: null, accountId: 3 })];
    expect(buildStatement(card, base, others, "2026-10", "2026-10-10").totalCents).toBe(0);
  });

  it("is closed after the closing date until fully paid", () => {
    expect(buildStatement(card, base, txs, "2026-10", "2026-10-26").status).toBe("closed");
  });

  it("is paid when payments cover the total, tracking partial payments", () => {
    const partial = buildStatement(card, base, [...txs, payment("2026-10", 40000)], "2026-10", "2026-11-01");
    expect(partial).toMatchObject({ paidCents: 40000, remainingCents: 60000, status: "closed" });
    const full = buildStatement(card, base, [...txs, payment("2026-10", 100000)], "2026-10", "2026-11-01");
    expect(full).toMatchObject({ remainingCents: 0, status: "paid" });
  });

  it("reports interest and fine items separately from the total", () => {
    const fee = purchase("2026-11-05", 2000, { accountId: 10, statementMonth: "2026-10", feeKind: "interest" });
    const s = buildStatement(card, base, [...txs, fee], "2026-10", "2026-11-06");
    expect(s.totalCents).toBe(100000);
    expect(s.feesCents).toBe(2000);
  });

  it("counts an empty closed statement as paid", () => {
    expect(buildStatement(card, base, [], "2026-08", "2026-10-10").status).toBe("paid");
  });
});

describe("cardUsage", () => {
  it("subtracts payments from purchases to get the used limit", () => {
    const txs = [purchase("2026-10-02", 120000), payment("2026-10", 20000)];
    expect(cardUsage(card, txs)).toMatchObject({ usedCents: 100000, availableCents: 400000 });
  });
});
