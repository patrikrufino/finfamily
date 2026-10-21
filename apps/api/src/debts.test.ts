import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "./app";
import { createDatabase } from "./db/client";

let app: ReturnType<typeof createApp>;
let accountId: number;
const today = "2026-10-20";

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
const newDebt = (over: Record<string, unknown> = {}) =>
  call("POST", "/api/debts", { creditor: "Bank", originalCents: 100000, openedOn: "2026-01-10", personId: 1, ...over });
const pay = (id: number, over: Record<string, unknown> = {}) =>
  call("POST", `/api/debts/${id}/payments`, { accountId, amountCents: 30000, date: today, personId: 1, ...over });
const balanceOf = async (id: number) => (await call("GET", `/api/debts/${id}`)).body.balanceCents;
const account = async () => (await call("GET", "/api/accounts")).body.find((a: any) => a.id === accountId);

beforeEach(async () => {
  app = createApp(createDatabase(":memory:"), { today: () => today });
  accountId = (await call("POST", "/api/accounts", { name: "Checking", type: "checking", initialBalanceCents: 500000 })).body.id;
});

describe("debts", () => {
  it("opens a debt without moving any money", async () => {
    const res = await newDebt();
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ creditor: "Bank", originalCents: 100000, balanceCents: 100000, status: "open", paidCents: 0 });
    expect(res.body.ledger.map((l: any) => l.type)).toEqual(["opening"]);
    expect((await account()).balanceCents).toBe(500000);
    expect((await call("GET", "/api/transactions?month=2026-01")).body).toHaveLength(0);
  });

  it("validates the debt", async () => {
    expect((await newDebt({ creditor: " " })).status).toBe(422);
    expect((await newDebt({ originalCents: 0 })).status).toBe(422);
    expect((await newDebt({ originalCents: 10.5 })).status).toBe(422);
    expect((await newDebt({ openedOn: "2026-02-30" })).status).toBe(422);
    expect((await newDebt({ personId: 999 })).status).toBe(404);
    expect((await newDebt({ categoryId: 999 })).status).toBe(404);
  });

  it("defaults the opening date to today", async () => {
    expect((await newDebt({ openedOn: undefined })).body.openedOn).toBe(today);
  });

  it("lists open debts first", async () => {
    const a = (await newDebt({ creditor: "A" })).body;
    await newDebt({ creditor: "B" });
    await pay(a.id, { amountCents: 100000 });
    const list = (await call("GET", "/api/debts")).body;
    expect(list.map((d: any) => [d.creditor, d.status])).toEqual([["B", "open"], ["A", "settled"]]);
  });

  it("renames a debt", async () => {
    const { body } = await newDebt();
    expect((await call("PATCH", `/api/debts/${body.id}`, { creditor: "Loan" })).body.creditor).toBe("Loan");
    expect((await call("PATCH", "/api/debts/999", { creditor: "x" })).status).toBe(404);
  });
});

describe("interest and discounts", () => {
  it("interest increases the balance and moves no money", async () => {
    const { body } = await newDebt();
    const res = await call("POST", `/api/debts/${body.id}/interest`, { amountCents: 8000, date: "2026-02-01", note: "February" });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ balanceCents: 108000, interestCents: 8000 });
    expect((await account()).balanceCents).toBe(500000);
  });

  it("discounts reduce the balance without moving money", async () => {
    const { body } = await newDebt();
    const res = await call("POST", `/api/debts/${body.id}/discount`, { amountCents: 20000, date: "2026-03-01" });
    expect(res.body).toMatchObject({ balanceCents: 80000, discountCents: 20000 });
    expect((await account()).balanceCents).toBe(500000);
  });

  it("rejects bad interest and discounts", async () => {
    const { body } = await newDebt();
    expect((await call("POST", `/api/debts/${body.id}/interest`, { amountCents: 0, date: today })).status).toBe(422);
    expect((await call("POST", `/api/debts/${body.id}/discount`, { amountCents: 100001, date: today })).body.errors).toContain("discount_above_balance");
    expect((await call("POST", `/api/debts/999/interest`, { amountCents: 1, date: today })).status).toBe(404);
  });

  it("shows the statement with the running balance", async () => {
    const { body } = await newDebt();
    await call("POST", `/api/debts/${body.id}/interest`, { amountCents: 8000, date: "2026-02-01" });
    await pay(body.id, { amountCents: 30000, date: "2026-02-15" });
    const ledger = (await call("GET", `/api/debts/${body.id}`)).body.ledger;
    expect(ledger.map((l: any) => [l.type, l.amountCents, l.balanceAfterCents])).toEqual([
      ["opening", 100000, 100000], ["interest", 8000, 108000], ["payment", 30000, 78000],
    ]);
  });
});

