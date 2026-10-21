import { describe, expect, it } from "vitest";
import {
  CATEGORY_ICONS,
  CATEGORY_ICON_GROUPS,
  CATEGORY_KINDS,
  DEFAULT_CATEGORIES,
  categoryAllows,
  isCategoryIcon,
  type Category,
} from "./category";

const food: Category = { id: 1, name: "Food", kind: "expense", icon: "🛒", archived: false };
const salary: Category = { id: 2, name: "Salary", kind: "income", icon: "💼", archived: false };

describe("categoryAllows", () => {
  it("keeps income and expenses apart", () => {
    expect(categoryAllows(food, "expense")).toBe(true);
    expect(categoryAllows(food, "income")).toBe(false);
    expect(categoryAllows(salary, "income")).toBe(true);
    expect(categoryAllows(salary, "expense")).toBe(false);
  });

  it("never allows a category on transfers", () => {
    expect(categoryAllows(food, "transfer")).toBe(false);
    expect(categoryAllows(salary, "transfer")).toBe(false);
  });

  it("has exactly the two kinds", () => {
    expect([...CATEGORY_KINDS]).toEqual(["expense", "income"]);
  });
});

describe("icons", () => {
  it("offers a curated list with no repeated icon", () => {
    expect(CATEGORY_ICONS.length).toBeGreaterThanOrEqual(60);
    expect(new Set(CATEGORY_ICONS).size).toBe(CATEGORY_ICONS.length);
  });

  it("groups them by theme, every group non-empty and named", () => {
    for (const group of CATEGORY_ICON_GROUPS) {
      expect(group.id).toMatch(/^[a-z]+$/);
      expect(group.icons.length).toBeGreaterThan(0);
    }
    expect(CATEGORY_ICON_GROUPS.flatMap((g) => g.icons)).toEqual([...CATEGORY_ICONS]);
  });

  it("recognizes only listed icons", () => {
    expect(isCategoryIcon("🛒")).toBe(true);
    expect(isCategoryIcon("🦄🦄")).toBe(false);
    expect(isCategoryIcon("shopping")).toBe(false);
    expect(isCategoryIcon("")).toBe(false);
  });
});

describe("default categories", () => {
  it("are the basic income and expense categories, each with a valid icon", () => {
    const names = (kind: string) => DEFAULT_CATEGORIES.filter((c) => c.kind === kind).map((c) => c.name);
    expect(names("income")).toEqual(["Salário", "Projetos", "Outras receitas"]);
    expect(names("expense")).toEqual([
      "Moradia", "Assinaturas", "Carro", "Transporte", "Mercado", "Comida fora", "Cuidados pessoais",
      "Lazer", "Presentes/Doações", "Educação", "Vestuário", "Saúde", "Dívidas", "Outros",
    ]);
    for (const c of DEFAULT_CATEGORIES) expect(isCategoryIcon(c.icon), c.name).toBe(true);
  });

  it("have no repeated name within a kind", () => {
    const keys = DEFAULT_CATEGORIES.map((c) => `${c.kind}:${c.name.toLowerCase()}`);
    expect(new Set(keys).size).toBe(keys.length);
  });
});
