import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "./app";
import { createDatabase } from "./db/client";

let app: ReturnType<typeof createApp>;
let accountId: number;
let food: number;
let salary: number;

const json = (method: string, body?: unknown): RequestInit => ({
  method,
  headers: { "content-type": "application/json" },
  body: body === undefined ? undefined : JSON.stringify(body),
});
const post = async (path: string, body: unknown) => ((await (await app.request(path, json("POST", body))).json()) as any);
const spend = (amountCents: number, over: Record<string, unknown> = {}) =>
  app.request("/api/transactions", json("POST", {
    kind: "expense", amountCents, date: "2026-10-10", accountId, categoryId: food, status: "settled", personId: 1, ...over,
  }));
const budget = async (month = "2026-10") => ((await (await app.request(`/api/budget?month=${month}`)).json()) as any);
const row = (b: any, id: number) => b.categories.find((c: any) => c.categoryId === id);

beforeEach(async () => {
  app = createApp(createDatabase(":memory:"));
  accountId = (await post("/api/accounts", { name: "Checking", type: "checking" })).id;
  food = (await post("/api/categories", { name: "Food", kind: "expense" })).id;
  salary = (await post("/api/categories", { name: "Salary", kind: "both" })).id;
});

describe("budget API", () => {
  it("sets a monthly budget and reports progress from settled expenses", async () => {
    await app.request(`/api/budgets/${food}`, json("PUT", { month: "2026-10", amountCents: 50000 }));
    await spend(45000);
    await spend(9999, { date: "2026-09-30" });
    await spend(1000, { status: "scheduled" });
    const food_ = row(await budget(), food);
    expect(food_).toMatchObject({
      budgetCents: 50000, spentCents: 45000, committedCents: 1000, remainingCents: 5000,
      availableAfterCommittedCents: 4000, status: "warning",
    });
  });

  it("flags over-budget categories", async () => {
    await app.request(`/api/budgets/${food}`, json("PUT", { month: "2026-10", amountCents: 50000 }));
    await spend(52000);
    expect(row(await budget(), food)).toMatchObject({ remainingCents: -2000, status: "over" });
  });

  it("keeps earlier months unchanged when the budget changes (validity)", async () => {
    await app.request(`/api/budgets/${food}`, json("PUT", { month: "2026-01", amountCents: 40000 }));
    await app.request(`/api/budgets/${food}`, json("PUT", { month: "2026-07", amountCents: 60000 }));
    expect(row(await budget("2026-06"), food).budgetCents).toBe(40000);
    expect(row(await budget("2026-07"), food).budgetCents).toBe(60000);
    expect(row(await budget("2025-12"), food).budgetCents).toBe(0);
  });

  it("updates the entry when set twice for the same month", async () => {
    await app.request(`/api/budgets/${food}`, json("PUT", { month: "2026-10", amountCents: 1000 }));
    await app.request(`/api/budgets/${food}`, json("PUT", { month: "2026-10", amountCents: 2000 }));
    expect(row(await budget(), food).budgetCents).toBe(2000);
  });

  it("reports uncategorized spending and totals", async () => {
    await app.request(`/api/budgets/${food}`, json("PUT", { month: "2026-10", amountCents: 50000 }));
    await spend(10000);
    await spend(3000, { categoryId: null });
    const b = await budget();
    expect(b.uncategorized).toEqual({ spentCents: 3000, committedCents: 0 });
    expect(b.totals).toMatchObject({ budgetCents: 50000, spentCents: 10000, remainingCents: 40000 });
  });

  it("does not count income or transfers as spending", async () => {
    await post("/api/transactions", {
      kind: "income", amountCents: 100000, date: "2026-10-05", accountId, categoryId: salary, personId: 1,
    });
    expect(row(await budget(), salary).spentCents).toBe(0);
  });

  it("validates input", async () => {
    expect((await app.request(`/api/budgets/${food}`, json("PUT", { month: "2026-13", amountCents: 1 }))).status).toBe(422);
    expect((await app.request(`/api/budgets/${food}`, json("PUT", { month: "2026-10", amountCents: -1 }))).status).toBe(422);
    expect((await app.request(`/api/budgets/999`, json("PUT", { month: "2026-10", amountCents: 1 }))).status).toBe(404);
    expect((await app.request("/api/budget?month=bad")).status).toBe(422);
  });

  it("hides archived categories without activity but keeps ones with spending", async () => {
    const old = (await post("/api/categories", { name: "Old", kind: "expense" })).id;
    await spend(500, { categoryId: old });
    await app.request(`/api/categories/${old}`, json("PATCH", { archived: true }));
    const unused = (await post("/api/categories", { name: "Unused", kind: "expense" })).id;
    await app.request(`/api/categories/${unused}`, json("PATCH", { archived: true }));
    const b = await budget();
    expect(row(b, old)).toBeDefined();
    expect(row(b, unused)).toBeUndefined();
  });

  it("does not count balance adjustments as spending", async () => {
    await app.request(`/api/accounts/${accountId}/adjust`, json("POST", { targetBalanceCents: -5000, personId: 1, date: "2026-10-10" }));
    expect((await budget()).uncategorized).toEqual({ spentCents: 0, committedCents: 0 });
  });
});
