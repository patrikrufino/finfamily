import {
  ALWAYS_FROM,
  Money,
  buildStatement,
  cardUsage,
  ruleForMonth,
  statementMonthFor,
  validateTransactionInput,
  type Card,
  type CycleRule,
  type Transaction,
} from "@finfamily/domain";
import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import type { AppDatabase } from "../db/client";
import { accounts, cardCycleRules, cards, people, transactions } from "../db/schema";
import { toDomainTransaction } from "../mappers";

const monthSchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/);
const day = z.number().int().min(1).max(31);
const createSchema = z.object({
  name: z.string().trim().min(1).max(60),
  limitCents: z.number().int().min(0),
  closingDay: day,
  dueDay: day,
});
const patchSchema = z.object({
  name: z.string().trim().min(1).max(60).optional(),
  limitCents: z.number().int().min(0).optional(),
  archived: z.boolean().optional(),
});
const ruleSchema = z.object({ fromMonth: monthSchema, closingDay: day, dueDay: day });
const paymentSchema = z.object({
  accountId: z.number().int(),
  amountCents: z.number().int().positive(),
  interestCents: z.number().int().min(0).default(0),
  fineCents: z.number().int().min(0).default(0),
  date: z.string(),
  personId: z.number().int(),
});

export function cardsRoutes(db: AppDatabase, today: () => string) {
  const app = new Hono();

  const toCard = (row: typeof cards.$inferSelect): Card => ({
    id: row.id, name: row.name, limit: Money.fromCents(row.limitCents), archived: row.archived,
  });
  const rulesOf = (cardId: number): CycleRule[] =>
    db.select().from(cardCycleRules).where(eq(cardCycleRules.cardId, cardId)).all();
  const txsOf = (cardId: number): Transaction[] =>
    db.select().from(transactions).where(eq(transactions.cardId, cardId)).all().map(toDomainTransaction);
  const findCard = (id: number) => db.select().from(cards).where(eq(cards.id, id)).get();

  const byNewest = (a: Transaction, b: Transaction) => b.date.localeCompare(a.date) || b.id - a.id;
  const txDto = (t: Transaction) => ({
    id: t.id, kind: t.kind, amountCents: t.amount.cents, date: t.date, accountId: t.accountId, toAccountId: t.toAccountId,
    categoryId: t.categoryId, cardId: t.cardId ?? null, statementMonth: t.statementMonth ?? null, feeKind: t.feeKind ?? null,
    description: t.description, status: t.status, personId: t.personId,
  });

  function statementView(row: typeof cards.$inferSelect, month: string) {
    const rules = rulesOf(row.id);
    const s = buildStatement(toCard(row), rules, txsOf(row.id), month, today());
    const rule = ruleForMonth(rules, month);
    const { purchases, payments, fees, ...summary } = s;
    return {
      ...summary,
      closingDay: rule.closingDay,
      dueDay: rule.dueDay,
      purchases: [...purchases].sort(byNewest).map(txDto),
      payments: [...payments].sort(byNewest).map(txDto),
      fees: [...fees].sort(byNewest).map(txDto),
    };
  }

  function cardSummary(row: typeof cards.$inferSelect) {
    const rules = rulesOf(row.id);
    const openStatementMonth = statementMonthFor(rules, today());
    const rule = ruleForMonth(rules, openStatementMonth);
    const { purchases: _p, payments: _pay, fees: _f, ...openStatement } = buildStatement(
      toCard(row), rules, txsOf(row.id), openStatementMonth, today(),
    );
    const usage = cardUsage(toCard(row), txsOf(row.id));
    return {
      id: row.id, name: row.name, archived: row.archived,
      limitCents: row.limitCents, usedCents: usage.usedCents, availableCents: usage.availableCents,
      closingDay: rule.closingDay, dueDay: rule.dueDay, openStatementMonth, openStatement,
    };
  }

  app.get("/", (c) => {
    const includeArchived = c.req.query("includeArchived") === "true";
    const rows = db.select().from(cards).orderBy(cards.name).all();
    return c.json(rows.filter((r) => includeArchived || !r.archived).map(cardSummary));
  });

  app.post("/", async (c) => {
    const parsed = createSchema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) return c.json({ errors: ["invalid_card"] }, 422);
    const { closingDay, dueDay, name, limitCents } = parsed.data;
    const taken = db.select().from(cards).all().some((k) => !k.archived && k.name.toLowerCase() === name.toLowerCase());
    if (taken) return c.json({ errors: ["card_name_taken"] }, 409);
    const row = db.transaction((tx) => {
      const created = tx.insert(cards).values({ name, limitCents }).returning().get();
      tx.insert(cardCycleRules).values({ cardId: created.id, fromMonth: ALWAYS_FROM, closingDay, dueDay }).run();
      return created;
    });
    return c.json(cardSummary(row), 201);
  });

  app.patch("/:id", async (c) => {
    const id = Number(c.req.param("id"));
    const existing = findCard(id);
    if (!existing) return c.json({ errors: ["card_not_found"] }, 404);
    const parsed = patchSchema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) return c.json({ errors: ["invalid_card"] }, 422);
    const next = { ...existing, ...parsed.data };
    const taken = db.select().from(cards).all()
      .some((k) => k.id !== id && !k.archived && k.name.toLowerCase() === next.name.toLowerCase());
    if (!next.archived && taken) return c.json({ errors: ["card_name_taken"] }, 409);
    return c.json(cardSummary(db.update(cards).set(parsed.data).where(eq(cards.id, id)).returning().get()));
  });

  /** New closing/due days from `fromMonth`. They can never start before the open statement, so closed ones stay intact. */
  app.post("/:id/rules", async (c) => {
    const id = Number(c.req.param("id"));
    const card = findCard(id);
    if (!card) return c.json({ errors: ["card_not_found"] }, 404);
    const parsed = ruleSchema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) return c.json({ errors: ["invalid_rule"] }, 422);
    const openMonth = statementMonthFor(rulesOf(id), today());
    if (parsed.data.fromMonth < openMonth) return c.json({ errors: ["rule_in_past"] }, 422);
    const { fromMonth, closingDay, dueDay } = parsed.data;
    const row = db.insert(cardCycleRules).values({ cardId: id, fromMonth, closingDay, dueDay })
      .onConflictDoUpdate({ target: [cardCycleRules.cardId, cardCycleRules.fromMonth], set: { closingDay, dueDay } })
      .returning().get();
    return c.json(row, 201);
  });

  app.get("/:id/statement", (c) => {
    const card = findCard(Number(c.req.param("id")));
    if (!card) return c.json({ errors: ["card_not_found"] }, 404);
    const requested = c.req.query("month");
    if (requested !== undefined && !monthSchema.safeParse(requested).success) return c.json({ errors: ["invalid_month"] }, 422);
    return c.json(statementView(card, requested ?? statementMonthFor(rulesOf(card.id), today())));
  });

  app.post("/:id/statements/:month/payments", async (c) => {
    const month = c.req.param("month");
    const parsed = paymentSchema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success || !monthSchema.safeParse(month).success) return c.json({ errors: ["invalid_payment"] }, 422);
    const card = findCard(Number(c.req.param("id")));
    if (!card) return c.json({ errors: ["card_not_found"] }, 404);
    const p = parsed.data;
    if (!db.select().from(accounts).where(eq(accounts.id, p.accountId)).get()) return c.json({ errors: ["account_not_found"] }, 404);
    if (!db.select().from(people).where(eq(people.id, p.personId)).get()) return c.json({ errors: ["person_not_found"] }, 404);

    const payment = {
      kind: "transfer" as const, amountCents: p.amountCents, date: p.date, accountId: p.accountId, toAccountId: null,
      categoryId: null, cardId: card.id, statementMonth: month, feeKind: null,
      description: `${card.name} ${month}`, status: "settled" as const, personId: p.personId,
    };
    const errors = validateTransactionInput({ ...payment, amount: Money.fromCents(p.amountCents) });
    if (errors.length) return c.json({ errors }, 422);
    if (statementView(card, month).totalCents <= 0) return c.json({ errors: ["statement_empty"] }, 422);

    const fee = (feeKind: "interest" | "fine", amountCents: number) => ({
      ...payment, kind: "expense" as const, amountCents, feeKind, description: `${feeKind} · ${card.name} ${month}`,
    });
    db.transaction((tx) => {
      tx.insert(transactions).values(payment).run();
      if (p.interestCents > 0) tx.insert(transactions).values(fee("interest", p.interestCents)).run();
      if (p.fineCents > 0) tx.insert(transactions).values(fee("fine", p.fineCents)).run();
    });
    return c.json(statementView(card, month), 201);
  });

  return app;
}
