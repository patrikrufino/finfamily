import { describe, expect, it } from "vitest";
import { ALWAYS_FROM, type Card, type CycleRule } from "./card";
import { buildForecast, monthSummary } from "./forecast";
import { Money } from "./money";
import type { RecurringRule } from "./recurring";
import type { Transaction } from "./transaction";

const today = "2026-10-20";
let nextId = 1;
const tx = (over: Partial<Transaction>): Transaction => ({
  id: nextId++, kind: "expense", amount: Money.fromCents(1000), date: "2026-10-05", accountId: 1, toAccountId: null, categoryId: null,
  description: "", status: "settled", personId: 1, ...over,
});
const rule = (over: Partial<RecurringRule>): RecurringRule => ({
  id: nextId++, kind: "expense", amount: Money.fromCents(1000), description: "", accountId: 1, cardId: null, categoryId: null, personId: 1,
  frequency: "monthly", startDate: "2026-01-05", endDate: null, nextIndex: 10, active: true, ...over,
});
const card: Card = { id: 1, name: "Visa", limit: Money.fromCents(500000), archived: false };
const cardRules: CycleRule[] = [{ cardId: 1, fromMonth: ALWAYS_FROM, closingDay: 25, dueDay: 5 }];
const purchase = (date: string, cents: number, over: Partial<Transaction> = {}) =>
  tx({ accountId: null, cardId: 1, date, amount: Money.fromCents(cents), ...over });

const forecast = (over: Partial<Parameters<typeof buildForecast>[0]> = {}) =>
  buildForecast({ today, months: 3, startingBalanceCents: 100000, transactions: [], cards: [card], cycleRules: cardRules, recurring: [], ...over });

