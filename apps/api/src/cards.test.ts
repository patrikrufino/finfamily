import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "./app";
import { createDatabase } from "./db/client";

let app: ReturnType<typeof createApp>;
let accountId: number;
let cardId: number;
let today = "2026-10-10";

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
const buy = (date: string, amountCents: number, over: Record<string, unknown> = {}) =>
  call("POST", "/api/transactions", { kind: "expense", amountCents, date, accountId: null, cardId, personId: 1, ...over });
const statement = async (month: string) => (await call("GET", `/api/cards/${cardId}/statement?month=${month}`)).body;
const account = async () => (await call("GET", "/api/accounts")).body.find((a: any) => a.id === accountId);

beforeEach(async () => {
  today = "2026-10-10";
  app = createApp(createDatabase(":memory:"), { today: () => today });
  accountId = (await call("POST", "/api/accounts", { name: "Checking", type: "checking", initialBalanceCents: 500000 })).body.id;
  cardId = (await call("POST", "/api/cards", { name: "Visa", limitCents: 500000, closingDay: 25, dueDay: 5 })).body.id;
});

describe("cards API", () => {
  it("creates a card and lists it with its open statement", async () => {
    const { body } = await call("GET", "/api/cards");
    expect(body).toHaveLength(1);
    expect(body[0]).toMatchObject({
      name: "Visa", limitCents: 500000, closingDay: 25, dueDay: 5, openStatementMonth: "2026-10",
      usedCents: 0, availableCents: 500000,
    });
    expect(body[0].openStatement).toMatchObject({ totalCents: 0, end: "2026-10-25", dueDate: "2026-11-05", status: "open" });
  });

  it("validates the card", async () => {
    expect((await call("POST", "/api/cards", { name: "", limitCents: 1, closingDay: 5, dueDay: 10 })).status).toBe(422);
    expect((await call("POST", "/api/cards", { name: "X", limitCents: 1, closingDay: 0, dueDay: 10 })).status).toBe(422);
    expect((await call("POST", "/api/cards", { name: "X", limitCents: 1, closingDay: 5, dueDay: 32 })).status).toBe(422);
    expect((await call("POST", "/api/cards", { name: "visa", limitCents: 1, closingDay: 5, dueDay: 10 })).status).toBe(409);
  });

  it("renames, changes the limit and archives", async () => {
    await call("PATCH", `/api/cards/${cardId}`, { name: "Visa Gold", limitCents: 700000 });
    expect((await call("GET", "/api/cards")).body[0]).toMatchObject({ name: "Visa Gold", limitCents: 700000 });
    await call("PATCH", `/api/cards/${cardId}`, { archived: true });
    expect((await call("GET", "/api/cards")).body).toHaveLength(0);
    expect((await call("PATCH", "/api/cards/999", { name: "x" })).status).toBe(404);
  });
});

describe("card purchases", () => {
  it("are charged to the card, not to an account", async () => {
    expect((await buy("2026-10-05", 30000)).status).toBe(201);
    expect((await account()).balanceCents).toBe(500000);
    expect((await call("GET", "/api/cards")).body[0]).toMatchObject({ usedCents: 30000, availableCents: 470000 });
  });

  it("put the closing day in the current statement and the next day in the following one", async () => {
    await buy("2026-10-25", 10000);
    await buy("2026-10-26", 20000);
    expect((await statement("2026-10")).totalCents).toBe(10000);
    expect((await statement("2026-11")).totalCents).toBe(20000);
  });

  it("count in the category budget by purchase date", async () => {
    const food = (await call("POST", "/api/categories", { name: "Food", kind: "expense" })).body.id;
    await buy("2026-10-05", 15000, { categoryId: food });
    const budget = (await call("GET", "/api/budget?month=2026-10")).body;
    expect(budget.categories.find((c: any) => c.categoryId === food).spentCents).toBe(15000);
  });

  it("are validated", async () => {
    expect((await buy("2026-10-05", 100, { kind: "income" })).body.errors).toContain("card_purchase_must_be_expense");
    expect((await buy("2026-10-05", 100, { cardId: null })).body.errors).toContain("account_required");
    expect((await buy("2026-10-05", 100, { cardId: 999 })).status).toBe(404);
  });

  it("can be filtered by card in the transactions list", async () => {
    await buy("2026-10-05", 100);
    const list = (await call("GET", `/api/transactions?month=2026-10&cardId=${cardId}`)).body;
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ accountId: null, cardId });
  });
});

