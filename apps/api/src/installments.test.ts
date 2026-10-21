import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "./app";
import { createDatabase } from "./db/client";

let app: ReturnType<typeof createApp>;
let accountId: number;
let cardId: number;
let today = "2026-10-20";

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
const plan = (over: Record<string, unknown> = {}) =>
  call("POST", "/api/installment-plans", {
    description: "Notebook", totalCents: 30000, count: 3, firstDate: "2026-10-20", accountId, personId: 1, ...over,
  });
const accountBalance = async () => (await call("GET", "/api/accounts")).body.find((a: any) => a.id === accountId).balanceCents;
const detail = async (id: number) => (await call("GET", `/api/installment-plans/${id}`)).body;

beforeEach(async () => {
  today = "2026-10-20";
  app = createApp(createDatabase(":memory:"), { today: () => today });
  accountId = (await call("POST", "/api/accounts", { name: "Checking", type: "checking", initialBalanceCents: 100000 })).body.id;
  cardId = (await call("POST", "/api/cards", { name: "Visa", limitCents: 500000, closingDay: 25, dueDay: 5 })).body.id;
});

describe("creating plans", () => {
  it("splits equally, with the first installment settled today and the rest scheduled", async () => {
    const res = await plan({ totalCents: 10000 });
    expect(res.status).toBe(201);
    const items = res.body.installments;
    expect(items.map((i: any) => i.amountCents)).toEqual([3333, 3333, 3334]);
    expect(items.map((i: any) => i.date)).toEqual(["2026-10-20", "2026-11-20", "2026-12-20"]);
    expect(items.map((i: any) => i.status)).toEqual(["settled", "scheduled", "scheduled"]);
    expect(items.map((i: any) => i.installmentNumber)).toEqual([1, 2, 3]);
    expect(res.body).toMatchObject({ paidCount: 1, remainingCount: 2, status: "active" });
  });

  it("only the settled installments change the account balance", async () => {
    await plan();
    expect(await accountBalance()).toBe(90000);
  });

  it("charges installments to a card, one purchase per statement", async () => {
    const res = await plan({ accountId: null, cardId });
    expect(res.status).toBe(201);
    const statement = async (m: string) => (await call("GET", `/api/cards/${cardId}/statement?month=${m}`)).body.totalCents;
    expect([await statement("2026-10"), await statement("2026-11"), await statement("2026-12")]).toEqual([10000, 10000, 10000]);
    expect(await accountBalance()).toBe(100000);
    expect((await call("GET", "/api/cards")).body[0].usedCents).toBe(30000);
  });

  it("keeps the day of the month on short months", async () => {
    const res = await plan({ firstDate: "2026-01-31", count: 3 });
    expect(res.body.installments.map((i: any) => i.date)).toEqual(["2026-01-31", "2026-02-28", "2026-03-31"]);
  });

  it("counts scheduled installments as committed in the budget", async () => {
    const food = (await call("POST", "/api/categories", { name: "Tech", kind: "expense" })).body.id;
    await plan({ categoryId: food, firstDate: "2026-11-20" });
    const row = (await call("GET", "/api/budget?month=2026-11")).body.categories.find((c: any) => c.categoryId === food);
    expect(row).toMatchObject({ spentCents: 0, committedCents: 10000 });
  });

  it("is validated", async () => {
    expect((await plan({ count: 1 })).body.errors).toContain("installment_count_invalid");
    expect((await plan({ totalCents: 0 })).body.errors).toContain("amount_must_be_positive");
    expect((await plan({ accountId: null })).body.errors).toContain("installment_source_required");
    expect((await plan({ cardId })).body.errors).toContain("installment_single_source");
    expect((await plan({ firstDate: "2026-02-30" })).body.errors).toContain("invalid_date");
    expect((await plan({ accountId: 999 })).status).toBe(404);
    expect((await plan({ accountId: null, cardId: 999 })).status).toBe(404);
    expect((await plan({ personId: 999 })).status).toBe(404);
    expect((await plan({ categoryId: 999 })).status).toBe(404);
    expect((await plan({ description: " " })).status).toBe(422);
  });
});

describe("automatic settlement", () => {
  it("settles installments when their date arrives", async () => {
    const { body } = await plan();
    expect(await accountBalance()).toBe(90000);
    today = "2026-11-20";
    expect(await accountBalance()).toBe(80000);
    expect((await detail(body.id)).installments.map((i: any) => i.status)).toEqual(["settled", "settled", "scheduled"]);
    today = "2027-03-01";
    expect(await accountBalance()).toBe(70000);
    expect((await detail(body.id)).status).toBe("done");
  });

  it("does not touch scheduled transactions that are not installments", async () => {
    await call("POST", "/api/transactions", {
      kind: "expense", amountCents: 5000, date: "2026-10-01", accountId, status: "scheduled", personId: 1,
    });
    await call("GET", "/api/accounts");
    expect((await call("GET", "/api/transactions?month=2026-10")).body[0].status).toBe("scheduled");
  });
});

