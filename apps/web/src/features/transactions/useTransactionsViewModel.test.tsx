import { act, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { createFakeRepository } from "../../test/fakeRepository";
import { renderHookWithProviders } from "../../test/render";
import { useTransactionsViewModel } from "./useTransactionsViewModel";

const tx = (over: Record<string, unknown>) => ({
  kind: "expense" as const, amountCents: 1000, date: "2026-10-05", accountId: 1, toAccountId: null, categoryId: null,
  description: "", status: "settled" as const, personId: 1, ...over,
});

const seeded = () =>
  createFakeRepository({
    accounts: [{ name: "Checking", type: "checking", initialBalanceCents: 0 }],
    transactions: [
      tx({ description: "a", date: "2026-10-01", kind: "income", amountCents: 5000 }),
      tx({ description: "b", date: "2026-10-10", amountCents: 2000, personId: 2 }),
      tx({ description: "c", date: "2026-09-10" }),
    ],
  });

describe("useTransactionsViewModel", () => {
  it("lists the given month, newest first, with income/expense totals", async () => {
    const { result } = renderHookWithProviders(() => useTransactionsViewModel("2026-10"), seeded());
    await waitFor(() => expect(result.current.transactions).toHaveLength(2));
    expect(result.current.transactions.map((t) => t.description)).toEqual(["b", "a"]);
    expect(result.current.incomeCents).toBe(5000);
    expect(result.current.expenseCents).toBe(2000);
  });

  it("navigates between months", async () => {
    const { result } = renderHookWithProviders(() => useTransactionsViewModel("2026-10"), seeded());
    act(() => result.current.previousMonth());
    expect(result.current.month).toBe("2026-09");
    await waitFor(() => expect(result.current.transactions.map((t) => t.description)).toEqual(["c"]));
    act(() => result.current.nextMonth());
    act(() => result.current.nextMonth());
    expect(result.current.month).toBe("2026-11");
  });

  it("wraps the year when navigating", () => {
    const { result } = renderHookWithProviders(() => useTransactionsViewModel("2026-01"), seeded());
    act(() => result.current.previousMonth());
    expect(result.current.month).toBe("2025-12");
  });

  it("filters by person", async () => {
    const { result } = renderHookWithProviders(() => useTransactionsViewModel("2026-10"), seeded());
    act(() => result.current.setPersonFilter(2));
    await waitFor(() => expect(result.current.transactions.map((t) => t.description)).toEqual(["b"]));
  });

  it("deletes a transaction", async () => {
    const { result } = renderHookWithProviders(() => useTransactionsViewModel("2026-10"), seeded());
    await waitFor(() => expect(result.current.transactions).toHaveLength(2));
    await act(() => result.current.remove(result.current.transactions[0]!.id));
    await waitFor(() => expect(result.current.transactions).toHaveLength(1));
  });

  it("leaves balance adjustments out of the income and expense totals", async () => {
    const repo = seeded();
    await repo.adjustAccount(1, { targetBalanceCents: 1, personId: 1, date: "2026-10-12" });
    const { result } = renderHookWithProviders(() => useTransactionsViewModel("2026-10"), repo);
    await waitFor(() => expect(result.current.transactions).toHaveLength(3));
    expect(result.current.incomeCents).toBe(5000);
    expect(result.current.expenseCents).toBe(2000);
  });
});
