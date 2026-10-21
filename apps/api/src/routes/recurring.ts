import {
  FREQUENCIES,
  Money,
  dueOccurrences,
  firstIndexOnOrAfter,
  occurrenceDate,
  validateRecurring,
  validateTransactionCategory,
  type RecurringRule,
} from "@finfamily/domain";
import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import type { AppDatabase } from "../db/client";
import { accounts, cards, categories, people, recurringRules, transactions } from "../db/schema";

const createSchema = z.object({
  kind: z.enum(["income", "expense"]),
  amountCents: z.number().int(),
  description: z.string().trim().max(120).default(""),
  accountId: z.number().int().nullish().transform((v) => v ?? null),
  cardId: z.number().int().nullish().transform((v) => v ?? null),
  categoryId: z.number().int().nullish().transform((v) => v ?? null),
  personId: z.number().int(),
  frequency: z.enum(FREQUENCIES),
  // Dates are validated by the domain so that the client gets a precise error code.
  startDate: z.string(),
  endDate: z.string().nullish().transform((v) => v ?? null),
});
const patchSchema = z.object({
  amountCents: z.number().int().optional(),
  description: z.string().trim().max(120).optional(),
  categoryId: z.number().int().nullable().optional(),
  endDate: z.string().nullable().optional(),
  active: z.boolean().optional(),
});

type RuleRow = typeof recurringRules.$inferSelect;

const toDomain = (row: RuleRow): RecurringRule => ({
  id: row.id, kind: row.kind, amount: Money.fromCents(row.amountCents), description: row.description, accountId: row.accountId,
  cardId: row.cardId, categoryId: row.categoryId, personId: row.personId, frequency: row.frequency, startDate: row.startDate,
  endDate: row.endDate, nextIndex: row.nextIndex, active: row.active,
});

/**
 * Posts every occurrence whose date has arrived, once each (the rule remembers the next index), as settled transactions.
 * Idempotent and cheap, so the API calls it on every request.
 */
export function postDueRecurring(db: AppDatabase, today: string): void {
  for (const row of db.select().from(recurringRules).where(eq(recurringRules.active, true)).all()) {
    const due = dueOccurrences(toDomain(row), today);
    const last = due[due.length - 1];
    if (!last) continue;
    db.transaction((tx) => {
      for (const occurrence of due) {
        tx.insert(transactions).values({
          kind: row.kind, amountCents: row.amountCents, date: occurrence.date, accountId: row.accountId, cardId: row.cardId,
          categoryId: row.categoryId, description: row.description, status: "settled", personId: row.personId, recurringId: row.id,
        }).run();
      }
      tx.update(recurringRules).set({ nextIndex: last.index + 1 }).where(eq(recurringRules.id, row.id)).run();
    });
  }
}

