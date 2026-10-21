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
const rule = (over: Record<string, unknown> = {}) =>
  call("POST", "/api/recurring", {
    kind: "expense", amountCents: 120000, description: "Rent", accountId, personId: 1, frequency: "monthly", startDate: "2026-11-10", ...over,
  });
const posted = async (month: string) => (await call("GET", `/api/transactions?month=${month}`)).body.filter((t: any) => t.recurringId !== null);
const balance = async () => (await call("GET", "/api/accounts")).body.find((a: any) => a.id === accountId).balanceCents;

beforeEach(async () => {
  today = "2026-10-20";
  app = createApp(createDatabase(":memory:"), { today: () => today });
  accountId = (await call("POST", "/api/accounts", { name: "Checking", type: "checking", initialBalanceCents: 500000 })).body.id;
  cardId = (await call("POST", "/api/cards", { name: "Visa", limitCents: 500000, closingDay: 25, dueDay: 5 })).body.id;
});

describe("creating rules", () => {
  it("creates a rule and reports its next occurrence", async () => {
    const res = await rule();
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ description: "Rent", frequency: "monthly", nextDate: "2026-11-10", postedCount: 0, status: "active" });
    expect(await balance()).toBe(500000);
  });

  it("does not backfill a start date in the past", async () => {
    const res = await rule({ startDate: "2026-01-15" });
    expect(res.body.nextDate).toBe("2026-11-15");
    expect((await call("GET", "/api/transactions?month=2026-09")).body).toHaveLength(0);
    expect(res.body.postedCount).toBe(0);
  });

  it("posts immediately when the first occurrence is today", async () => {
    const res = await rule({ startDate: "2026-10-20" });
    expect(res.body.postedCount).toBe(1);
    expect(await balance()).toBe(380000);
  });

  it("is validated", async () => {
    expect((await rule({ amountCents: 0 })).body.errors).toContain("amount_must_be_positive");
    expect((await rule({ startDate: "2026-02-30" })).body.errors).toContain("invalid_date");
    expect((await rule({ endDate: "2026-11-01" })).body.errors).toContain("end_before_start");
    expect((await rule({ accountId: null })).body.errors).toContain("recurring_source_required");
    expect((await rule({ cardId })).body.errors).toContain("recurring_single_source");
    expect((await rule({ kind: "income", accountId: null, cardId })).body.errors).toContain("recurring_income_needs_account");
    expect((await rule({ frequency: "daily" })).status).toBe(422);
    expect((await rule({ accountId: 999 })).status).toBe(404);
    expect((await rule({ accountId: null, cardId: 999 })).status).toBe(404);
    expect((await rule({ personId: 999 })).status).toBe(404);
    expect((await rule({ categoryId: 999 })).status).toBe(404);
  });

  it("rejects an expense-only category on income", async () => {
    const food = (await call("POST", "/api/categories", { name: "Food", kind: "expense" })).body.id;
    expect((await rule({ kind: "income", categoryId: food })).body.errors).toContain("category_not_allowed");
  });
});

