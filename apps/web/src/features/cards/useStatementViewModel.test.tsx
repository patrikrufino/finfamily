import { act, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { createFakeRepository } from "../../test/fakeRepository";
import { renderHookWithProviders } from "../../test/render";
import { useStatementViewModel } from "./useStatementViewModel";

const seeded = async () => {
  const repo = createFakeRepository({
    today: "2026-11-02",
    accounts: [{ name: "Checking", type: "checking", initialBalanceCents: 500000 }],
    cards: [{ name: "Visa", limitCents: 500000, closingDay: 25, dueDay: 5 }],
  });
  const buy = (date: string, amountCents: number) =>
    repo.createTransaction({
      kind: "expense", amountCents, date, accountId: null, cardId: 1, toAccountId: null, categoryId: null,
      description: "", status: "settled", personId: 1,
    });
  await buy("2026-10-05", 100000);
  await buy("2026-10-26", 30000);
  return repo;
};

const setup = async () => {
  const hook = renderHookWithProviders(() => useStatementViewModel(1), await seeded());
  await waitFor(() => expect(hook.result.current.statement).toBeDefined());
  return hook;
};

describe("useStatementViewModel", () => {
  it("opens on the statement that is currently open", async () => {
    const { result } = await setup();
    // today is 2026-11-02 and the closing day is 25, so the open statement is November's.
    expect(result.current.statement).toMatchObject({ month: "2026-11", totalCents: 30000, status: "open" });
  });

  it("navigates to previous and next statements", async () => {
    const { result } = await setup();
    act(() => result.current.previousMonth());
    await waitFor(() => expect(result.current.statement?.month).toBe("2026-10"));
    expect(result.current.statement).toMatchObject({ totalCents: 100000, status: "closed" });
    act(() => result.current.nextMonth());
    await waitFor(() => expect(result.current.statement?.month).toBe("2026-11"));
  });

  it("pays the statement and records interest separately", async () => {
    const { result } = await setup();
    act(() => result.current.previousMonth());
    await waitFor(() => expect(result.current.statement?.month).toBe("2026-10"));
    let outcome: unknown;
    await act(async () => {
      outcome = await result.current.pay({ accountId: 1, amountText: "1.000,00", interestText: "20,00", fineText: "", date: "2026-11-02" });
    });
    expect(outcome).toEqual({ ok: true });
    await waitFor(() => expect(result.current.statement).toMatchObject({ status: "paid", remainingCents: 0, feesCents: 2000 }));
  });

  it("rejects invalid payment amounts without calling the API", async () => {
    const { result } = await setup();
    let outcomes: unknown[] = [];
    await act(async () => {
      outcomes = [
        await result.current.pay({ accountId: 1, amountText: "abc", interestText: "", fineText: "", date: "2026-11-02" }),
        await result.current.pay({ accountId: 1, amountText: "0", interestText: "", fineText: "", date: "2026-11-02" }),
        await result.current.pay({ accountId: 1, amountText: "10", interestText: "x", fineText: "", date: "2026-11-02" }),
      ];
    });
    expect(outcomes).toEqual([
      { ok: false, error: "invalid_amount" },
      { ok: false, error: "invalid_amount" },
      { ok: false, error: "invalid_amount" },
    ]);
  });

  it("offers the remaining amount as the suggested payment", async () => {
    const { result } = await setup();
    expect(result.current.statement?.remainingCents).toBe(30000);
  });

  it("changes the closing rule and rejects rules in the past", async () => {
    const { result } = await setup();
    let ok: unknown, past: unknown, invalid: unknown;
    await act(async () => {
      ok = await result.current.changeRule({ fromMonth: "2026-12", closingDay: "10", dueDay: "20" });
      past = await result.current.changeRule({ fromMonth: "2026-09", closingDay: "10", dueDay: "20" });
      invalid = await result.current.changeRule({ fromMonth: "2026-12", closingDay: "0", dueDay: "20" });
    });
    expect(ok).toEqual({ ok: true });
    expect(past).toEqual({ ok: false, error: "rule_in_past" });
    expect(invalid).toEqual({ ok: false, error: "invalid_day" });
  });

  it("removes a payment", async () => {
    const { result } = await setup();
    act(() => result.current.previousMonth());
    await waitFor(() => expect(result.current.statement?.month).toBe("2026-10"));
    await act(async () => {
      await result.current.pay({ accountId: 1, amountText: "400", interestText: "", fineText: "", date: "2026-11-02" });
    });
    await waitFor(() => expect(result.current.statement?.payments).toHaveLength(1));
    await act(() => result.current.removeTransaction(result.current.statement!.payments[0]!.id));
    await waitFor(() => expect(result.current.statement?.payments).toHaveLength(0));
  });
});