export function recurringRoutes(db: AppDatabase, today: () => string) {
  const app = new Hono();

  const find = (id: number) => db.select().from(recurringRules).where(eq(recurringRules.id, id)).get();
  const postedCount = (id: number) => db.select().from(transactions).where(eq(transactions.recurringId, id)).all().length;

  const dto = (row: RuleRow) => {
    const nextDate = occurrenceDate(row.startDate, row.frequency, row.nextIndex);
    const ended = row.endDate !== null && nextDate > row.endDate;
    return {
      id: row.id, kind: row.kind, amountCents: row.amountCents, description: row.description, accountId: row.accountId,
      cardId: row.cardId, categoryId: row.categoryId, personId: row.personId, frequency: row.frequency,
      startDate: row.startDate, endDate: row.endDate, active: row.active,
      nextDate, postedCount: postedCount(row.id),
      status: ended ? ("ended" as const) : row.active ? ("active" as const) : ("paused" as const),
    };
  };

  function checkCategory(kind: "income" | "expense", categoryId: number | null) {
    if (categoryId === null) return null;
    const category = db.select().from(categories).where(eq(categories.id, categoryId)).get();
    if (!category) return { status: 404 as const, errors: ["category_not_found"] };
    const errors = validateTransactionCategory(kind, category);
    return errors.length ? { status: 422 as const, errors } : null;
  }

  app.get("/", (c) => {
    const rows = db.select().from(recurringRules).orderBy(recurringRules.id).all().map(dto);
    const order = { active: 0, paused: 1, ended: 2 } as const;
    rows.sort((a, b) => order[a.status] - order[b.status] || a.nextDate.localeCompare(b.nextDate) || a.id - b.id);
    return c.json(rows);
  });

  app.post("/", async (c) => {
    const parsed = createSchema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) return c.json({ errors: ["invalid_recurring"] }, 422);
    const p = parsed.data;
    const errors = validateRecurring({
      kind: p.kind, amount: Money.fromCents(p.amountCents), frequency: p.frequency, startDate: p.startDate,
      endDate: p.endDate, accountId: p.accountId, cardId: p.cardId,
    });
    const categoryError = checkCategory(p.kind, p.categoryId);
    if (categoryError?.status === 422) errors.push(...(categoryError.errors as never[]));
    if (errors.length) return c.json({ errors }, 422);
    if (categoryError) return c.json({ errors: categoryError.errors }, categoryError.status);
    if (p.accountId !== null && !db.select().from(accounts).where(eq(accounts.id, p.accountId)).get()) return c.json({ errors: ["account_not_found"] }, 404);
    if (p.cardId !== null && !db.select().from(cards).where(eq(cards.id, p.cardId)).get()) return c.json({ errors: ["card_not_found"] }, 404);
    if (!db.select().from(people).where(eq(people.id, p.personId)).get()) return c.json({ errors: ["person_not_found"] }, 404);

    // Past occurrences are never backfilled: posting starts at the first one that is today or later.
    const row = db.insert(recurringRules).values({
      kind: p.kind, amountCents: p.amountCents, description: p.description, accountId: p.accountId, cardId: p.cardId,
      categoryId: p.categoryId, personId: p.personId, frequency: p.frequency, startDate: p.startDate, endDate: p.endDate,
      nextIndex: firstIndexOnOrAfter(p.startDate, p.frequency, today()),
    }).returning().get();
    postDueRecurring(db, today());
    return c.json(dto(find(row.id)!), 201);
  });

  app.patch("/:id", async (c) => {
    const row = find(Number(c.req.param("id")));
    if (!row) return c.json({ errors: ["rule_not_found"] }, 404);
    const parsed = patchSchema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) return c.json({ errors: ["invalid_recurring"] }, 422);
    const p = parsed.data;
    const next = { ...row, ...p };
    const errors = validateRecurring({
      kind: next.kind, amount: Money.fromCents(next.amountCents), frequency: next.frequency, startDate: next.startDate,
      endDate: next.endDate, accountId: next.accountId, cardId: next.cardId,
    });
    const categoryError = checkCategory(next.kind, next.categoryId);
    if (categoryError?.status === 422) errors.push(...(categoryError.errors as never[]));
    if (errors.length) return c.json({ errors }, 422);
    if (categoryError) return c.json({ errors: categoryError.errors }, categoryError.status);

    const changes: Partial<RuleRow> = { ...p };
    // Resuming never backfills the time it was paused.
    if (p.active === true && !row.active) {
      changes.nextIndex = Math.max(row.nextIndex, firstIndexOnOrAfter(row.startDate, row.frequency, today()));
    }
    const updated = db.update(recurringRules).set(changes).where(eq(recurringRules.id, row.id)).returning().get();
    postDueRecurring(db, today());
    return c.json(dto(find(updated.id)!));
  });

  app.delete("/:id", (c) => {
    const row = find(Number(c.req.param("id")));
    if (!row) return c.json({ errors: ["rule_not_found"] }, 404);
    if (postedCount(row.id) > 0) return c.json({ errors: ["rule_has_postings"] }, 422);
    db.delete(recurringRules).where(eq(recurringRules.id, row.id)).run();
    return c.body(null, 204);
  });

  return app;
}
