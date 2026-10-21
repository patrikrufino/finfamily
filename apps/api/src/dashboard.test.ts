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
const tx = (over: Record<string, unknown>) =>
  call("POST", "/api/transactions", { kind: "expense", amountCents: 1000, date: "2026-10-05", accountId, status: "settled", personId: 1, ...over });
const dashboard = async () => (await call("GET", "/api/dashboard")).body;

beforeEach(async () => {
  today = "2026-10-20";
  app = createApp(createDatabase(":memory:"), { today: () => today });
  accountId = (await call("POST", "/api/accounts", { name: "Checking", type: "checking", initialBalanceCents: 100000 })).body.id;
  cardId = (await call("POST", "/api/cards", { name: "Visa", limitCents: 500000, closingDay: 25, dueDay: 5 })).body.id;
});

describe("dashboard", () => {
  it("shows the current balance and the month result without transfers, adjustments or card payments", async () => {
    await tx({ kind: "income", amountCents: 500000 });
    await tx({ amountCents: 20000 });
    await call("POST", `/api/accounts/${accountId}/adjust`, { targetBalanceCents: 1, personId: 1 });
    const d = await dashboard();
    expect(d).toMatchObject({ today, month: "2026-10" });
    expect(d.monthSummary).toEqual({ incomeCents: 500000, expenseCents: 20000, resultCents: 480000 });
    expect(d.balanceCents).toBe(1);
  });

  it("compares the budget with what was spent and highlights categories near or over the limit", async () => {
    const food = (await call("POST", "/api/categories", { name: "Food", kind: "expense" })).body.id;
    const fun = (await call("POST", "/api/categories", { name: "Fun", kind: "expense" })).body.id;
    await call("PUT", `/api/budgets/${food}`, { month: "2026-10", amountCents: 50000 });
    await call("PUT", `/api/budgets/${fun}`, { month: "2026-10", amountCents: 100000 });
    await tx({ categoryId: food, amountCents: 52000 });
    await tx({ categoryId: fun, amountCents: 10000 });
    const d = await dashboard();
    expect(d.budget.totals).toEqual({ budgetCents: 150000, spentCents: 62000, remainingCents: 88000 });
    expect(d.budget.highlights.map((h: any) => [h.name, h.status])).toEqual([["Food", "over"]]);
  });

  it("lists card statements due in the next 30 days, with what remains to pay", async () => {
    await call("POST", "/api/transactions", { kind: "expense", amountCents: 80000, date: "2026-10-10", accountId: null, cardId, personId: 1 });
    const d = await dashboard();
    expect(d.cardsDue).toEqual([
      expect.objectContaining({ cardId, name: "Visa", month: "2026-10", dueDate: "2026-11-05", remainingCents: 80000, overdue: false }),
    ]);
  });

  it("flags unpaid statements that are past their due date", async () => {
    await call("POST", "/api/transactions", { kind: "expense", amountCents: 60000, date: "2026-09-10", accountId: null, cardId, personId: 1 });
    const d = await dashboard();
    expect(d.cardsDue[0]).toMatchObject({ month: "2026-09", dueDate: "2026-10-05", overdue: true, remainingCents: 60000 });
  });

  it("does not list paid or far-away statements", async () => {
    await call("POST", "/api/transactions", { kind: "expense", amountCents: 60000, date: "2026-09-10", accountId: null, cardId, personId: 1 });
    await call("POST", `/api/cards/${cardId}/statements/2026-09/payments`, { accountId, amountCents: 60000, date: today, personId: 1 });
    await call("POST", "/api/transactions", { kind: "expense", amountCents: 10000, date: "2027-03-10", accountId: null, cardId, personId: 1, status: "scheduled" });
    expect((await dashboard()).cardsDue).toEqual([]);
  });

  it("summarizes debts and the installments committed this month", async () => {
    await call("POST", "/api/debts", { creditor: "Bank", originalCents: 100000, personId: 1 });
    await call("POST", "/api/installment-plans", { description: "Sofa", totalCents: 30000, count: 3, firstDate: "2026-09-25", accountId, personId: 1 });
    const d = await dashboard();
    expect(d.debts).toEqual({ totalOwedCents: 100000, openCount: 1 });
    expect(d.installments).toEqual({ committedThisMonthCents: 10000, activePlans: 1 });
  });

  it("projects the balance for the next months with recurring items and card payments", async () => {
    await call("POST", "/api/recurring", { kind: "income", amountCents: 300000, description: "Salary", accountId, personId: 1, frequency: "monthly", startDate: "2026-01-05" });
    await call("POST", "/api/recurring", { kind: "expense", amountCents: 120000, description: "Rent", accountId, personId: 1, frequency: "monthly", startDate: "2026-01-10" });
    await call("POST", "/api/transactions", { kind: "expense", amountCents: 80000, date: "2026-10-10", accountId: null, cardId, personId: 1 });
    const d = await dashboard();
    expect(d.forecast).toHaveLength(6);
    expect(d.forecast[0]).toMatchObject({ month: "2026-10", endBalanceCents: 100000 });
    expect(d.forecast[1]).toMatchObject({ month: "2026-11", incomeCents: 300000, expenseCents: 120000, cardPaymentsCents: 80000, netCents: 100000, endBalanceCents: 200000 });
    expect(d.forecast[2]).toMatchObject({ month: "2026-12", cardPaymentsCents: 0, endBalanceCents: 380000 });
    expect(d.projectedEndOfMonthCents).toBe(100000);
  });

  it("starts from the settled balance of active accounts only", async () => {
    const other = (await call("POST", "/api/accounts", { name: "Old", type: "wallet", initialBalanceCents: 7000 })).body.id;
    await call("PATCH", `/api/accounts/${other}`, { archived: true });
    expect((await dashboard()).balanceCents).toBe(100000);
  });
});
