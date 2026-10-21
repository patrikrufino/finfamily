import {
  Money,
  TRANSACTION_KINDS,
  TRANSACTION_STATUSES,
  validateTransactionCategory,
  validateTransactionInput,
} from "@finfamily/domain";
import { and, desc, eq, like, or } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import type { AppDatabase } from "../db/client";
import { accounts, cards, categories, people, transactions } from "../db/schema";
import { transactionDto } from "../mappers";

const bodySchema = z.object({
  kind: z.enum(TRANSACTION_KINDS),
  amountCents: z.number().int(),
  date: z.string(),
  accountId: z.number().int().nullable(),
  cardId: z.number().int().nullish().transform((v) => v ?? null),
  statementMonth: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/).nullish().transform((v) => v ?? null),
  feeKind: z.enum(["interest", "fine"]).nullish().transform((v) => v ?? null),
  toAccountId: z.number().int().nullish().transform((v) => v ?? null),
  categoryId: z.number().int().nullish().transform((v) => v ?? null),
  description: z.string().trim().max(200).default(""),
  status: z.enum(TRANSACTION_STATUSES).default("settled"),
  personId: z.number().int(),
});
const monthSchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/);

export function transactionsRoutes(db: AppDatabase) {
  const app = new Hono();

  /** Validates the body and referenced rows; returns the row values or an error response spec. */
  const parseBody = async (raw: unknown) => {
    const parsed = bodySchema.safeParse(raw);
    if (!parsed.success) return { status: 422 as const, errors: ["invalid_transaction"] };
    const b = parsed.data;
    const category = b.categoryId === null ? null : db.select().from(categories).where(eq(categories.id, b.categoryId)).get() ?? undefined;
    if (category === undefined) return { status: 404 as const, errors: ["category_not_found"] };
    const errors = [
      ...validateTransactionInput({ ...b, amount: Money.fromCents(b.amountCents) }),
      ...validateTransactionCategory(b.kind, category),
    ];
    if (errors.length) return { status: 422 as const, errors };
    const accountExists = (id: number) => !!db.select().from(accounts).where(eq(accounts.id, id)).get();
    if ((b.accountId !== null && !accountExists(b.accountId)) || (b.toAccountId !== null && !accountExists(b.toAccountId))) {
      return { status: 404 as const, errors: ["account_not_found"] };
    }
    if (b.cardId !== null && !db.select().from(cards).where(eq(cards.id, b.cardId)).get()) {
      return { status: 404 as const, errors: ["card_not_found"] };
    }
    if (!db.select().from(people).where(eq(people.id, b.personId)).get()) {
      return { status: 404 as const, errors: ["person_not_found"] };
    }
    const { kind, amountCents, date, accountId, toAccountId, categoryId, cardId, statementMonth, feeKind, description, status, personId } = b;
    return { values: { kind, amountCents, date, accountId, toAccountId, categoryId, cardId, statementMonth, feeKind, description, status, personId } };
  };

  app.get("/", (c) => {
    const month = c.req.query("month");
    if (month !== undefined && !monthSchema.safeParse(month).success) return c.json({ errors: ["invalid_month"] }, 422);
    const accountId = c.req.query("accountId") ? Number(c.req.query("accountId")) : undefined;
    const personId = c.req.query("personId") ? Number(c.req.query("personId")) : undefined;
    const categoryId = c.req.query("categoryId") ? Number(c.req.query("categoryId")) : undefined;
    const cardId = c.req.query("cardId") ? Number(c.req.query("cardId")) : undefined;
    const filters = [
      month ? like(transactions.date, `${month}-%`) : undefined,
      accountId ? or(eq(transactions.accountId, accountId), eq(transactions.toAccountId, accountId)) : undefined,
      personId ? eq(transactions.personId, personId) : undefined,
      categoryId ? eq(transactions.categoryId, categoryId) : undefined,
      cardId ? eq(transactions.cardId, cardId) : undefined,
    ];
    const rows = db.select().from(transactions).where(and(...filters))
      .orderBy(desc(transactions.date), desc(transactions.id)).all();
    return c.json(rows.map(transactionDto));
  });

  app.post("/", async (c) => {
    const result = await parseBody(await c.req.json().catch(() => null));
    if ("errors" in result) return c.json({ errors: result.errors }, result.status);
    return c.json(transactionDto(db.insert(transactions).values(result.values).returning().get()), 201);
  });

  app.put("/:id", async (c) => {
    const id = Number(c.req.param("id"));
    if (!db.select().from(transactions).where(eq(transactions.id, id)).get()) return c.json({ errors: ["transaction_not_found"] }, 404);
    const result = await parseBody(await c.req.json().catch(() => null));
    if ("errors" in result) return c.json({ errors: result.errors }, result.status);
    return c.json(transactionDto(db.update(transactions).set(result.values).where(eq(transactions.id, id)).returning().get()));
  });

  app.delete("/:id", (c) => {
    const id = Number(c.req.param("id"));
    const deleted = db.delete(transactions).where(eq(transactions.id, id)).returning().all();
    return deleted.length ? c.body(null, 204) : c.json({ errors: ["transaction_not_found"] }, 404);
  });

  return app;
}
