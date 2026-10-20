import { describe, expect, it } from "vitest";
import { categoryAllows, type Category } from "./category";

const food: Category = { id: 1, name: "Food", kind: "expense", archived: false };
const salary: Category = { id: 2, name: "Salary", kind: "both", archived: false };

describe("categoryAllows", () => {
  it("lets expense-only categories take expenses but not income", () => {
    expect(categoryAllows(food, "expense")).toBe(true);
    expect(categoryAllows(food, "income")).toBe(false);
  });

  it("lets 'both' categories take income and expenses", () => {
    expect(categoryAllows(salary, "expense")).toBe(true);
    expect(categoryAllows(salary, "income")).toBe(true);
  });

  it("never allows a category on transfers", () => {
    expect(categoryAllows(salary, "transfer")).toBe(false);
  });
});