describe("buildForecast", () => {
  it("lists the current month and the following ones", () => {
    expect(forecast({ months: 4 }).map((m) => m.month)).toEqual(["2026-10", "2026-11", "2026-12", "2027-01"]);
  });

  it("projects recurring income and expenses on accounts and accumulates the balance", () => {
    const salary = rule({ kind: "income", amount: Money.fromCents(300000), startDate: "2026-01-05" });
    const rent = rule({ amount: Money.fromCents(120000), startDate: "2026-01-10" });
    const f = forecast({ recurring: [salary, rent] });
    expect(f[0]!).toMatchObject({ incomeCents: 0, expenseCents: 0, endBalanceCents: 100000 });
    expect(f[1]!).toMatchObject({ incomeCents: 300000, expenseCents: 120000, netCents: 180000, endBalanceCents: 280000 });
    expect(f[2]!).toMatchObject({ netCents: 180000, endBalanceCents: 460000 });
  });

  it("includes a recurring occurrence still ahead in the current month", () => {
    const r = rule({ startDate: "2026-01-25", nextIndex: 9 }); // 2026-10-25 is still ahead
    expect(forecast({ recurring: [r] })[0]).toMatchObject({ expenseCents: 1000, endBalanceCents: 99000 });
  });

  it("ignores paused rules and rules past their end date", () => {
    const paused = rule({ active: false });
    const ended = rule({ endDate: "2026-10-31" });
    const f = forecast({ recurring: [paused, ended] });
    expect(f.every((m) => m.expenseCents === 0)).toBe(true);
  });

  it("projects scheduled transactions on accounts by their month", () => {
    const f = forecast({
      transactions: [
        tx({ status: "scheduled", date: "2026-12-01", amount: Money.fromCents(5000) }),
        tx({ status: "scheduled", date: "2026-11-15", kind: "income", amount: Money.fromCents(7000) }),
      ],
    });
    expect(f[1]!).toMatchObject({ incomeCents: 7000, expenseCents: 0 });
    expect(f[2]!).toMatchObject({ expenseCents: 5000 });
  });

  it("counts overdue scheduled transactions in the current month", () => {
    const f = forecast({ transactions: [tx({ status: "scheduled", date: "2026-10-01", amount: Money.fromCents(4000) })] });
    expect(f[0]!).toMatchObject({ expenseCents: 4000 });
  });

  it("does not count settled transactions, adjustments or scheduled transfers", () => {
    const f = forecast({
      transactions: [
        tx({ date: "2026-11-01", amount: Money.fromCents(9000) }),
        tx({ status: "scheduled", date: "2026-11-02", adjustment: true }),
        tx({ status: "scheduled", date: "2026-11-03", kind: "transfer", toAccountId: 2 }),
      ],
    });
    expect(f.every((m) => m.expenseCents === 0 && m.incomeCents === 0)).toBe(true);
  });

  it("projects a card statement leaving the account on its due date", () => {
    const f = forecast({ transactions: [purchase("2026-10-10", 80000)] }); // statement 2026-10, due 2026-11-05
    expect(f[1]!).toMatchObject({ cardPaymentsCents: 80000, netCents: -80000, endBalanceCents: 20000 });
    expect(f[0]!.cardPaymentsCents).toBe(0);
  });

  it("projects future installments on the card into the statements of their dates", () => {
    const f = forecast({
      transactions: [purchase("2026-11-10", 30000, { status: "scheduled" }), purchase("2026-12-10", 30000, { status: "scheduled" })],
    });
    // 2026-11-10 -> statement 2026-11 (due 12-05); 2026-12-10 -> statement 2026-12 (due 2027-01-05)
    expect(f[2]!.cardPaymentsCents).toBe(30000);
    expect(f[1]!.cardPaymentsCents).toBe(0);
  });

  it("adds future recurring charges on the card to its statements", () => {
    const sub = rule({ cardId: 1, accountId: null, amount: Money.fromCents(5000), startDate: "2026-01-12", nextIndex: 10 }); // 11-12, 12-12...
    const f = forecast({ recurring: [sub], months: 4 });
    expect(f[2]!.cardPaymentsCents).toBe(5000); // statement 2026-11 due 2026-12-05
    expect(f[3]!.cardPaymentsCents).toBe(5000); // statement 2026-12 due 2027-01-05
  });

  it("counts only what is still unpaid of a statement", () => {
    const f = forecast({
      transactions: [
        purchase("2026-10-10", 80000),
        tx({ kind: "transfer", cardId: 1, accountId: 1, statementMonth: "2026-10", amount: Money.fromCents(30000), date: "2026-10-12" }),
      ],
    });
    expect(f[1]!.cardPaymentsCents).toBe(50000);
  });

  it("counts an unpaid statement that is already due in the current month", () => {
    const f = forecast({ transactions: [purchase("2026-09-10", 60000)] }); // statement 2026-09, due 2026-10-05 (passed)
    expect(f[0]!.cardPaymentsCents).toBe(60000);
  });

  it("leaves out statements due after the horizon", () => {
    const f = forecast({ months: 1, transactions: [purchase("2026-10-10", 80000)] });
    expect(f).toHaveLength(1);
    expect(f[0]!.cardPaymentsCents).toBe(0);
  });

  it("does not project income on cards and handles no cards at all", () => {
    expect(forecast({ cards: [], cycleRules: [] })).toHaveLength(3);
  });
});

describe("monthSummary", () => {
  it("sums settled income and expenses of the month", () => {
    const s = monthSummary(
      [
        tx({ kind: "income", amount: Money.fromCents(500000), date: "2026-10-05" }),
        tx({ amount: Money.fromCents(20000), date: "2026-10-06" }),
        purchase("2026-10-07", 30000),
        tx({ amount: Money.fromCents(2000), date: "2026-10-08", accountId: 1, cardId: 1, statementMonth: "2026-09", feeKind: "interest" }),
        tx({ amount: Money.fromCents(99999), date: "2026-09-30" }),
      ],
      "2026-10",
    );
    expect(s).toEqual({ incomeCents: 500000, expenseCents: 52000, resultCents: 448000 });
  });

  it("ignores transfers, card payments, adjustments and scheduled transactions", () => {
    const s = monthSummary(
      [
        tx({ kind: "transfer", toAccountId: 2, amount: Money.fromCents(10000) }),
        tx({ kind: "transfer", cardId: 1, statementMonth: "2026-09", amount: Money.fromCents(10000) }),
        tx({ adjustment: true, amount: Money.fromCents(10000) }),
        tx({ kind: "income", adjustment: true, amount: Money.fromCents(10000) }),
        tx({ status: "scheduled", amount: Money.fromCents(10000) }),
      ],
      "2026-10",
    );
    expect(s).toEqual({ incomeCents: 0, expenseCents: 0, resultCents: 0 });
  });
});
