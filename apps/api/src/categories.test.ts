import { DEFAULT_CATEGORIES } from "@finfamily/domain";
import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "./app";
import { createDatabase } from "./db/client";
import { seedDefaultCategories } from "./routes/categories";

let app: ReturnType<typeof createApp>;

const json = (method: string, body?: unknown): RequestInit => ({
  method,
  headers: { "content-type": "application/json" },
  body: body === undefined ? undefined : JSON.stringify(body),
});
const call = async (method: string, path: string, body?: unknown) => {
  const res = await app.request(path, json(method, body));
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : null };
};
const create = (over: Record<string, unknown> = {}) => call("POST", "/api/categories", { name: "Food", kind: "expense", ...over });
const list = async (qs = "") => (await call("GET", `/api/categories${qs}`)).body as any[];

beforeEach(() => {
  app = createApp(createDatabase(":memory:"));
});

describe("categories API", () => {
  it("creates and lists categories with their icon", async () => {
    const res = await create({ icon: "🛒" });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ name: "Food", kind: "expense", icon: "🛒", archived: false });
    expect((await list()).map((c) => c.name)).toEqual(["Food"]);
  });

  it("has no icon unless one is picked", async () => {
    expect((await create()).body.icon).toBeNull();
  });

  it("is for income or expense only", async () => {
    expect((await create({ kind: "income", name: "Salary" })).status).toBe(201);
    expect((await create({ kind: "both", name: "X" })).status).toBe(422);
    expect((await create({ name: " " })).status).toBe(422);
  });

  it("only accepts icons from the list", async () => {
    const res = await create({ icon: "🦄🦄" });
    expect(res.status).toBe(422);
    expect(res.body.errors).toContain("invalid_icon");
    expect((await create({ icon: "shopping" })).status).toBe(422);
  });

  it("rejects duplicate names among active categories of the same kind, ignoring case", async () => {
    await create();
    expect((await create({ name: "food" })).status).toBe(409);
  });

  it("lets the same name exist as income and as expense", async () => {
    await create({ name: "Outros" });
    expect((await create({ name: "Outros", kind: "income" })).status).toBe(201);
  });

  it("filters by kind", async () => {
    await create({ name: "Food" });
    await create({ name: "Salary", kind: "income" });
    expect((await list("?kind=income")).map((c) => c.name)).toEqual(["Salary"]);
    expect((await list("?kind=expense")).map((c) => c.name)).toEqual(["Food"]);
    expect((await call("GET", "/api/categories?kind=both")).status).toBe(422);
  });

  it("renames, changes the icon, archives and hides archived by default", async () => {
    const { body } = await create({ icon: "🛒" });
    const edited = await call("PATCH", `/api/categories/${body.id}`, { name: "Groceries", icon: "🍎" });
    expect(edited.body).toMatchObject({ name: "Groceries", icon: "🍎" });
    expect((await call("PATCH", `/api/categories/${body.id}`, { icon: null })).body.icon).toBeNull();
    expect((await call("PATCH", `/api/categories/${body.id}`, { icon: "nope" })).status).toBe(422);
    await call("PATCH", `/api/categories/${body.id}`, { archived: true });
    expect(await list()).toHaveLength(0);
    expect(await list("?includeArchived=true")).toHaveLength(1);
  });

  it("never changes the kind of a category", async () => {
    const { body } = await create();
    const res = await call("PATCH", `/api/categories/${body.id}`, { kind: "income" });
    expect(res.status).toBe(200);
    expect(res.body.kind).toBe("expense");
  });

  it("checks name clashes when renaming within the same kind only", async () => {
    await create({ name: "Food" });
    const other = (await create({ name: "Meals" })).body;
    expect((await call("PATCH", `/api/categories/${other.id}`, { name: "food" })).status).toBe(409);
    await create({ name: "Rent", kind: "income" });
    expect((await call("PATCH", `/api/categories/${other.id}`, { name: "Rent" })).status).toBe(200);
  });

  it("returns 404 for unknown categories", async () => {
    expect((await call("PATCH", "/api/categories/99", { name: "x" })).status).toBe(404);
  });
});

describe("transactions respect the category kind", () => {
  it("rejects an income on an expense category and the other way around", async () => {
    const food = (await create()).body.id;
    const salary = (await create({ name: "Salary", kind: "income" })).body.id;
    const acc = (await call("POST", "/api/accounts", { name: "A", type: "checking" })).body.id;
    const tx = (kind: string, categoryId: number) =>
      call("POST", "/api/transactions", { kind, amountCents: 1000, date: "2026-10-01", accountId: acc, categoryId, personId: 1 });
    expect((await tx("income", food)).body.errors).toContain("category_not_allowed");
    expect((await tx("expense", salary)).body.errors).toContain("category_not_allowed");
    expect((await tx("income", salary)).status).toBe(201);
    expect((await tx("expense", food)).status).toBe(201);
  });
});

describe("default categories", () => {
  it("are created by the seed on an empty database, with icons", async () => {
    const db = createDatabase(":memory:");
    expect(seedDefaultCategories(db).created).toBe(DEFAULT_CATEGORIES.length);
    const rows = (await (await createApp(db).request("/api/categories")).json()) as any[];
    expect(rows).toHaveLength(15);
    expect(rows.filter((c) => c.kind === "income").map((c) => c.name).sort()).toEqual(["Outras receitas", "Projetos", "Salário"]);
    expect(rows.find((c) => c.name === "Mercado")).toMatchObject({ kind: "expense", icon: "🛒" });
    expect(rows.every((c) => c.icon !== null)).toBe(true);
  });

  it("are never added twice and keep what the user already has", async () => {
    const db = createDatabase(":memory:");
    app = createApp(db);
    await create({ name: "mercado", icon: "🍎" });
    expect(seedDefaultCategories(db).created).toBe(14);
    expect(seedDefaultCategories(db).created).toBe(0);
    const mercado = (await list()).filter((c) => c.name.toLowerCase() === "mercado");
    expect(mercado).toHaveLength(1);
    expect(mercado[0].icon).toBe("🍎");
  });

  it("do not come back after the user archived one", async () => {
    const db = createDatabase(":memory:");
    app = createApp(db);
    seedDefaultCategories(db);
    const carro = (await list()).find((c) => c.name === "Carro");
    await call("PATCH", `/api/categories/${carro.id}`, { archived: true });
    expect(seedDefaultCategories(db).created).toBe(0);
    expect((await list()).some((c) => c.name === "Carro")).toBe(false);
  });

  it("can be added on demand through the API", async () => {
    await create({ name: "Salário", kind: "income", icon: "💰" });
    const res = await call("POST", "/api/categories/defaults");
    expect(res.status).toBe(201);
    expect(res.body.created).toBe(14);
    expect((await call("POST", "/api/categories/defaults")).body.created).toBe(0);
    expect(await list()).toHaveLength(15);
  });
});
