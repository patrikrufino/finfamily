import {
  Money,
  canRemoveEntry,
  debtLedger,
  isValidIsoDate,
  summarizeDebt,
  validateDebtDiscount,
  validateDebtInterest,
  validateDebtPayment,
  validateTransactionCategory,
  type Debt,
  type DebtEntry,
  type Transaction,
} from "@finfamily/domain";
import { and, eq } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import type { AppDatabase } from "../db/client";
import { accounts, categories, debtEntries, debts, people, transactions } from "../db/schema";
import { toDomainTransaction } from "../mappers";

const date = z.string().refine(isValidIsoDate);
const createSchema = z.object({
  creditor: z.string().trim().min(1).max(80),
  originalCents: z.number().int().positive(),
  openedOn: date.optional(),
  categoryId: z.number().int().nullish().transform((v) => v ?? null),
  personId: z.number().int(),
});
const patchSchema = z.object({
  creditor: z.string().trim().min(1).max(80).optional(),
  categoryId: z.number().int().nullable().optional(),
});
const entrySchema = z.object({
  amountCents: z.number().int(),
  date: date.optional(),
  note: z.string().trim().max(200).default(""),
});
const paymentSchema = z.object({
  accountId: z.number().int(),
  amountCents: z.number().int(),
  date: date.optional(),
  personId: z.number().int(),
  categoryId: z.number().int().nullish().transform((v) => v ?? null),
  description: z.string().trim().max(200).optional(),
});

