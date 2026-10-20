import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "./app";
import { createDatabase } from "./db/client";

let app: ReturnType<typeof createApp>;
let checkingId: number;
let savingsId: number;

const json = (method: string, body?: unknown): RequestInit => ({
  method,
  headers: { "content-type": "application/json" },
  body: body === undefined ? undefined : JSON.stringify(body),
});

const post = (over: Record<string, unknown> = {}) =>
  app.request("/api/transactions", json("POST", {
    kind: "expense", amountCents: 2000, date: "2026-10-05", accountId: checkingId, description: "Lunch", status: "settled", personId: 1, ...over,
  }));

const accountsById = async () => {
  const list = (await (await app.request("/api/accounts")).json()) as any[];
  return Object.fromEntries(list.map((a) => [a.id, a]));
};

beforeEach(async () => {
  app = createApp(createDatabase(":memory:"));
  const mk = async (name: string, type: string, initialBalanceCents: number) =>
    ((await (await app.request("/api/accounts", json("POST", { name, type, initialBalanceCents }))).json()) as any).id as number;
  checkingId = await mk("Checking", "checking", 100000);
  savingsId = await mk("Savings", "savings", 0);
});

describe("transactions API", () => {
  it("creates a transaction and updates the balance", async () => {
    const res = await post({ kind: "income", amountCents: 50000 });
    expect(res.status).toBe(201);
    expect((await accountsById())[checkingId].balanceCents).toBe(150000);
  });

  it("keeps scheduled transactions out of the balance but in the projection", async () => {
    await post({ status: "scheduled", amountCents: 10000 });
    const acc = (await accountsById())[checkingId];
    expect(acc.balanceCents).toBe(100000);
    expect(acc.projectedBalanceCents).toBe(90000);
  });

  it("moves money on transfers", async () => {
    await post({ kind: "transfer", amountCents: 30000, toAccountId: savingsId });
    const accs = await accountsById();
    expect(accs[checkingId].balanceCents).toBe(70000);
    expect(accs[savingsId].balanceCents).toBe(30000);
  });

  it("rejects invalid input with domain error codes", async () => {
    const res = await post({ amountCents: 0 });
    expect(res.status).toBe(422);
    expect(((await res.json()) as any).errors).toContain("amount_must_be_positive");
    const same = await post({ kind: "transfer", toAccountId: checkingId });
    expect(((await same.json()) as any).errors).toContain("transfer_same_account");
  });

  it("rejects unknown accounts and people", async () => {
    expect((await post({ accountId: 999 })).status).toBe(404);
    expect((await post({ personId: 999 })).status).toBe(404);
  });

  it("lists by month, newest first, with filters", async () => {
    await post({ date: "2026-10-01", description: "a" });
    await post({ date: "2026-10-20", description: "b", personId: 2 });
    await post({ date: "2026-09-30", description: "c" });
    const list = async (qs: string) => ((await (await app.request(`/api/transactions?${qs}`)).json()) as any[]).map((t) => t.description);
    expect(await list("month=2026-10")).toEqual(["b", "a"]);
    expect(await list("month=2026-10&personId=2")).toEqual(["b"]);
    expect(await list(`month=2026-09&accountId=${savingsId}`)).toEqual([]);
  });

  it("includes transfers when filtering by the destination account", async () => {
    await post({ kind: "transfer", toAccountId: savingsId, description: "move" });
    const list = (await (await app.request(`/api/transactions?month=2026-10&accountId=${savingsId}`)).json()) as any[];
    expect(list.map((t) => t.description)).toEqual(["move"]);
  });

  it("updates and deletes", async () => {
    const created = (await (await post()).json()) as any;
    const put = await app.request(`/api/transactions/${created.id}`, json("PUT", { ...created, amountCents: 3500, description: "Dinner" }));
    expect(put.status).toBe(200);
    expect(((await put.json()) as any).amountCents).toBe(3500);
    expect((await app.request(`/api/transactions/${created.id}`, json("DELETE"))).status).toBe(204);
    expect((await app.request(`/api/transactions/${created.id}`, json("DELETE"))).status).toBe(404);
  });

  it("rejects a malformed month filter", async () => {
    expect((await app.request("/api/transactions?month=2026-13")).status).toBe(422);
  });

  describe("categories", () => {
    const category = async (kind: string) =>
      ((await (await app.request("/api/categories", json("POST", { name: `c-${kind}`, kind }))).json()) as any).id as number;

    it("stores the category and filters by it", async () => {
      const id = await category("expense");
      await post({ categoryId: id, description: "with" });
      await post({ description: "without" });
      const list = ((await (await app.request(`/api/transactions?month=2026-10&categoryId=${id}`)).json()) as any[]);
      expect(list.map((t) => t.description)).toEqual(["with"]);
      expect(list[0].categoryId).toBe(id);
    });

    it("rejects expense-only categories on income and any category on transfers", async () => {
      const food = await category("expense");
      const res = await post({ kind: "income", categoryId: food });
      expect(((await res.json()) as any).errors).toContain("category_not_allowed");
      const tr = await post({ kind: "transfer", toAccountId: savingsId, categoryId: food });
      expect(((await tr.json()) as any).errors).toContain("category_not_allowed");
    });

    it("rejects unknown and archived categories", async () => {
      expect((await post({ categoryId: 999 })).status).toBe(404);
      const id = await category("expense");
      await app.request(`/api/categories/${id}`, json("PATCH", { archived: true }));
      expect(((await (await post({ categoryId: id })).json()) as any).errors).toContain("category_archived");
    });
  });
});