describe("cycle rules", () => {
  it("never move past purchases when the closing day changes", async () => {
    await buy("2026-10-20", 10000);
    await buy("2026-10-28", 20000);
    const res = await call("POST", `/api/cards/${cardId}/rules`, { fromMonth: "2026-11", closingDay: 10, dueDay: 20 });
    expect(res.status).toBe(201);
    expect((await statement("2026-10")).totalCents).toBe(10000);
    const next = await statement("2026-11");
    expect(next).toMatchObject({ totalCents: 20000, start: "2026-10-26", end: "2026-11-10", dueDate: "2026-11-20" });
  });

  it("are rejected when they start before the open statement", async () => {
    const res = await call("POST", `/api/cards/${cardId}/rules`, { fromMonth: "2026-09", closingDay: 10, dueDay: 20 });
    expect(res.status).toBe(422);
    expect(res.body.errors).toContain("rule_in_past");
  });

  it("can change the open statement itself", async () => {
    await call("POST", `/api/cards/${cardId}/rules`, { fromMonth: "2026-10", closingDay: 15, dueDay: 25 });
    expect((await call("GET", "/api/cards")).body[0]).toMatchObject({ closingDay: 15, dueDay: 25 });
  });

  it("validate the days and the month", async () => {
    expect((await call("POST", `/api/cards/${cardId}/rules`, { fromMonth: "2026-13", closingDay: 10, dueDay: 20 })).status).toBe(422);
    expect((await call("POST", `/api/cards/${cardId}/rules`, { fromMonth: "2026-11", closingDay: 40, dueDay: 20 })).status).toBe(422);
  });
});

describe("statement payment", () => {
  beforeEach(async () => {
    await buy("2026-10-05", 100000);
    today = "2026-11-02";
  });
  const pay = (over: Record<string, unknown> = {}) =>
    call("POST", `/api/cards/${cardId}/statements/2026-10/payments`, {
      accountId, amountCents: 100000, interestCents: 0, fineCents: 0, date: "2026-11-02", personId: 1, ...over,
    });

  it("pays the statement from an account with interest as a separate expense", async () => {
    const res = await pay({ interestCents: 2000 });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ status: "paid", paidCents: 100000, remainingCents: 0, feesCents: 2000 });
    expect((await account()).balanceCents).toBe(500000 - 100000 - 2000);
    expect((await call("GET", "/api/cards")).body[0].usedCents).toBe(0);
    const list = (await call("GET", "/api/transactions?month=2026-11")).body;
    expect(list.filter((t: any) => t.feeKind === "interest")).toHaveLength(1);
    expect(list.find((t: any) => t.kind === "transfer")).toMatchObject({ cardId, statementMonth: "2026-10", amountCents: 100000 });
  });

  it("records interest and fine as two separate items", async () => {
    await pay({ interestCents: 1500, fineCents: 500 });
    const fees = (await call("GET", "/api/transactions?month=2026-11")).body.filter((t: any) => t.feeKind);
    expect(fees.map((t: any) => [t.feeKind, t.amountCents]).sort()).toEqual([["fine", 500], ["interest", 1500]]);
  });

  it("supports partial payments", async () => {
    const res = await pay({ amountCents: 40000 });
    expect(res.body).toMatchObject({ status: "closed", paidCents: 40000, remainingCents: 60000 });
    expect((await call("GET", "/api/cards")).body[0].usedCents).toBe(60000);
  });

  it("does not count the payment as spending in the budget", async () => {
    await pay();
    const budget = (await call("GET", "/api/budget?month=2026-11")).body;
    expect(budget.uncategorized.spentCents).toBe(0);
  });

  it("is validated", async () => {
    expect((await pay({ amountCents: 0 })).status).toBe(422);
    expect((await pay({ interestCents: -1 })).status).toBe(422);
    expect((await pay({ accountId: 999 })).status).toBe(404);
    expect((await pay({ personId: 999 })).status).toBe(404);
    expect((await call("POST", `/api/cards/${cardId}/statements/2026-08/payments`, {
      accountId, amountCents: 100, date: "2026-11-02", personId: 1,
    })).body.errors).toContain("statement_empty");
    expect((await call("POST", `/api/cards/999/statements/2026-10/payments`, { accountId, amountCents: 1, date: "2026-11-02", personId: 1 })).status).toBe(404);
  });
});

describe("statement view", () => {
  it("defaults to the open statement and lists its purchases newest first", async () => {
    await buy("2026-10-02", 100, { description: "a" });
    await buy("2026-10-09", 200, { description: "b" });
    const res = await call("GET", `/api/cards/${cardId}/statement`);
    expect(res.body.month).toBe("2026-10");
    expect(res.body.purchases.map((p: any) => p.description)).toEqual(["b", "a"]);
  });

  it("validates the month", async () => {
    expect((await call("GET", `/api/cards/${cardId}/statement?month=bad`)).status).toBe(422);
    expect((await call("GET", "/api/cards/999/statement")).status).toBe(404);
  });
});
