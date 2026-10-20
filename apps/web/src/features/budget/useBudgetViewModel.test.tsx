import { act, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { createFakeRepository } from "../../test/fakeRepository";
import { renderHookWithProviders } from "../../test/render";
import { useBudgetViewModel } from "./useBudgetViewModel";

const seeded = async () => {
  const repo = createFakeRepository({
    accounts: [{ name: "Checking", type: "checking", initialBalanceCents: 0 }],
    categories: [
      { name: "Food", kind: "expense" },
      { name: "Salary", kind: "both" },
    ],
  });
  await repo.createTransaction({
    kind: "expense", amountCents: 20000, date: "2026-10-10", accountId: 1, toAccountId: null, categoryId: 1,
    description: "", status: "settled", personId: 1,
  });
  return repo;
};

describe("useBudgetViewModel", () => {
  it("loads the month report", async () => {
    const { result } = renderHookWithProviders(() => useBudgetViewModel("2026-10"), await seeded());
    await waitFor(() => expect(result.current.report?.categories).toHaveLength(2));
    expect(result.current.report?.categories[0]).toMatchObject({ name: "Food", spentCents: 20000, status: "none" });
  });

  it("sets a budget from pt-BR text and recomputes progress", async () => {
    const { result } = renderHookWithProviders(() => useBudgetViewModel("2026-10"), await seeded());
    await waitFor(() => expect(result.current.report).toBeDefined());
    let outcome: unknown;
    await act(async () => { outcome = await result.current.setBudget(1, "800,00"); });
    expect(outcome).toEqual({ ok: true });
    await waitFor(() => expect(result.current.report?.categories[0]).toMatchObject({ budgetCents: 80000, remainingCents: 60000, status: "ok" }));
  });

  it("rejects invalid or negative amounts without calling the API", async () => {
    const repo = await seeded();
    const { result } = renderHookWithProviders(() => useBudgetViewModel("2026-10"), repo);
    let a: unknown, b: unknown;
    await act(async () => { a = await result.current.setBudget(1, "abc"); b = await result.current.setBudget(1, "-5"); });
    expect(a).toEqual({ ok: false, error: "invalid_amount" });
    expect(b).toEqual({ ok: false, error: "invalid_amount" });
    expect(repo.calls).not.toContain("setBudget");
  });

  it("treats an empty amount as removing the budget", async () => {
    const { result } = renderHookWithProviders(() => useBudgetViewModel("2026-10"), await seeded());
    await act(async () => { await result.current.setBudget(1, "100"); });
    await act(async () => { await result.current.setBudget(1, ""); });
    await waitFor(() => expect(result.current.report?.categories[0]?.budgetCents).toBe(0));
  });

  it("creates categories and surfaces duplicates", async () => {
    const { result } = renderHookWithProviders(() => useBudgetViewModel("2026-10"), await seeded());
    let ok: unknown, dup: unknown, empty: unknown;
    await act(async () => {
      ok = await result.current.createCategory({ name: "Transport", kind: "expense" });
      dup = await result.current.createCategory({ name: "transport", kind: "expense" });
      empty = await result.current.createCategory({ name: "  ", kind: "expense" });
    });
    expect(ok).toEqual({ ok: true });
    expect(dup).toEqual({ ok: false, error: "category_name_taken" });
    expect(empty).toEqual({ ok: false, error: "name_required" });
  });

  it("navigates months and reloads", async () => {
    const { result } = renderHookWithProviders(() => useBudgetViewModel("2026-10"), await seeded());
    await waitFor(() => expect(result.current.report?.categories[0]?.spentCents).toBe(20000));
    act(() => result.current.previousMonth());
    expect(result.current.month).toBe("2026-09");
    await waitFor(() => expect(result.current.report?.categories[0]?.spentCents).toBe(0));
  });
});
