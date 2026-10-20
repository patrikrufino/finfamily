import { act, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { createFakeRepository } from "../../test/fakeRepository";
import { renderHookWithProviders } from "../../test/render";
import { useTransactionFormViewModel } from "./useTransactionFormViewModel";

const seeded = () =>
  createFakeRepository({
    accounts: [
      { name: "Checking", type: "checking", initialBalanceCents: 0 },
      { name: "Savings", type: "savings", initialBalanceCents: 0 },
    ],
  });

const setup = async (repo = seeded(), options: Parameters<typeof useTransactionFormViewModel>[0] = {}) => {
  const hook = renderHookWithProviders(() => useTransactionFormViewModel({ today: "2026-10-20", ...options }), repo);
  await waitFor(() => expect(hook.result.current.accounts.length).toBeGreaterThan(0));
  return { ...hook, repo };
};

describe("useTransactionFormViewModel", () => {
  it("starts with sensible defaults", async () => {
    const { result } = await setup();
    expect(result.current.values).toMatchObject({ kind: "expense", date: "2026-10-20", settled: true });
    expect(result.current.values.accountId).toBe(result.current.accounts[0]!.id);
  });

  it("blocks submit with an invalid amount", async () => {
    const { result, repo } = await setup();
    act(() => result.current.setField("amountText", "abc"));
    let ok = true;
    await act(async () => { ok = await result.current.submit(); });
    expect(ok).toBe(false);
    expect(result.current.errors).toContain("invalid_amount");
    expect(repo.calls).not.toContain("createTransaction");
  });

  it("blocks a zero amount via domain rules", async () => {
    const { result } = await setup();
    act(() => result.current.setField("amountText", "0"));
    await act(async () => { await result.current.submit(); });
    expect(result.current.errors).toContain("amount_must_be_positive");
  });

  it("requires a destination for transfers", async () => {
    const { result } = await setup();
    act(() => { result.current.setField("kind", "transfer"); result.current.setField("amountText", "10"); });
    await act(async () => { await result.current.submit(); });
    expect(result.current.errors).toContain("transfer_needs_destination");
  });

  it("creates the transaction from pt-BR text and the selected person", async () => {
    const { result, repo } = await setup();
    act(() => { result.current.setField("amountText", "12,50"); result.current.setField("description", " Lunch "); });
    let ok = false;
    await act(async () => { ok = await result.current.submit(); });
    expect(ok).toBe(true);
    const [saved] = await repo.listTransactions({ month: "2026-10" });
    expect(saved).toMatchObject({ amountCents: 1250, description: "Lunch", personId: 1, status: "settled" });
  });

  it("clears the destination when switching away from transfer", async () => {
    const { result } = await setup();
    act(() => { result.current.setField("kind", "transfer"); result.current.setField("toAccountId", 2); });
    act(() => result.current.setField("kind", "income"));
    expect(result.current.values.toAccountId).toBeNull();
  });

  it("prefills when editing and updates instead of creating", async () => {
    const repo = seeded();
    const existing = await repo.createTransaction({
      kind: "income", amountCents: 250000, date: "2026-10-02", accountId: 1, toAccountId: null,
      description: "Salary", status: "scheduled", personId: 2,
    });
    repo.calls.length = 0;
    const { result } = await setup(repo, { transaction: existing });
    expect(result.current.values).toMatchObject({ kind: "income", amountText: "2.500,00", settled: false, description: "Salary" });
    act(() => result.current.setField("description", "Salary Oct"));
    await act(async () => { await result.current.submit(); });
    expect(repo.calls).toEqual(["updateTransaction"]);
  });
});
