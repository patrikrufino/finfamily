import { act, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { createFakeRepository } from "../../test/fakeRepository";
import { renderHookWithProviders } from "../../test/render";
import { useRecurringViewModel } from "./useRecurringViewModel";

const today = new Date().toLocaleDateString("sv-SE");

const seeded = () =>
  createFakeRepository({
    accounts: [{ name: "Checking", type: "checking", initialBalanceCents: 100000 }],
    recurring: [
      { kind: "income", amountCents: 300000, description: "Salary", accountId: 1, cardId: null, categoryId: null, personId: 1, frequency: "monthly", startDate: "2027-01-05", endDate: null },
      { kind: "expense", amountCents: 120000, description: "Rent", accountId: 1, cardId: null, categoryId: null, personId: 1, frequency: "monthly", startDate: today, endDate: null },
    ],
  });

describe("useRecurringViewModel", () => {
  it("lists the rules", async () => {
    const { result } = renderHookWithProviders(() => useRecurringViewModel(), seeded());
    await waitFor(() => expect(result.current.rules).toHaveLength(2));
    expect(result.current.rules.map((r) => r.description)).toEqual(["Salary", "Rent"]);
  });

  it("pauses and resumes a rule", async () => {
    const { result } = renderHookWithProviders(() => useRecurringViewModel(), seeded());
    await waitFor(() => expect(result.current.rules).toHaveLength(2));
    await act(() => result.current.setActive(1, false));
    await waitFor(() => expect(result.current.rules.find((r) => r.id === 1)?.status).toBe("paused"));
    await act(() => result.current.setActive(1, true));
    await waitFor(() => expect(result.current.rules.find((r) => r.id === 1)?.status).toBe("active"));
  });

  it("edits amount, description and end date from typed text", async () => {
    const { result } = renderHookWithProviders(() => useRecurringViewModel(), seeded());
    await waitFor(() => expect(result.current.rules).toHaveLength(2));
    let outcome: unknown;
    await act(async () => {
      outcome = await result.current.editRule(1, { amountText: "3.200,00", description: " Salary 2027 ", endDate: "2027-12-31" });
    });
    expect(outcome).toEqual({ ok: true });
    await waitFor(() => expect(result.current.rules.find((r) => r.id === 1)).toMatchObject({ amountCents: 320000, description: "Salary 2027", endDate: "2027-12-31" }));
  });

  it("validates the edit", async () => {
    const { result } = renderHookWithProviders(() => useRecurringViewModel(), seeded());
    let outcomes: unknown[] = [];
    await act(async () => {
      outcomes = [
        await result.current.editRule(1, { amountText: "abc", description: "x", endDate: "" }),
        await result.current.editRule(1, { amountText: "0", description: "x", endDate: "" }),
        await result.current.editRule(1, { amountText: "10", description: "x", endDate: "2026-02-30" }),
      ];
    });
    expect(outcomes).toEqual([
      { ok: false, error: "invalid_amount" },
      { ok: false, error: "invalid_amount" },
      { ok: false, error: "invalid_date" },
    ]);
  });

  it("deletes a rule that never posted and refuses one that did", async () => {
    const { result } = renderHookWithProviders(() => useRecurringViewModel(), seeded());
    await waitFor(() => expect(result.current.rules).toHaveLength(2));
    let ok: unknown, refused: unknown;
    await act(async () => {
      ok = await result.current.deleteRule(1);
      refused = await result.current.deleteRule(2);
    });
    expect(ok).toEqual({ ok: true });
    expect(refused).toEqual({ ok: false, error: "rule_has_postings" });
  });
});
