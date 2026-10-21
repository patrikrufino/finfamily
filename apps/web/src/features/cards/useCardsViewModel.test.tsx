import { act, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { createFakeRepository } from "../../test/fakeRepository";
import { renderHookWithProviders } from "../../test/render";
import { useCardsViewModel } from "./useCardsViewModel";

const seeded = () =>
  createFakeRepository({
    today: "2026-10-10",
    cards: [{ name: "Visa", limitCents: 500000, closingDay: 25, dueDay: 5 }],
  });

describe("useCardsViewModel", () => {
  it("lists cards with limit usage and the open statement", async () => {
    const { result } = renderHookWithProviders(() => useCardsViewModel(), seeded());
    await waitFor(() => expect(result.current.cards).toHaveLength(1));
    expect(result.current.cards[0]).toMatchObject({ name: "Visa", availableCents: 500000, openStatementMonth: "2026-10" });
  });

  it("creates a card from typed text", async () => {
    const { result } = renderHookWithProviders(() => useCardsViewModel(), seeded());
    let outcome: unknown;
    await act(async () => {
      outcome = await result.current.createCard({ name: "Master", limitText: "3.000,00", closingDay: "10", dueDay: "18" });
    });
    expect(outcome).toEqual({ ok: true });
    await waitFor(() => expect(result.current.cards).toHaveLength(2));
    expect(result.current.cards.find((c) => c.name === "Master")).toMatchObject({ limitCents: 300000, closingDay: 10, dueDay: 18 });
  });

  it("validates name, limit and days without calling the API", async () => {
    const repo = seeded();
    const { result } = renderHookWithProviders(() => useCardsViewModel(), repo);
    const create = (over: Record<string, string>) =>
      result.current.createCard({ name: "X", limitText: "100", closingDay: "10", dueDay: "20", ...over });
    let outcomes: unknown[] = [];
    await act(async () => {
      outcomes = [await create({ name: " " }), await create({ limitText: "abc" }), await create({ closingDay: "0" }), await create({ dueDay: "32" }), await create({ closingDay: "x" })];
    });
    expect(outcomes).toEqual([
      { ok: false, error: "name_required" },
      { ok: false, error: "invalid_amount" },
      { ok: false, error: "invalid_day" },
      { ok: false, error: "invalid_day" },
      { ok: false, error: "invalid_day" },
    ]);
    expect(repo.calls).not.toContain("createCard");
  });

  it("surfaces duplicate names", async () => {
    const { result } = renderHookWithProviders(() => useCardsViewModel(), seeded());
    let outcome: unknown;
    await act(async () => {
      outcome = await result.current.createCard({ name: "visa", limitText: "1", closingDay: "10", dueDay: "20" });
    });
    expect(outcome).toEqual({ ok: false, error: "card_name_taken" });
  });

  it("archives a card", async () => {
    const { result } = renderHookWithProviders(() => useCardsViewModel(), seeded());
    await waitFor(() => expect(result.current.cards).toHaveLength(1));
    await act(() => result.current.archiveCard(1));
    await waitFor(() => expect(result.current.cards).toHaveLength(0));
  });
});
