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
    categories: [
      { name: "Food", kind: "expense" },
      { name: "Salary", kind: "both" },
    ],
    cards: [{ name: "Visa", limitCents: 500000, closingDay: 25, dueDay: 5 }],
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
      kind: "income", amountCents: 250000, date: "2026-10-02", accountId: 1, toAccountId: null, categoryId: null,
      description: "Salary", status: "scheduled", personId: 2,
    });
    repo.calls.length = 0;
    const { result } = await setup(repo, { transaction: existing });
    expect(result.current.values).toMatchObject({ kind: "income", amountText: "2.500,00", settled: false, description: "Salary" });
    act(() => result.current.setField("description", "Salary Oct"));
    await act(async () => { await result.current.submit(); });
    expect(repo.calls).toEqual(["updateTransaction"]);
  });

  it("offers only categories that fit the transaction kind", async () => {
    const { result } = await setup();
    await waitFor(() => expect(result.current.categories).toHaveLength(2));
    expect(result.current.categories.map((c) => c.name)).toEqual(["Food", "Salary"]);
    act(() => result.current.setField("kind", "income"));
    expect(result.current.categories.map((c) => c.name)).toEqual(["Salary"]);
    act(() => result.current.setField("kind", "transfer"));
    expect(result.current.categories).toEqual([]);
  });

  it("clears an incompatible category when the kind changes", async () => {
    const { result } = await setup();
    await waitFor(() => expect(result.current.categories).toHaveLength(2));
    act(() => result.current.setField("categoryId", 1));
    act(() => result.current.setField("kind", "income"));
    expect(result.current.values.categoryId).toBeNull();
  });

  it("saves the chosen category", async () => {
    const { result, repo } = await setup();
    await waitFor(() => expect(result.current.categories).toHaveLength(2));
    act(() => { result.current.setField("amountText", "30"); result.current.setField("categoryId", 1); });
    await act(async () => { await result.current.submit(); });
    const [saved] = await repo.listTransactions({ month: "2026-10" });
    expect(saved?.categoryId).toBe(1);
  });

  it("lets an expense be charged to a card instead of an account", async () => {
    const { result, repo } = await setup();
    await waitFor(() => expect(result.current.cards).toHaveLength(1));
    act(() => { result.current.setField("amountText", "80"); result.current.setSource({ type: "card", id: 1 }); });
    expect(result.current.values).toMatchObject({ cardId: 1, accountId: null });
    await act(async () => { await result.current.submit(); });
    const [saved] = await repo.listTransactions({ month: "2026-10" });
    expect(saved).toMatchObject({ accountId: null, cardId: 1, kind: "expense" });
  });

  it("goes back to an account when the kind stops being an expense", async () => {
    const { result } = await setup();
    await waitFor(() => expect(result.current.cards).toHaveLength(1));
    act(() => result.current.setSource({ type: "card", id: 1 }));
    act(() => result.current.setField("kind", "income"));
    expect(result.current.values.cardId).toBeNull();
    expect(result.current.values.accountId).toBe(result.current.accounts[0]!.id);
  });

  it("prefills a card purchase when editing", async () => {
    const repo = seeded();
    const existing = await repo.createTransaction({
      kind: "expense", amountCents: 5000, date: "2026-10-02", accountId: null, cardId: 1, toAccountId: null,
      categoryId: null, description: "Shoes", status: "settled", personId: 1,
    });
    const { result } = await setup(repo, { transaction: existing });
    expect(result.current.values).toMatchObject({ cardId: 1, accountId: null, description: "Shoes" });
  });
});
