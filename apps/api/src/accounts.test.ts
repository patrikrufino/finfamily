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
