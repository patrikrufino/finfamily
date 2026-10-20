import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "./app";
import { createDatabase } from "./db/client";

let app: ReturnType<typeof createApp>;

const json = (method: string, body?: unknown): RequestInit => ({
  method,
  headers: { "content-type": "application/json" },
  body: body === undefined ? undefined : JSON.stringify(body),
});
const createCategory = async (over: Record<string, unknown> = {}) => {
  const res = await app.request("/api/categories", json("POST", { name: "Food", kind: "expense", ...over }));
  return { res, body: (await res.json()) as any };
};

beforeEach(() => {
  app = createApp(createDatabase(":memory:"));
});

describe("categories API", () => {
  it("creates and lists categories", async () => {
    const { res, body } = await createCategory();
    expect(res.status).toBe(201);
    expect(body).toMatchObject({ name: "Food", kind: "expense", archived: false });
    expect(((await (await app.request("/api/categories")).json()) as any[]).map((c) => c.name)).toEqual(["Food"]);
  });

  it("rejects invalid kinds and empty names", async () => {
    expect((await createCategory({ kind: "income" })).res.status).toBe(422);
    expect((await createCategory({ name: " " })).res.status).toBe(422);
  });

  it("rejects duplicate names among active categories, ignoring case", async () => {
    await createCategory();
    expect((await createCategory({ name: "food" })).res.status).toBe(409);
  });

  it("renames, archives and hides archived by default", async () => {
    const { body } = await createCategory();
    const renamed = await app.request(`/api/categories/${body.id}`, json("PATCH", { name: "Groceries" }));
    expect(((await renamed.json()) as any).name).toBe("Groceries");
    await app.request(`/api/categories/${body.id}`, json("PATCH", { archived: true }));
    expect(((await (await app.request("/api/categories")).json()) as any[])).toHaveLength(0);
    expect(((await (await app.request("/api/categories?includeArchived=true")).json()) as any[])).toHaveLength(1);
  });

  it("refuses to narrow a category to expense-only while income uses it", async () => {
    const { body } = await createCategory({ name: "Salary", kind: "both" });
    const acc = (await (await app.request("/api/accounts", json("POST", { name: "A", type: "checking" }))).json()) as any;
    await app.request("/api/transactions", json("POST", {
      kind: "income", amountCents: 1000, date: "2026-10-01", accountId: acc.id, categoryId: body.id, personId: 1,
    }));
    const res = await app.request(`/api/categories/${body.id}`, json("PATCH", { kind: "expense" }));
    expect(res.status).toBe(409);
  });

  it("returns 404 for unknown categories", async () => {
    expect((await app.request("/api/categories/99", json("PATCH", { name: "x" }))).status).toBe(404);
  });
});