describe("payments (baixas)", () => {
  it("is an expense on the account and lowers the balance", async () => {
    const { body } = await newDebt();
    const res = await pay(body.id);
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ balanceCents: 70000, paidCents: 30000, status: "open" });
    expect((await account()).balanceCents).toBe(470000);
    const tx = (await call("GET", `/api/transactions?month=${today.slice(0, 7)}`)).body[0];
    expect(tx).toMatchObject({ kind: "expense", amountCents: 30000, accountId, debtId: body.id, description: "Pagamento · Bank", status: "settled" });
  });

  it("settles the debt when the whole balance is paid", async () => {
    const { body } = await newDebt();
    await pay(body.id, { amountCents: 70000 });
    const res = await pay(body.id, { amountCents: 30000 });
    expect(res.body).toMatchObject({ balanceCents: 0, status: "settled" });
  });

  it("counts in the budget by its category, using the debt's category by default", async () => {
    const cat = (await call("POST", "/api/categories", { name: "Debts", kind: "expense" })).body.id;
    const { body } = await newDebt({ categoryId: cat });
    await pay(body.id);
    const row = (await call("GET", `/api/budget?month=${today.slice(0, 7)}`)).body.categories.find((c: any) => c.categoryId === cat);
    expect(row.spentCents).toBe(30000);
  });

  it("lets the payment use another category", async () => {
    const cat = (await call("POST", "/api/categories", { name: "Other", kind: "expense" })).body.id;
    const { body } = await newDebt();
    await pay(body.id, { categoryId: cat });
    const tx = (await call("GET", `/api/transactions?month=${today.slice(0, 7)}`)).body[0];
    expect(tx.categoryId).toBe(cat);
  });

  it("rejects payments above the balance, in the future, empty, and unknown references", async () => {
    const { body } = await newDebt();
    expect((await pay(body.id, { amountCents: 100001 })).body.errors).toContain("payment_above_balance");
    expect((await pay(body.id, { date: "2026-10-21" })).body.errors).toContain("payment_date_in_future");
    expect((await pay(body.id, { amountCents: 0 })).status).toBe(422);
    expect((await pay(body.id, { accountId: 999 })).status).toBe(404);
    expect((await pay(body.id, { personId: 999 })).status).toBe(404);
    expect((await pay(999)).status).toBe(404);
    expect(await balanceOf(body.id)).toBe(100000);
    expect((await account()).balanceCents).toBe(500000);
  });

  it("follows edits and deletions of the payment transaction", async () => {
    const { body } = await newDebt();
    await pay(body.id);
    const tx = (await call("GET", `/api/transactions?month=${today.slice(0, 7)}`)).body[0];
    await call("PUT", `/api/transactions/${tx.id}`, { ...tx, amountCents: 40000 });
    expect(await balanceOf(body.id)).toBe(60000);
    expect((await call("DELETE", `/api/transactions/${tx.id}`)).status).toBe(204);
    expect(await balanceOf(body.id)).toBe(100000);
  });

  it("does not let a payment transaction become something else", async () => {
    const { body } = await newDebt();
    await pay(body.id);
    const tx = (await call("GET", `/api/transactions?month=${today.slice(0, 7)}`)).body[0];
    const res = await call("PUT", `/api/transactions/${tx.id}`, { ...tx, kind: "income" });
    expect(res.status).toBe(422);
    expect(res.body.errors).toContain("installment_locked_fields");
  });
});

describe("removing things", () => {
  it("removes an interest entry when the balance stays non-negative", async () => {
    const { body } = await newDebt();
    const withInterest = (await call("POST", `/api/debts/${body.id}/interest`, { amountCents: 8000, date: today })).body;
    const entry = withInterest.ledger.find((l: any) => l.type === "interest");
    expect((await call("DELETE", `/api/debts/${body.id}/entries/${entry.id}`)).status).toBe(204);
    expect(await balanceOf(body.id)).toBe(100000);
  });

  it("refuses to remove interest that payments depend on", async () => {
    const { body } = await newDebt();
    const withInterest = (await call("POST", `/api/debts/${body.id}/interest`, { amountCents: 8000, date: today })).body;
    await pay(body.id, { amountCents: 105000 });
    const entry = withInterest.ledger.find((l: any) => l.type === "interest");
    const res = await call("DELETE", `/api/debts/${body.id}/entries/${entry.id}`);
    expect(res.status).toBe(422);
    expect(res.body.errors).toContain("balance_would_be_negative");
  });

  it("returns 404 for unknown entries", async () => {
    const { body } = await newDebt();
    expect((await call("DELETE", `/api/debts/${body.id}/entries/999`)).status).toBe(404);
  });

  it("deletes a debt that has no payments, with its entries", async () => {
    const { body } = await newDebt();
    await call("POST", `/api/debts/${body.id}/interest`, { amountCents: 100, date: today });
    expect((await call("DELETE", `/api/debts/${body.id}`)).status).toBe(204);
    expect((await call("GET", `/api/debts/${body.id}`)).status).toBe(404);
  });

  it("keeps a debt that has payments", async () => {
    const { body } = await newDebt();
    await pay(body.id);
    const res = await call("DELETE", `/api/debts/${body.id}`);
    expect(res.status).toBe(422);
    expect(res.body.errors).toContain("debt_has_payments");
  });
});
