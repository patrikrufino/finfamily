import { act, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { createFakeRepository } from "../../test/fakeRepository";
import { renderHookWithProviders } from "../../test/render";
import { useCategoriesViewModel } from "./useCategoriesViewModel";

const seeded = () =>
  createFakeRepository({
    categories: [
      { name: "Mercado", kind: "expense", icon: "🛒" },
      { name: "Carro", kind: "expense", icon: "🚗" },
      { name: "Salário", kind: "income", icon: "💼" },
    ],
  });

describe("useCategoriesViewModel", () => {
  it("separates expense and income categories", async () => {
    const { result } = renderHookWithProviders(() => useCategoriesViewModel(), seeded());
    await waitFor(() => expect(result.current.expense).toHaveLength(2));
    expect(result.current.expense.map((c) => c.name)).toEqual(["Mercado", "Carro"]);
    expect(result.current.income.map((c) => c.name)).toEqual(["Salário"]);
  });

  it("creates a category of the chosen kind with an icon", async () => {
    const { result } = renderHookWithProviders(() => useCategoriesViewModel(), seeded());
    await waitFor(() => expect(result.current.income).toHaveLength(1));
    let outcome: unknown;
    await act(async () => { outcome = await result.current.createCategory({ name: " Projetos ", kind: "income", icon: "💻" }); });
    expect(outcome).toEqual({ ok: true });
    await waitFor(() => expect(result.current.income.map((c) => c.name)).toEqual(["Salário", "Projetos"]));
    expect(result.current.income[1]).toMatchObject({ icon: "💻", kind: "income" });
  });

  it("validates the name and surfaces duplicates only within the same kind", async () => {
    const { result } = renderHookWithProviders(() => useCategoriesViewModel(), seeded());
    await waitFor(() => expect(result.current.expense).toHaveLength(2));
    let empty: unknown, dup: unknown, other: unknown;
    await act(async () => {
      empty = await result.current.createCategory({ name: "  ", kind: "expense", icon: null });
      dup = await result.current.createCategory({ name: "mercado", kind: "expense", icon: null });
      other = await result.current.createCategory({ name: "Mercado", kind: "income", icon: null });
    });
    expect(empty).toEqual({ ok: false, error: "name_required" });
    expect(dup).toEqual({ ok: false, error: "category_name_taken" });
    expect(other).toEqual({ ok: true });
  });

  it("edits the name and the icon, and can remove the icon", async () => {
    const { result } = renderHookWithProviders(() => useCategoriesViewModel(), seeded());
    await waitFor(() => expect(result.current.expense).toHaveLength(2));
    await act(async () => { await result.current.updateCategory(1, { name: "Supermercado", icon: "🍎" }); });
    await waitFor(() => expect(result.current.expense[0]).toMatchObject({ name: "Supermercado", icon: "🍎" }));
    await act(async () => { await result.current.updateCategory(1, { name: "Supermercado", icon: null }); });
    await waitFor(() => expect(result.current.expense[0]?.icon).toBeNull());
  });

  it("rejects an empty name when editing", async () => {
    const { result } = renderHookWithProviders(() => useCategoriesViewModel(), seeded());
    let outcome: unknown;
    await act(async () => { outcome = await result.current.updateCategory(1, { name: " ", icon: null }); });
    expect(outcome).toEqual({ ok: false, error: "name_required" });
  });

  it("archives a category", async () => {
    const { result } = renderHookWithProviders(() => useCategoriesViewModel(), seeded());
    await waitFor(() => expect(result.current.expense).toHaveLength(2));
    await act(() => result.current.archiveCategory(2));
    await waitFor(() => expect(result.current.expense.map((c) => c.name)).toEqual(["Mercado"]));
  });

  it("adds the default categories, reporting how many were new, without duplicating", async () => {
    const { result } = renderHookWithProviders(() => useCategoriesViewModel(), seeded());
    await waitFor(() => expect(result.current.expense).toHaveLength(2));
    let first: unknown, second: unknown;
    await act(async () => {
      first = await result.current.addDefaults();
      second = await result.current.addDefaults();
    });
    expect(first).toEqual({ ok: true, created: 12 }); // 15 defaults minus Mercado, Carro and Salário the user already has
    expect(second).toEqual({ ok: true, created: 0 });
    await waitFor(() => expect(result.current.expense).toHaveLength(12));
    expect(result.current.income).toHaveLength(3);
  });
});