export function debtsRoutes(db: AppDatabase, today: () => string) {
  const app = new Hono();

  const findDebt = (id: number) => db.select().from(debts).where(eq(debts.id, id)).get();
  const toDebt = (row: typeof debts.$inferSelect): Debt => ({
    id: row.id, creditor: row.creditor, original: Money.fromCents(row.originalCents), openedOn: row.openedOn,
  });
  const entriesOf = (id: number): DebtEntry[] =>
    db.select().from(debtEntries).where(eq(debtEntries.debtId, id)).all()
      .map((e) => ({ id: e.id, debtId: e.debtId, kind: e.kind, amount: Money.fromCents(e.amountCents), date: e.date, note: e.note }));
  const txsOf = (id: number): Transaction[] =>
    db.select().from(transactions).where(eq(transactions.debtId, id)).all().map(toDomainTransaction);

  function summary(row: typeof debts.$inferSelect) {
    return {
      id: row.id, creditor: row.creditor, openedOn: row.openedOn, categoryId: row.categoryId, personId: row.personId,
      ...summarizeDebt(toDebt(row), entriesOf(row.id), txsOf(row.id)),
    };
  }
  const detail = (row: typeof debts.$inferSelect) => ({
    ...summary(row),
    ledger: debtLedger(toDebt(row), entriesOf(row.id), txsOf(row.id)),
  });
  const balanceOf = (row: typeof debts.$inferSelect) => Money.fromCents(summary(row).balanceCents);

  /** Returns an error response spec when the category does not exist or cannot take expenses. */
  function checkCategory(categoryId: number | null) {
    if (categoryId === null) return null;
    const category = db.select().from(categories).where(eq(categories.id, categoryId)).get();
    if (!category) return { status: 404 as const, errors: ["category_not_found"] };
    const errors = validateTransactionCategory("expense", category);
    return errors.length ? { status: 422 as const, errors } : null;
  }

  app.get("/", (c) => {
    const rows = db.select().from(debts).all().map(summary);
    rows.sort((a, b) =>
      Number(b.status === "open") - Number(a.status === "open") || a.creditor.localeCompare(b.creditor) || a.id - b.id);
    return c.json(rows);
  });

  app.get("/:id", (c) => {
    const row = findDebt(Number(c.req.param("id")));
    return row ? c.json(detail(row)) : c.json({ errors: ["debt_not_found"] }, 404);
  });

  app.post("/", async (c) => {
    const parsed = createSchema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) return c.json({ errors: ["invalid_debt"] }, 422);
    const p = parsed.data;
    const categoryError = checkCategory(p.categoryId);
    if (categoryError) return c.json({ errors: categoryError.errors }, categoryError.status);
    if (!db.select().from(people).where(eq(people.id, p.personId)).get()) return c.json({ errors: ["person_not_found"] }, 404);
    const row = db.insert(debts).values({
      creditor: p.creditor, originalCents: p.originalCents, openedOn: p.openedOn ?? today(), categoryId: p.categoryId, personId: p.personId,
    }).returning().get();
    return c.json(detail(row), 201);
  });

  app.patch("/:id", async (c) => {
    const row = findDebt(Number(c.req.param("id")));
    if (!row) return c.json({ errors: ["debt_not_found"] }, 404);
    const parsed = patchSchema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) return c.json({ errors: ["invalid_debt"] }, 422);
    if (parsed.data.categoryId !== undefined) {
      const categoryError = checkCategory(parsed.data.categoryId);
      if (categoryError) return c.json({ errors: categoryError.errors }, categoryError.status);
    }
    return c.json(detail(db.update(debts).set(parsed.data).where(eq(debts.id, row.id)).returning().get()));
  });

  app.post("/:id/interest", async (c) => {
    const row = findDebt(Number(c.req.param("id")));
    if (!row) return c.json({ errors: ["debt_not_found"] }, 404);
    const parsed = entrySchema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) return c.json({ errors: ["invalid_entry"] }, 422);
    const when = parsed.data.date ?? today();
    const errors = validateDebtInterest(Money.fromCents(parsed.data.amountCents), when);
    if (errors.length) return c.json({ errors }, 422);
    db.insert(debtEntries).values({ debtId: row.id, kind: "interest", amountCents: parsed.data.amountCents, date: when, note: parsed.data.note }).run();
    return c.json(detail(row), 201);
  });

  app.post("/:id/discount", async (c) => {
    const row = findDebt(Number(c.req.param("id")));
    if (!row) return c.json({ errors: ["debt_not_found"] }, 404);
    const parsed = entrySchema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) return c.json({ errors: ["invalid_entry"] }, 422);
    const when = parsed.data.date ?? today();
    const errors = validateDebtDiscount(balanceOf(row), Money.fromCents(parsed.data.amountCents), when);
    if (errors.length) return c.json({ errors }, 422);
    db.insert(debtEntries).values({ debtId: row.id, kind: "discount", amountCents: parsed.data.amountCents, date: when, note: parsed.data.note }).run();
    return c.json(detail(row), 201);
  });

  /** A payment (baixa) is an expense on an account linked to the debt; it can never exceed the balance. */
  app.post("/:id/payments", async (c) => {
    const row = findDebt(Number(c.req.param("id")));
    if (!row) return c.json({ errors: ["debt_not_found"] }, 404);
    const parsed = paymentSchema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) return c.json({ errors: ["invalid_payment"] }, 422);
    const p = parsed.data;
    const when = p.date ?? today();
    const errors = validateDebtPayment(balanceOf(row), Money.fromCents(p.amountCents), when, today());
    if (errors.length) return c.json({ errors }, 422);
    if (!db.select().from(accounts).where(eq(accounts.id, p.accountId)).get()) return c.json({ errors: ["account_not_found"] }, 404);
    if (!db.select().from(people).where(eq(people.id, p.personId)).get()) return c.json({ errors: ["person_not_found"] }, 404);
    const categoryId = p.categoryId ?? row.categoryId;
    const categoryError = checkCategory(categoryId);
    if (categoryError) return c.json({ errors: categoryError.errors }, categoryError.status);

    db.insert(transactions).values({
      kind: "expense", amountCents: p.amountCents, date: when, accountId: p.accountId, categoryId,
      description: p.description || `Pagamento · ${row.creditor}`, status: "settled", personId: p.personId, debtId: row.id,
    }).run();
    return c.json(detail(row), 201);
  });

  /** Removes an interest or discount entry, unless payments already depend on it. */
  app.delete("/:id/entries/:entryId", (c) => {
    const row = findDebt(Number(c.req.param("id")));
    if (!row) return c.json({ errors: ["debt_not_found"] }, 404);
    const entryId = Number(c.req.param("entryId"));
    const entry = db.select().from(debtEntries).where(and(eq(debtEntries.id, entryId), eq(debtEntries.debtId, row.id))).get();
    if (!entry) return c.json({ errors: ["entry_not_found"] }, 404);
    if (!canRemoveEntry(toDebt(row), entriesOf(row.id), txsOf(row.id), entryId)) {
      return c.json({ errors: ["balance_would_be_negative"] }, 422);
    }
    db.delete(debtEntries).where(eq(debtEntries.id, entryId)).run();
    return c.body(null, 204);
  });

  app.delete("/:id", (c) => {
    const row = findDebt(Number(c.req.param("id")));
    if (!row) return c.json({ errors: ["debt_not_found"] }, 404);
    if (db.select().from(transactions).where(eq(transactions.debtId, row.id)).get()) {
      return c.json({ errors: ["debt_has_payments"] }, 422);
    }
    db.transaction((tx) => {
      tx.delete(debtEntries).where(eq(debtEntries.debtId, row.id)).run();
      tx.delete(debts).where(eq(debts.id, row.id)).run();
    });
    return c.body(null, 204);
  });

  return app;
}
