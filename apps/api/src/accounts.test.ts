import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "./app";
import { createDatabase } from "./db/client";

let app: ReturnType<typeof createApp>;

const json = (method: string, body?: unknown): RequestInit => ({
  method,
  headers: { "content-type": "application/json" },
  body: body === undefined ? undefined : JSON.stringify(body),
});

const createAccount = async (over: Record<string, unknown> = {}) => {
  const res = await app.request("/api/accounts", json("POST", { name: "Checking", type: "checking", initialBalanceCents: 100000, ...over }));
  return { res, body: (await res.json()) as any };
};

beforeEach(() => {
  app = createApp(createDatabase(":memory:"));
});

describe("accounts API", () => {
  it("creates and lists accounts with balances", async () => {
    const { res, body } = await createAccount();
    expect(res.status).toBe(201);
    expect(body).toMatchObject({ name: "Checking", type: "checking", balanceCents: 100000, projectedBalanceCents: 100000, archived: false });
    const list = (await (await app.request("/api/accounts")).json()) as any[];
    expect(list).toHaveLength(1);
  });

  it("rejects invalid types and empty names", async () => {
    expect((await createAccount({ type: "crypto" })).res.status).toBe(422);
    expect((await createAccount({ name: "  " })).res.status).toBe(422);
  });

  it("rejects duplicate names among active accounts", async () => {
    await createAccount();
    expect((await createAccount()).res.status).toBe(409);
  });

  it("archives accounts and hides them by default", async () => {
    const { body } = await createAccount();
    const patch = await app.request(`/api/accounts/${body.id}`, json("PATCH", { archived: true }));
    expect(patch.status).toBe(200);
    expect(((await (await app.request("/api/accounts")).json()) as any[])).toHaveLength(0);
    expect(((await (await app.request("/api/accounts?includeArchived=true")).json()) as any[])).toHaveLength(1);
  });

  it("renames an account", async () => {
    const { body } = await createAccount();
    const res = await app.request(`/api/accounts/${body.id}`, json("PATCH", { name: "Main" }));
    expect(((await res.json()) as any).name).toBe("Main");
  });

  it("returns 404 for unknown accounts", async () => {
    expect((await app.request("/api/accounts/999", json("PATCH", { name: "x" }))).status).toBe(404);
  });
});

describe("initial balance and adjustments", () => {
  const call = async (method: string, path: string, body?: unknown) => {
    const res = await app.request(path, json(method, body));
    const text = await res.text();
    return { status: res.status, body: text ? JSON.parse(text) : null };
  };
  let id: number;
  beforeEach(async () => {
    id = (await call("POST", "/api/accounts", { name: "Main", type: "checking", initialBalanceCents: 100000 })).body.id;
  });
  const adjust = (over: Record<string, unknown> = {}) =>
    call("POST", `/api/accounts/${id}/adjust`, { targetBalanceCents: 92000, personId: 1, date: "2026-10-10", ...over });
  const account = async () => (await call("GET", "/api/accounts")).body.find((a: any) => a.id === id);

  it("edits the initial balance, which changes the balance directly", async () => {
    const res = await call("PATCH", `/api/accounts/${id}`, { initialBalanceCents: 150000 });
    expect(res.body).toMatchObject({ initialBalanceCents: 150000, balanceCents: 150000 });
    expect((await call("GET", "/api/transactions?month=2026-10")).body).toHaveLength(0);
  });

  it("adjusts down with an expense adjustment", async () => {
    const res = await adjust();
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ kind: "expense", amountCents: 8000, adjustment: true, description: "Ajuste de saldo", status: "settled" });
    expect((await account()).balanceCents).toBe(92000);
  });

  it("adjusts up with an income adjustment", async () => {
    const res = await adjust({ targetBalanceCents: 105000 });
    expect(res.body).toMatchObject({ kind: "income", amountCents: 5000, adjustment: true });
    expect((await account()).balanceCents).toBe(105000);
  });

  it("compares against the settled balance only", async () => {
    await call("POST", "/api/transactions", {
      kind: "expense", amountCents: 30000, date: "2099-01-01", accountId: id, status: "scheduled", personId: 1,
    });
    const res = await adjust({ targetBalanceCents: 100000 });
    expect(res.status).toBe(422);
    expect(res.body.errors).toContain("no_adjustment_needed");
  });

  it("rejects nothing-to-adjust, unknown accounts and people, and bad input", async () => {
    expect((await adjust({ targetBalanceCents: 100000 })).body.errors).toContain("no_adjustment_needed");
    expect((await call("POST", "/api/accounts/999/adjust", { targetBalanceCents: 1, personId: 1, date: "2026-10-10" })).status).toBe(404);
    expect((await adjust({ personId: 999 })).status).toBe(404);
    expect((await adjust({ targetBalanceCents: 1.5 })).status).toBe(422);
    expect((await adjust({ date: "nope" })).status).toBe(422);
  });

  it("lets the description be customized", async () => {
    expect((await adjust({ description: "Bank fee found" })).body.description).toBe("Bank fee found");
  });
});
