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
      { name: "Food", kind: "expense", icon: "🛒" },
      { name: "Salary", kind: "income", icon: "💼" },
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
    await waitFor(() => expect(result.current.categories.length).toBeGreaterThan(0));
    expect(result.current.categories.map((c) => c.name)).toEqual(["Food"]);
    act(() => result.current.setField("kind", "income"));
    expect(result.current.categories.map((c) => c.name)).toEqual(["Salary"]);
    act(() => result.current.setField("kind", "transfer"));
    expect(result.current.categories).toEqual([]);
  });

  it("clears an incompatible category when the kind changes", async () => {
    const { result } = await setup();
    await waitFor(() => expect(result.current.categories.length).toBeGreaterThan(0));
    act(() => result.current.setField("categoryId", 1));
    act(() => result.current.setField("kind", "income"));
    expect(result.current.values.categoryId).toBeNull();
  });

  it("saves the chosen category", async () => {
    const { result, repo } = await setup();
    await waitFor(() => expect(result.current.categories.length).toBeGreaterThan(0));
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

  describe("installments", () => {
    it("previews the split when an installment count is typed", async () => {
      const { result } = await setup();
      act(() => { result.current.setField("amountText", "100,00"); result.current.setField("installmentsText", "3"); });
      expect(result.current.installmentPreview).toEqual({ count: 3, firstCents: 3333, lastCents: 3334 });
    });

    it("has no preview for a single payment, invalid counts or non-expenses", async () => {
      const { result } = await setup();
      act(() => result.current.setField("amountText", "100,00"));
      expect(result.current.installmentPreview).toBeNull();
      act(() => result.current.setField("installmentsText", "abc"));
      expect(result.current.installmentPreview).toBeNull();
      act(() => { result.current.setField("installmentsText", "3"); result.current.setField("kind", "income"); });
      expect(result.current.installmentPreview).toBeNull();
    });

    it("creates a plan instead of one transaction", async () => {
      const { result, repo } = await setup();
      act(() => {
        result.current.setField("amountText", "300,00");
        result.current.setField("description", "Sofa");
        result.current.setField("installmentsText", "3");
      });
      let ok = false;
      await act(async () => { ok = await result.current.submit(); });
      expect(ok).toBe(true);
      expect(repo.calls).toContain("createPlan");
      expect(repo.calls).not.toContain("createTransaction");
      const plans = await repo.listPlans();
      expect(plans[0]).toMatchObject({ description: "Sofa", count: 3, totalCents: 30000, accountId: 1 });
    });

    it("charges the plan to a card when a card is chosen", async () => {
      const { result, repo } = await setup();
      await waitFor(() => expect(result.current.cards).toHaveLength(1));
      act(() => {
        result.current.setField("amountText", "300,00");
        result.current.setField("description", "Sofa");
        result.current.setField("installmentsText", "3");
        result.current.setSource({ type: "card", id: 1 });
      });
      await act(async () => { await result.current.submit(); });
      expect((await repo.listPlans())[0]).toMatchObject({ cardId: 1, accountId: null });
    });

    it("requires a description and a valid count for installments", async () => {
      const { result } = await setup();
      act(() => { result.current.setField("amountText", "300,00"); result.current.setField("installmentsText", "3"); });
      await act(async () => { await result.current.submit(); });
      expect(result.current.errors).toContain("description_required");
      act(() => { result.current.setField("description", "Sofa"); result.current.setField("installmentsText", "1"); });
      await act(async () => { await result.current.submit(); });
      expect(result.current.errors).toContain("installment_count_invalid");
    });

    it("does not offer installments when editing an existing transaction", async () => {
      const repo = seeded();
      const existing = await repo.createTransaction({
        kind: "expense", amountCents: 5000, date: "2026-10-02", accountId: 1, toAccountId: null,
        categoryId: null, description: "Shoes", status: "settled", personId: 1,
      });
      const { result } = await setup(repo, { transaction: existing });
      expect(result.current.canSplitInInstallments).toBe(false);
    });
  });

  describe("recurring", () => {
    it("offers repetition for new income and expenses only", async () => {
      const { result } = await setup();
      expect(result.current.canRepeat).toBe(true);
      act(() => result.current.setField("kind", "transfer"));
      expect(result.current.canRepeat).toBe(false);
    });

    it("does not offer repetition when editing", async () => {
      const repo = seeded();
      const existing = await repo.createTransaction({
        kind: "expense", amountCents: 5000, date: "2026-10-02", accountId: 1, toAccountId: null,
        categoryId: null, description: "Shoes", status: "settled", personId: 1,
      });
      const { result } = await setup(repo, { transaction: existing });
      expect(result.current.canRepeat).toBe(false);
    });

    it("creates a recurring rule instead of one transaction", async () => {
      const { result, repo } = await setup();
      act(() => {
        result.current.setField("amountText", "1.200,00");
        result.current.setField("description", "Rent");
        result.current.setField("repeat", "monthly");
      });
      let ok = false;
      await act(async () => { ok = await result.current.submit(); });
      expect(ok).toBe(true);
      expect(repo.calls).toContain("createRecurring");
      expect(repo.calls).not.toContain("createTransaction");
      expect((await repo.listRecurring())[0]).toMatchObject({ description: "Rent", amountCents: 120000, frequency: "monthly", startDate: "2026-10-20", accountId: 1, cardId: null });
    });

    it("charges a repeating expense to a card", async () => {
      const { result, repo } = await setup();
      await waitFor(() => expect(result.current.cards).toHaveLength(1));
      act(() => {
        result.current.setField("amountText", "39,90");
        result.current.setField("description", "Streaming");
        result.current.setField("repeat", "monthly");
        result.current.setSource({ type: "card", id: 1 });
      });
      await act(async () => { await result.current.submit(); });
      expect((await repo.listRecurring())[0]).toMatchObject({ cardId: 1, accountId: null });
    });

    it("is cleared when the kind stops allowing it", async () => {
      const { result } = await setup();
      act(() => result.current.setField("repeat", "monthly"));
      act(() => result.current.setField("kind", "transfer"));
      expect(result.current.values.repeat).toBe("none");
    });

    it("cannot be combined with installments", async () => {
      const { result } = await setup();
      act(() => {
        result.current.setField("amountText", "300,00");
        result.current.setField("description", "Sofa");
        result.current.setField("installmentsText", "3");
        result.current.setField("repeat", "monthly");
      });
      await act(async () => { await result.current.submit(); });
      expect(result.current.errors).toContain("recurring_and_installments");
    });
  });
});
