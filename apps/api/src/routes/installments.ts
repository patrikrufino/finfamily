import {
  Money,
  buildInstallmentSchedule,
  installmentStatusFor,
  isValidIsoDate,
  planProgress,
  validateAnticipation,
  validateInstallmentPlan,
  validateTransactionCategory,
  type Transaction,
} from "@finfamily/domain";
import { and, eq } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import type { AppDatabase } from "../db/client";
import { accounts, cards, categories, installmentPlans, people, transactions } from "../db/schema";
import { toDomainTransaction, transactionDto } from "../mappers";

const createSchema = z.object({
  description: z.string().trim().min(1).max(120),
  totalCents: z.number().int(),
  count: z.number().int(),
  firstDate: z.string(),
  accountId: z.number().int().nullish().transform((v) => v ?? null),
  cardId: z.number().int().nullish().transform((v) => v ?? null),
  categoryId: z.number().int().nullish().transform((v) => v ?? null),
  personId: z.number().int(),
});
const anticipateSchema = z.object({
  installmentIds: z.array(z.number().int()),
  amountCents: z.number().int(),
  date: z.string().refine(isValidIsoDate),
  personId: z.number().int().optional(),
});

export function installmentsRoutes(db: AppDatabase, today: () => string) {
  const app = new Hono();

  const findPlan = (id: number) => db.select().from(installmentPlans).where(eq(installmentPlans.id, id)).get();
  const itemsOf = (planId: number) => db.select().from(transactions).where(eq(transactions.planId, planId)).all();

  /** Installments in order (anticipation items last), then by date. */
  const sorted = (rows: ReturnType<typeof itemsOf>) =>
    [...rows].sort((a, b) =>
      (a.installmentNumber ?? Number.MAX_SAFE_INTEGER) - (b.installmentNumber ?? Number.MAX_SAFE_INTEGER) ||
      a.date.localeCompare(b.date) || a.id - b.id);

  function summary(plan: typeof installmentPlans.$inferSelect) {
    const rows = itemsOf(plan.id);
    const progress = planProgress(rows.map(toDomainTransaction));
    return { ...plan, ...progress, status: progress.remainingCount > 0 ? ("active" as const) : ("done" as const) };
  }
  const detail = (plan: typeof installmentPlans.$inferSelect) => ({
    ...summary(plan),
    installments: sorted(itemsOf(plan.id)).map(transactionDto),
  });

  app.get("/", (c) => {
    const rows = db.select().from(installmentPlans).orderBy(installmentPlans.id).all().map(summary);
    // Active plans first, then by the next installment due.
    rows.sort((a, b) =>
      Number(b.status === "active") - Number(a.status === "active") ||
      (a.nextDate ?? "9999").localeCompare(b.nextDate ?? "9999") || a.id - b.id);
    return c.json(rows);
  });

  app.get("/:id", (c) => {
    const plan = findPlan(Number(c.req.param("id")));
    return plan ? c.json(detail(plan)) : c.json({ errors: ["plan_not_found"] }, 404);
  });

  app.post("/", async (c) => {
    const parsed = createSchema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) return c.json({ errors: ["invalid_plan"] }, 422);
    const p = parsed.data;
    const errors: string[] = [
      ...validateInstallmentPlan({ total: Money.fromCents(p.totalCents), count: p.count, firstDate: p.firstDate, accountId: p.accountId, cardId: p.cardId }),
    ];
    const category = p.categoryId === null ? null : db.select().from(categories).where(eq(categories.id, p.categoryId)).get();
    if (category) errors.push(...validateTransactionCategory("expense", category));
    if (errors.length) return c.json({ errors }, 422);

    if (p.categoryId !== null && !category) return c.json({ errors: ["category_not_found"] }, 404);
    if (p.accountId !== null && !db.select().from(accounts).where(eq(accounts.id, p.accountId)).get()) return c.json({ errors: ["account_not_found"] }, 404);
    if (p.cardId !== null && !db.select().from(cards).where(eq(cards.id, p.cardId)).get()) return c.json({ errors: ["card_not_found"] }, 404);
    if (!db.select().from(people).where(eq(people.id, p.personId)).get()) return c.json({ errors: ["person_not_found"] }, 404);

    const plan = db.transaction((tx) => {
      const created = tx.insert(installmentPlans).values({
        description: p.description, totalCents: p.totalCents, count: p.count, firstDate: p.firstDate,
        accountId: p.accountId, cardId: p.cardId, categoryId: p.categoryId, personId: p.personId,
      }).returning().get();
      for (const item of buildInstallmentSchedule(Money.fromCents(p.totalCents), p.count, p.firstDate)) {
        tx.insert(transactions).values({
          kind: "expense", amountCents: item.amount.cents, date: item.date, accountId: p.accountId, cardId: p.cardId,
          categoryId: p.categoryId, description: p.description, status: installmentStatusFor(item.date, today()),
          personId: p.personId, planId: created.id, installmentNumber: item.number,
        }).run();
      }
      return created;
    });
    return c.json(detail(plan), 201);
  });

  /**
   * Pays installments ahead of time: the picked ones are removed and replaced by a single item with the amount
   * actually paid (equal or lower, for a discount) on the payment date, on the plan's account or card.
   */
  app.post("/:id/anticipate", async (c) => {
    const plan = findPlan(Number(c.req.param("id")));
    if (!plan) return c.json({ errors: ["plan_not_found"] }, 404);
    const parsed = anticipateSchema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) return c.json({ errors: ["invalid_anticipation"] }, 422);
    const { installmentIds, amountCents, date } = parsed.data;
    const personId = parsed.data.personId ?? plan.personId;
    if (!db.select().from(people).where(eq(people.id, personId)).get()) return c.json({ errors: ["person_not_found"] }, 404);

    const rows = itemsOf(plan.id);
    const domain: Transaction[] = rows.map(toDomainTransaction);
    const errors = validateAnticipation(domain, installmentIds, Money.fromCents(amountCents), today());
    if (errors.length) return c.json({ errors }, 422);

    db.transaction((tx) => {
      for (const id of installmentIds) tx.delete(transactions).where(eq(transactions.id, id)).run();
      tx.insert(transactions).values({
        kind: "expense", amountCents, date, accountId: plan.accountId, cardId: plan.cardId, categoryId: plan.categoryId,
        description: `Antecipação · ${plan.description}`, status: installmentStatusFor(date, today()), personId,
        planId: plan.id, installmentNumber: null,
      }).run();
    });
    return c.json(detail(plan), 201);
  });

  /** Cancels the plan: scheduled installments go away, settled ones stay as history. */
  app.delete("/:id", (c) => {
    const plan = findPlan(Number(c.req.param("id")));
    if (!plan) return c.json({ errors: ["plan_not_found"] }, 404);
    db.transaction((tx) => {
      tx.delete(transactions).where(and(eq(transactions.planId, plan.id), eq(transactions.status, "scheduled"))).run();
      const left = tx.select().from(transactions).where(eq(transactions.planId, plan.id)).all();
      if (left.length === 0) tx.delete(installmentPlans).where(eq(installmentPlans.id, plan.id)).run();
    });
    return c.body(null, 204);
  });

  return app;
}

