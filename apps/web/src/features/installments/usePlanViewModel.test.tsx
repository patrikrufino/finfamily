import { act, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { createFakeRepository } from "../../test/fakeRepository";
import { renderHookWithProviders } from "../../test/render";
import { useInstallmentsViewModel } from "./useInstallmentsViewModel";
import { usePlanViewModel } from "./usePlanViewModel";

const seeded = async () => {
  const repo = createFakeRepository({
    today: "2026-10-20",
    accounts: [{ name: "Checking", type: "checking", initialBalanceCents: 100000 }],
  });
  await repo.createPlan({
    description: "Notebook", totalCents: 50000, count: 5, firstDate: "2026-10-20",
    accountId: 1, cardId: null, categoryId: null, personId: 1,
  });
  return repo;
};

describe("useInstallmentsViewModel", () => {
  it("lists plans with their progress", async () => {
    const { result } = renderHookWithProviders(() => useInstallmentsViewModel(), await seeded());
    await waitFor(() => expect(result.current.plans).toHaveLength(1));
    expect(result.current.plans[0]).toMatchObject({ description: "Notebook", paidCount: 1, remainingCount: 4, status: "active" });
  });
});

describe("usePlanViewModel", () => {
  const setup = async () => {
    const hook = renderHookWithProviders(() => usePlanViewModel(1), await seeded());
    await waitFor(() => expect(hook.result.current.plan).toBeDefined());
    return hook;
  };

  it("loads the plan with its installments and which ones can be anticipated", async () => {
    const { result } = await setup();
    expect(result.current.plan?.installments.map((i) => i.anticipable)).toEqual([false, true, true, true, true]);
    expect(result.current.anticipable.map((i) => i.installmentNumber)).toEqual([2, 3, 4, 5]);
  });

  it("edits one installment from typed text, keeping the others", async () => {
    const { result } = await setup();
    const second = result.current.plan!.installments[1]!;
    let outcome: unknown;
    await act(async () => { outcome = await result.current.editInstallment(second, { amountText: "120,00", date: second.date }); });
    expect(outcome).toEqual({ ok: true });
    await waitFor(() => expect(result.current.plan?.installments.map((i) => i.amountCents)).toEqual([10000, 12000, 10000, 10000, 10000]));
    expect(result.current.plan?.remainingCents).toBe(42000);
  });

  it("rejects an invalid amount or date when editing", async () => {
    const { result } = await setup();
    const second = result.current.plan!.installments[1]!;
    let a: unknown, b: unknown;
    await act(async () => {
      a = await result.current.editInstallment(second, { amountText: "abc", date: second.date });
      b = await result.current.editInstallment(second, { amountText: "10", date: "" });
    });
    expect(a).toEqual({ ok: false, error: "invalid_amount" });
    expect(b).toEqual({ ok: false, error: "invalid_date" });
  });

  it("sums the picked installments as the nominal amount and reports the saving", async () => {
    const { result } = await setup();
    const ids = result.current.anticipable.slice(1).map((i) => i.id);
    expect(result.current.anticipationSummary(ids, "270,00")).toEqual({ nominalCents: 30000, paidCents: 27000, savingCents: 3000 });
    expect(result.current.anticipationSummary(ids, "abc")).toEqual({ nominalCents: 30000, paidCents: null, savingCents: null });
  });

  it("anticipates installments paying less, and replaces them with one item", async () => {
    const { result } = await setup();
    const ids = result.current.anticipable.slice(1).map((i) => i.id);
    let outcome: unknown;
    await act(async () => { outcome = await result.current.anticipate({ installmentIds: ids, amountText: "270,00", date: "2026-10-20" }); });
    expect(outcome).toEqual({ ok: true });
    await waitFor(() => expect(result.current.plan?.installments.map((i) => i.installmentNumber)).toEqual([1, 2, null]));
    expect(result.current.plan).toMatchObject({ remainingCount: 1, paidCents: 37000 });
  });

  it("rejects anticipation without a selection, with bad amounts, or above the nominal value", async () => {
    const { result } = await setup();
    const id = result.current.anticipable[0]!.id;
    let none: unknown, bad: unknown, above: unknown;
    await act(async () => {
      none = await result.current.anticipate({ installmentIds: [], amountText: "10", date: "2026-10-20" });
      bad = await result.current.anticipate({ installmentIds: [id], amountText: "abc", date: "2026-10-20" });
      above = await result.current.anticipate({ installmentIds: [id], amountText: "100,01", date: "2026-10-20" });
    });
    expect(none).toEqual({ ok: false, error: "nothing_to_anticipate" });
    expect(bad).toEqual({ ok: false, error: "invalid_amount" });
    expect(above).toEqual({ ok: false, error: "anticipation_above_nominal" });
  });

  it("cancels the remaining installments", async () => {
    const repo = await seeded();
    const { result } = renderHookWithProviders(() => usePlanViewModel(1), repo);
    await waitFor(() => expect(result.current.plan).toBeDefined());
    await act(() => result.current.cancel());
    expect(repo.calls).toContain("cancelPlan");
    expect((await repo.getPlan(1)).installments).toHaveLength(1);
  });
});
