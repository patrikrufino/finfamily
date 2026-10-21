import { waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { createFakeRepository } from "../../test/fakeRepository";
import { renderHookWithProviders } from "../../test/render";
import { useDashboardViewModel } from "./useDashboardViewModel";

const today = new Date().toLocaleDateString("sv-SE");
const month = today.slice(0, 7);

const seeded = async (over: Parameters<typeof createFakeRepository>[0] = {}) => {
  const repo = createFakeRepository({
    accounts: [{ name: "Checking", type: "checking", initialBalanceCents: 100000 }],
    categories: [{ name: "Food", kind: "expense" }],
    ...over,
  });
  await repo.createTransaction({
    kind: "income", amountCents: 500000, date: today, accountId: 1, toAccountId: null, categoryId: null, description: "", status: "settled", personId: 1,
  });
  await repo.createTransaction({
    kind: "expense", amountCents: 52000, date: today, accountId: 1, toAccountId: null, categoryId: 1, description: "", status: "settled", personId: 1,
  });
  return repo;
};

describe("useDashboardViewModel", () => {
  it("loads balance, the month result and the projection", async () => {
    const { result } = renderHookWithProviders(() => useDashboardViewModel(), await seeded());
    await waitFor(() => expect(result.current.dashboard).toBeDefined());
    expect(result.current.dashboard).toMatchObject({
      month, balanceCents: 548000, monthSummary: { incomeCents: 500000, expenseCents: 52000, resultCents: 448000 },
    });
    expect(result.current.dashboard?.forecast).toHaveLength(6);
  });

  it("derives how much of the budget was used", async () => {
    const repo = await seeded();
    await repo.setBudget(1, month, 50000);
    const { result } = renderHookWithProviders(() => useDashboardViewModel(), repo);
    await waitFor(() => expect(result.current.dashboard).toBeDefined());
    expect(result.current.hasBudget).toBe(true);
    expect(result.current.budgetUsedRatio).toBeCloseTo(1.04);
    expect(result.current.dashboard?.budget.highlights.map((h) => [h.name, h.status])).toEqual([["Food", "over"]]);
  });

  it("has no budget ratio without budgets", async () => {
    const { result } = renderHookWithProviders(() => useDashboardViewModel(), await seeded());
    await waitFor(() => expect(result.current.dashboard).toBeDefined());
    expect(result.current.hasBudget).toBe(false);
    expect(result.current.budgetUsedRatio).toBe(0);
  });

  it("reports the first month in which the projected balance turns negative", async () => {
    const repo = await seeded({
      recurring: [{
        kind: "expense", amountCents: 900000, description: "Big bill", accountId: 1, cardId: null, categoryId: null, personId: 1,
        frequency: "monthly", startDate: `${month}-28`, endDate: null,
      }],
    });
    const { result } = renderHookWithProviders(() => useDashboardViewModel(), repo);
    await waitFor(() => expect(result.current.dashboard).toBeDefined());
    expect(result.current.firstNegativeMonth).toBeTruthy();
    expect(result.current.dashboard!.forecast.find((m) => m.month === result.current.firstNegativeMonth)!.endBalanceCents).toBeLessThan(0);
  });

  it("has no negative month when the projection stays positive", async () => {
    const { result } = renderHookWithProviders(() => useDashboardViewModel(), await seeded());
    await waitFor(() => expect(result.current.dashboard).toBeDefined());
    expect(result.current.firstNegativeMonth).toBeNull();
  });
});