describe("posting occurrences", () => {
  it("posts one settled transaction per occurrence when its date arrives, never twice", async () => {
    await rule();
    today = "2026-11-10";
    for (let i = 0; i < 4; i++) await call("GET", "/api/accounts");
    const items = await posted("2026-11");
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ kind: "expense", amountCents: 120000, date: "2026-11-10", status: "settled", accountId, description: "Rent" });
    expect(await balance()).toBe(380000);
  });

  it("catches up on several occurrences after the system was off", async () => {
    await rule();
    today = "2027-01-15";
    await call("GET", "/api/accounts");
    expect((await posted("2026-11")).length + (await posted("2026-12")).length + (await posted("2027-01")).length).toBe(3);
    expect(await balance()).toBe(500000 - 3 * 120000);
  });

  it("keeps the day of the month on short months", async () => {
    await rule({ startDate: "2026-10-31" });
    today = "2027-02-28";
    await call("GET", "/api/accounts");
    expect((await posted("2027-02")).map((t: any) => t.date)).toEqual(["2027-02-28"]);
  });

  it("posts income on accounts and expenses on cards as card purchases", async () => {
    await rule({ kind: "income", description: "Salary", amountCents: 300000, startDate: "2026-11-05" });
    await rule({ accountId: null, cardId, description: "Streaming", amountCents: 3990, startDate: "2026-11-12" });
    today = "2026-11-12";
    await call("GET", "/api/accounts");
    const items = await posted("2026-11");
    expect(items.find((t: any) => t.description === "Salary")).toMatchObject({ kind: "income", accountId });
    expect(items.find((t: any) => t.description === "Streaming")).toMatchObject({ kind: "expense", accountId: null, cardId });
    expect(await balance()).toBe(800000);
    expect((await call("GET", "/api/cards")).body[0].usedCents).toBe(3990);
  });

  it("stops at the end date", async () => {
    await rule({ endDate: "2026-12-31" });
    today = "2027-03-01";
    await call("GET", "/api/accounts");
    expect((await posted("2027-01")).length + (await posted("2027-02")).length).toBe(0);
    expect((await call("GET", "/api/recurring")).body[0].status).toBe("ended");
  });

  it("does not post while paused, and resuming does not backfill", async () => {
    const { body } = await rule();
    await call("PATCH", `/api/recurring/${body.id}`, { active: false });
    today = "2027-01-20";
    await call("GET", "/api/accounts");
    expect(await posted("2026-11")).toHaveLength(0);
    const resumed = await call("PATCH", `/api/recurring/${body.id}`, { active: true });
    expect(resumed.body.nextDate).toBe("2027-02-10");
    await call("GET", "/api/accounts");
    expect(await posted("2026-12")).toHaveLength(0);
    expect(await posted("2027-01")).toHaveLength(0);
  });

  it("changes future occurrences only when edited", async () => {
    const { body } = await rule();
    today = "2026-11-10";
    await call("GET", "/api/accounts");
    await call("PATCH", `/api/recurring/${body.id}`, { amountCents: 130000, description: "Rent 2027" });
    today = "2026-12-10";
    await call("GET", "/api/accounts");
    expect((await posted("2026-11"))[0]).toMatchObject({ amountCents: 120000, description: "Rent" });
    expect((await posted("2026-12"))[0]).toMatchObject({ amountCents: 130000, description: "Rent 2027" });
  });

  it("editing or deleting a posted transaction does not re-post it", async () => {
    await rule();
    today = "2026-11-10";
    await call("GET", "/api/accounts");
    const [tx] = await posted("2026-11");
    await call("DELETE", `/api/transactions/${tx.id}`);
    await call("GET", "/api/accounts");
    expect(await posted("2026-11")).toHaveLength(0);
  });
});

describe("managing rules", () => {
  it("lists rules with posting counts", async () => {
    await rule();
    today = "2026-12-10";
    await call("GET", "/api/accounts");
    const list = (await call("GET", "/api/recurring")).body;
    expect(list[0]).toMatchObject({ postedCount: 2, nextDate: "2027-01-10", status: "active" });
  });

  it("validates edits and unknown rules", async () => {
    const { body } = await rule();
    expect((await call("PATCH", `/api/recurring/${body.id}`, { amountCents: 0 })).status).toBe(422);
    expect((await call("PATCH", `/api/recurring/${body.id}`, { endDate: "2026-10-01" })).body.errors).toContain("end_before_start");
    expect((await call("PATCH", "/api/recurring/999", { active: false })).status).toBe(404);
    expect((await call("DELETE", "/api/recurring/999")).status).toBe(404);
  });

  it("deletes a rule that never posted, but keeps one that did", async () => {
    const a = (await rule()).body;
    expect((await call("DELETE", `/api/recurring/${a.id}`)).status).toBe(204);
    const b = (await rule({ startDate: "2026-10-20" })).body;
    const res = await call("DELETE", `/api/recurring/${b.id}`);
    expect(res.status).toBe(422);
    expect(res.body.errors).toContain("rule_has_postings");
  });
});
