import { act, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { createFakeRepository } from "../../test/fakeRepository";
import { renderHookWithProviders } from "../../test/render";
import { useDebtViewModel } from "./useDebtViewModel";
import { useDebtsViewModel } from "./useDebtsViewModel";

const seeded = async () => {
  const repo = createFakeRepository({
    today: "2026-10-20",
    accounts: [{ name: "Checking", type: "checking", initialBalanceCents: 500000 }],
    categories: [{ name: "Debts", kind: "expense" }],
  });
  await repo.createDebt({ creditor: "Bank", originalCents: 100000, openedOn: "2026-01-10", categoryId: 1, personId: 1 });
  return repo;
};

describe("useDebtsViewModel", () => {
  it("lists debts and totals what is still owed", async () => {
    const repo = await seeded();
    await repo.createDebt({ creditor: "Store", originalCents: 25000, openedOn: "2026-02-01", categoryId: null, personId: 1 });
    const { result } = renderHookWithProviders(() => useDebtsViewModel(), repo);
    await waitFor(() => expect(result.current.debts).toHaveLength(2));
    expect(result.current.totalOwedCents).toBe(125000);
  });

  it("creates a debt from typed text for the selected person", async () => {
    const { result } = renderHookWithProviders(() => useDebtsViewModel(), await seeded());
    await waitFor(() => expect(result.current.debts).toHaveLength(1));
    let outcome: unknown;
    await act(async () => {
      outcome = await result.current.createDebt({ creditor: " Friend ", originalText: "1.250,50", openedOn: "2026-10-01", categoryId: null });
    });
    expect(outcome).toEqual({ ok: true });
    await waitFor(() => expect(result.current.debts).toHaveLength(2));
    expect(result.current.debts.find((d) => d.creditor === "Friend")).toMatchObject({ originalCents: 125050, personId: 1 });
  });

  it("validates before calling the API", async () => {
    const repo = await seeded();
    const { result } = renderHookWithProviders(() => useDebtsViewModel(), repo);
    const create = (over: Record<string, string>) =>
      result.current.createDebt({ creditor: "X", originalText: "10", openedOn: "2026-10-01", categoryId: null, ...over });
    let outcomes: unknown[] = [];
    await act(async () => {
      outcomes = [await create({ creditor: " " }), await create({ originalText: "abc" }), await create({ originalText: "0" }), await create({ openedOn: "" })];
    });
    expect(outcomes).toEqual([
      { ok: false, error: "name_required" },
      { ok: false, error: "invalid_amount" },
      { ok: false, error: "invalid_amount" },
      { ok: false, error: "invalid_date" },
    ]);
    expect(repo.calls.filter((c) => c === "createDebt")).toHaveLength(1);
  });
});

describe("useDebtViewModel", () => {
  const setup = async () => {
    const repo = await seeded();
    const hook = renderHookWithProviders(() => useDebtViewModel(1), repo);
    await waitFor(() => expect(hook.result.current.debt).toBeDefined());
    return { ...hook, repo };
  };

  it("loads the debt with its statement", async () => {
    const { result } = await setup();
    expect(result.current.debt).toMatchObject({ creditor: "Bank", balanceCents: 100000, status: "open" });
    expect(result.current.debt?.ledger.map((l) => l.type)).toEqual(["opening"]);
  });

  it("posts interest and discounts from typed text", async () => {
    const { result } = await setup();
    let a: unknown, b: unknown;
    await act(async () => {
      a = await result.current.addInterest({ amountText: "80,00", date: "2026-02-01", note: "Feb" });
      b = await result.current.addDiscount({ amountText: "20,00", date: "2026-03-01", note: "" });
    });
    expect([a, b]).toEqual([{ ok: true }, { ok: true }]);
    await waitFor(() => expect(result.current.debt).toMatchObject({ interestCents: 8000, discountCents: 2000, balanceCents: 106000 }));
  });

  it("pays partially and then totally, which settles the debt", async () => {
    const { result } = await setup();
    await act(async () => { await result.current.pay({ accountId: 1, amountText: "300,00", date: "2026-10-20", categoryId: null }); });
    await waitFor(() => expect(result.current.debt?.balanceCents).toBe(70000));
    await act(async () => { await result.current.pay({ accountId: 1, amountText: "700,00", date: "2026-10-20", categoryId: null }); });
    await waitFor(() => expect(result.current.debt?.status).toBe("settled"));
  });

  it("rejects invalid amounts and dates, and surfaces server rules", async () => {
    const { result } = await setup();
    const pay = (over: Record<string, unknown>) =>
      result.current.pay({ accountId: 1, amountText: "10", date: "2026-10-20", categoryId: null, ...over } as never);
    let outcomes: unknown[] = [];
    await act(async () => {
      outcomes = [await pay({ amountText: "abc" }), await pay({ amountText: "0" }), await pay({ date: "" }), await pay({ amountText: "1.000,01" }), await pay({ date: "2026-10-21" })];
    });
    expect(outcomes).toEqual([
      { ok: false, error: "invalid_amount" },
      { ok: false, error: "invalid_amount" },
      { ok: false, error: "invalid_date" },
      { ok: false, error: "payment_above_balance" },
      { ok: false, error: "payment_date_in_future" },
    ]);
  });

  it("removes an interest entry and a payment, and refuses unsafe removals", async () => {
    const { result } = await setup();
    await act(async () => { await result.current.addInterest({ amountText: "80,00", date: "2026-02-01", note: "" }); });
    await waitFor(() => expect(result.current.debt?.ledger).toHaveLength(2));
    await act(async () => { await result.current.pay({ accountId: 1, amountText: "1.050,00", date: "2026-10-20", categoryId: null }); });
    await waitFor(() => expect(result.current.debt?.ledger).toHaveLength(3));
    const interest = result.current.debt!.ledger.find((l) => l.type === "interest")!;
    let blocked: unknown;
    await act(async () => { blocked = await result.current.removeLine(interest); });
    expect(blocked).toEqual({ ok: false, error: "balance_would_be_negative" });
    const payment = result.current.debt!.ledger.find((l) => l.type === "payment")!;
    await act(async () => { await result.current.removeLine(payment); });
    await waitFor(() => expect(result.current.debt?.ledger.map((l) => l.type)).toEqual(["opening", "interest"]));
    await act(async () => { await result.current.removeLine(interest); });
    await waitFor(() => expect(result.current.debt?.ledger.map((l) => l.type)).toEqual(["opening"]));
  });

  it("deletes a debt without payments", async () => {
    const { result, repo } = await setup();
    let outcome: unknown;
    await act(async () => { outcome = await result.current.deleteDebt(); });
    expect(outcome).toEqual({ ok: true });
    expect(await repo.listDebts()).toHaveLength(0);
  });

  it("does not delete a debt that has payments", async () => {
    const { result } = await setup();
    await act(async () => { await result.current.pay({ accountId: 1, amountText: "10", date: "2026-10-20", categoryId: null }); });
    await waitFor(() => expect(result.current.debt?.paidCents).toBe(1000));
    let outcome: unknown;
    await act(async () => { outcome = await result.current.deleteDebt(); });
    expect(outcome).toEqual({ ok: false, error: "debt_has_payments" });
  });
});
