import { describe, expect, it } from "vitest";
import { Money } from "./money";
import { budgetForMonth, budgetProgress, type BudgetEntry } from "./budget";

const entry = (fromMonth: string, cents: number, categoryId = 1): BudgetEntry => ({
  categoryId,
  fromMonth,
  amount: Money.fromCents(cents),
});

describe("budgetForMonth", () => {
  const entries = [entry("2026-01", 40000), entry("2026-07", 60000), entry("2026-03", 10000, 2)];

  it("uses the latest entry not after the month", () => {
    expect(budgetForMonth(entries, 1, "2026-06").cents).toBe(40000);
    expect(budgetForMonth(entries, 1, "2026-07").cents).toBe(60000);
    expect(budgetForMonth(entries, 1, "2027-01").cents).toBe(60000);
  });

  it("is zero before the first entry or without entries", () => {
    expect(budgetForMonth(entries, 1, "2025-12").cents).toBe(0);
    expect(budgetForMonth(entries, 99, "2026-06").cents).toBe(0);
  });

  it("does not depend on entry order", () => {
    expect(budgetForMonth([...entries].reverse(), 1, "2026-06").cents).toBe(40000);
  });
});

describe("budgetProgress", () => {
  const progress = (budget: number, spent: number, committed = 0) =>
    budgetProgress(Money.fromCents(budget), Money.fromCents(spent), Money.fromCents(committed));

  it("is ok under 80%", () => {
    expect(progress(50000, 10000)).toMatchObject({ status: "ok", remaining: Money.fromCents(40000), ratio: 0.2 });
  });

  it("warns from 80% up to 100%", () => {
    expect(progress(50000, 40000).status).toBe("warning");
    expect(progress(50000, 50000).status).toBe("warning");
    expect(progress(50000, 45000).remaining.cents).toBe(5000);
  });

  it("is over above 100% with a negative remaining", () => {
    const p = progress(50000, 52000);
    expect(p.status).toBe("over");
    expect(p.remaining.cents).toBe(-2000);
  });

  it("has no status without a budget", () => {
    expect(progress(0, 1000).status).toBe("none");
  });

  it("exposes what is committed by scheduled expenses", () => {
    expect(progress(50000, 10000, 15000).availableAfterCommitted.cents).toBe(25000);
  });
});
