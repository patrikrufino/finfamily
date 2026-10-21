import { describe, expect, it } from "vitest";
import {
  anticipationSummary,
  buildInstallmentSchedule,
  installmentStatusFor,
  isAnticipable,
  planProgress,
  validateAnticipation,
  validateInstallmentPlan,
} from "./installment";
import { Money } from "./money";
import type { Transaction } from "./transaction";

let nextId = 1;
const inst = (number: number | null, date: string, cents: number, over: Partial<Transaction> = {}): Transaction => ({
  id: nextId++, kind: "expense", amount: Money.fromCents(cents), date, accountId: 1, toAccountId: null, categoryId: null,
  description: "", status: "scheduled", personId: 1, planId: 1, installmentNumber: number, ...over,
});

describe("buildInstallmentSchedule", () => {
  it("splits equally with the remainder on the last installment", () => {
    const schedule = buildInstallmentSchedule(Money.fromCents(10000), 3, "2026-10-20");
    expect(schedule.map((s) => s.amount.cents)).toEqual([3333, 3333, 3334]);
    expect(schedule.map((s) => s.number)).toEqual([1, 2, 3]);
  });

  it("keeps the day of the month, clamping short months", () => {
    const schedule = buildInstallmentSchedule(Money.fromCents(40000), 4, "2026-01-31");
    expect(schedule.map((s) => s.date)).toEqual(["2026-01-31", "2026-02-28", "2026-03-31", "2026-04-30"]);
  });

  it("rolls over the year", () => {
    const schedule = buildInstallmentSchedule(Money.fromCents(30000), 3, "2026-11-15");
    expect(schedule.map((s) => s.date)).toEqual(["2026-11-15", "2026-12-15", "2027-01-15"]);
  });
});

describe("validateInstallmentPlan", () => {
  const valid = { total: Money.fromCents(10000), count: 3, firstDate: "2026-10-20", accountId: 1, cardId: null };

  it("accepts a valid plan on an account or on a card", () => {
    expect(validateInstallmentPlan(valid)).toEqual([]);
    expect(validateInstallmentPlan({ ...valid, accountId: null, cardId: 2 })).toEqual([]);
  });

  it("limits the number of installments to 2..120", () => {
    expect(validateInstallmentPlan({ ...valid, count: 1 })).toContain("installment_count_invalid");
    expect(validateInstallmentPlan({ ...valid, count: 121 })).toContain("installment_count_invalid");
    expect(validateInstallmentPlan({ ...valid, count: 2.5 })).toContain("installment_count_invalid");
    expect(validateInstallmentPlan({ ...valid, count: 120 })).toEqual([]);
  });

  it("needs a positive total that gives at least one cent per installment", () => {
    expect(validateInstallmentPlan({ ...valid, total: Money.zero() })).toContain("amount_must_be_positive");
    expect(validateInstallmentPlan({ ...valid, total: Money.fromCents(2), count: 3 })).toContain("amount_too_small");
  });

  it("needs a valid date and exactly one source", () => {
    expect(validateInstallmentPlan({ ...valid, firstDate: "2026-02-30" })).toContain("invalid_date");
    expect(validateInstallmentPlan({ ...valid, accountId: null })).toContain("installment_source_required");
    expect(validateInstallmentPlan({ ...valid, cardId: 2 })).toContain("installment_single_source");
  });
});

describe("installmentStatusFor", () => {
  it("is settled once the date has arrived", () => {
    expect(installmentStatusFor("2026-10-20", "2026-10-20")).toBe("settled");
    expect(installmentStatusFor("2026-10-19", "2026-10-20")).toBe("settled");
    expect(installmentStatusFor("2026-10-21", "2026-10-20")).toBe("scheduled");
  });
});

describe("anticipation", () => {
  const today = "2026-10-20";
  const future = inst(3, "2026-12-20", 10000);
  const settled = inst(1, "2026-10-20", 10000, { status: "settled" });
  const anticipation = inst(null, "2026-10-20", 5000, { status: "settled" });

  it("only offers scheduled installments dated after today", () => {
    expect(isAnticipable(future, today)).toBe(true);
    expect(isAnticipable(settled, today)).toBe(false);
    expect(isAnticipable(anticipation, today)).toBe(false);
    expect(isAnticipable(inst(2, "2026-10-20", 1), today)).toBe(false);
    expect(isAnticipable(inst(4, "2026-12-20", 1, { planId: null }), today)).toBe(false);
  });

  it("summarizes the saving", () => {
    const picked = [inst(3, "2026-12-20", 10000), inst(4, "2027-01-20", 10000), inst(5, "2027-02-20", 10000)];
    const s = anticipationSummary(picked, Money.fromCents(27000));
    expect(s).toEqual({ nominal: Money.fromCents(30000), paid: Money.fromCents(27000), saving: Money.fromCents(3000) });
  });

  it("validates what is picked and the amount paid", () => {
    const picked = [future, inst(4, "2027-01-20", 10000)];
    expect(validateAnticipation(picked, [future.id, picked[1]!.id], Money.fromCents(19000), today)).toEqual([]);
    expect(validateAnticipation(picked, [], Money.fromCents(100), today)).toContain("nothing_to_anticipate");
    expect(validateAnticipation([settled], [settled.id], Money.fromCents(100), today)).toContain("installment_not_anticipable");
    expect(validateAnticipation(picked, [future.id, 999], Money.fromCents(100), today)).toContain("installment_not_anticipable");
    expect(validateAnticipation(picked, [future.id], Money.zero(), today)).toContain("amount_must_be_positive");
    expect(validateAnticipation(picked, [future.id], Money.fromCents(10001), today)).toContain("anticipation_above_nominal");
  });
});

describe("planProgress", () => {
  it("separates what is paid from what remains, counting anticipations as paid", () => {
    const items = [
      inst(1, "2026-10-20", 10000, { status: "settled" }),
      inst(2, "2026-11-20", 10000),
      inst(null, "2026-10-21", 18000, { status: "settled" }),
      inst(3, "2026-12-20", 12000),
    ];
    expect(planProgress(items)).toEqual({
      paidCount: 1, remainingCount: 2, paidCents: 28000, remainingCents: 22000, nextDate: "2026-11-20", nextCents: 10000,
    });
  });

  it("has no next installment when everything is settled", () => {
    const p = planProgress([inst(1, "2026-10-20", 10000, { status: "settled" })]);
    expect(p).toMatchObject({ remainingCount: 0, remainingCents: 0, nextDate: null, nextCents: null });
  });
});