describe("listing and detail", () => {
  it("lists plans with progress", async () => {
    await plan();
    const list = (await call("GET", "/api/installment-plans")).body;
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({
      description: "Notebook", count: 3, paidCount: 1, remainingCount: 2, paidCents: 10000, remainingCents: 20000,
      nextDate: "2026-11-20", nextCents: 10000, accountId, cardId: null,
    });
  });

  it("returns 404 for unknown plans", async () => {
    expect((await call("GET", "/api/installment-plans/999")).status).toBe(404);
  });

  it("exposes the plan on the installment transactions", async () => {
    const created = await plan();
    const tx = (await call("GET", "/api/transactions?month=2026-11")).body[0];
    expect(tx).toMatchObject({ planId: created.body.id, installmentNumber: 2 });
  });
});

describe("editing a single installment", () => {
  it("changes only that installment and the remaining total follows", async () => {
    const created = await plan();
    const second = created.body.installments[1];
    const res = await call("PUT", `/api/transactions/${second.id}`, { ...second, amountCents: 12000 });
    expect(res.status).toBe(200);
    const d = await detail(created.body.id);
    expect(d.installments.map((i: any) => i.amountCents)).toEqual([10000, 12000, 10000]);
    expect(d.remainingCents).toBe(22000);
    expect(d.installments[1].installmentNumber).toBe(2);
  });

  it("does not allow changing the kind or the source of an installment", async () => {
    const created = await plan();
    const second = created.body.installments[1];
    const res = await call("PUT", `/api/transactions/${second.id}`, { ...second, kind: "income" });
    expect(res.status).toBe(422);
    expect(res.body.errors).toContain("installment_locked_fields");
    expect((await call("PUT", `/api/transactions/${second.id}`, { ...second, accountId: null, cardId })).status).toBe(422);
  });
});

describe("anticipation", () => {
  const five = async () => (await plan({ totalCents: 50000, count: 5 })).body;

  it("replaces the picked installments with one payment and reports the saving", async () => {
    const created = await five();
    const ids = created.installments.slice(2).map((i: any) => i.id);
    const res = await call("POST", `/api/installment-plans/${created.id}/anticipate`, { installmentIds: ids, amountCents: 27000, date: today });
    expect(res.status).toBe(201);
    const items = res.body.installments;
    expect(items.map((i: any) => i.installmentNumber)).toEqual([1, 2, null]);
    const anticipation = items.find((i: any) => i.installmentNumber === null);
    expect(anticipation).toMatchObject({ amountCents: 27000, date: today, status: "settled", accountId, description: "Antecipação · Notebook" });
    expect(await accountBalance()).toBe(100000 - 10000 - 27000);
    expect(res.body).toMatchObject({ paidCents: 37000, remainingCents: 10000, remainingCount: 1 });
  });

  it("settles the whole remaining balance when everything is picked", async () => {
    const created = await five();
    const ids = created.installments.slice(1).map((i: any) => i.id);
    const res = await call("POST", `/api/installment-plans/${created.id}/anticipate`, { installmentIds: ids, amountCents: 40000, date: today });
    expect(res.body).toMatchObject({ status: "done", remainingCount: 0, remainingCents: 0 });
  });

  it("lands in the open statement when the plan is on a card", async () => {
    const created = (await plan({ accountId: null, cardId, totalCents: 50000, count: 5 })).body;
    const ids = created.installments.slice(3).map((i: any) => i.id);
    await call("POST", `/api/installment-plans/${created.id}/anticipate`, { installmentIds: ids, amountCents: 18000, date: today });
    const open = (await call("GET", `/api/cards/${cardId}/statement`)).body;
    expect(open.month).toBe("2026-10");
    expect(open.purchases.map((p: any) => p.amountCents).sort((a: number, b: number) => a - b)).toEqual([10000, 18000]);
  });

  it("is validated", async () => {
    const created = await five();
    const url = `/api/installment-plans/${created.id}/anticipate`;
    const [first, second] = created.installments;
    expect((await call("POST", url, { installmentIds: [], amountCents: 100, date: today })).body.errors).toContain("nothing_to_anticipate");
    expect((await call("POST", url, { installmentIds: [first.id], amountCents: 100, date: today })).body.errors).toContain("installment_not_anticipable");
    expect((await call("POST", url, { installmentIds: [second.id], amountCents: 10001, date: today })).body.errors).toContain("anticipation_above_nominal");
    expect((await call("POST", url, { installmentIds: [second.id], amountCents: 0, date: today })).status).toBe(422);
    expect((await call("POST", `/api/installment-plans/999/anticipate`, { installmentIds: [1], amountCents: 1, date: today })).status).toBe(404);
  });
});

describe("canceling a plan", () => {
  it("removes scheduled installments and keeps the settled ones", async () => {
    const created = (await plan()).body;
    expect((await call("DELETE", `/api/installment-plans/${created.id}`)).status).toBe(204);
    const d = await detail(created.id);
    expect(d.installments).toHaveLength(1);
    expect(d).toMatchObject({ status: "done", remainingCount: 0 });
    expect(await accountBalance()).toBe(90000);
  });

  it("deletes the plan altogether when nothing was settled", async () => {
    const created = (await plan({ firstDate: "2026-11-20" })).body;
    expect((await call("DELETE", `/api/installment-plans/${created.id}`)).status).toBe(204);
    expect((await call("GET", `/api/installment-plans/${created.id}`)).status).toBe(404);
  });

  it("returns 404 for unknown plans", async () => {
    expect((await call("DELETE", "/api/installment-plans/999")).status).toBe(404);
  });
});
