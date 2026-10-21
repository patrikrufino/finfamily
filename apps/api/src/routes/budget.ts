import { Money, budgetForMonth, budgetProgress } from "@finfamily/domain";
import { and, eq, like } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import type { AppDatabase } from "../db/client";
import { budgets, categories, transactions } from "../db/schema";

const monthSchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/);
const putSchema = z.object({ month: monthSchema, amountCents: z.number().int().min(0) });

export function budgetRoutes(db: AppDatabase) {
  const app = new Hono();

  /** Sets the monthly budget of a category from `month` onward (upsert of that month's entry). */
  app.put("/api/budgets/:categoryId", async (c) => {
    const categoryId = Number(c.req.param("categoryId"));
    const parsed = putSchema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) return c.json({ errors: ["invalid_budget"] }, 422);
    if (!db.select().from(categories).where(eq(categories.id, categoryId)).get()) {
      return c.json({ errors: ["category_not_found"] }, 404);
    }
    const { month, amountCents } = parsed.data;
    const row = db.insert(budgets).values({ categoryId, fromMonth: month, amountCents })
      .onConflictDoUpdate({ target: [budgets.categoryId, budgets.fromMonth], set: { amountCents } })
      .returning().get();
    return c.json(row);
  });

  app.get("/api/budget", (c) => {
    const month = c.req.query("month") ?? "";
    if (!monthSchema.safeParse(month).success) return c.json({ errors: ["invalid_month"] }, 422);

    return c.json(budgetReport(db, month));
  });

  return app;
}

/** Budget vs spending of a month, per category, plus uncategorized spending and totals. */
export function budgetReport(db: AppDatabase, month: string) {
  const entries = db.select().from(budgets).all().map((b) => ({
    categoryId: b.categoryId, fromMonth: b.fromMonth, amount: Money.fromCents(b.amountCents),
  }));
  const expenses = db.select().from(transactions)
    .where(and(like(transactions.date, `${month}-%`), eq(transactions.kind, "expense"), eq(transactions.adjustment, false)))
    .all();

  const sumFor = (categoryId: number | null, status: "settled" | "scheduled") =>
    expenses.filter((t) => t.categoryId === categoryId && t.status === status).reduce((s, t) => s + t.amountCents, 0);

  const rows = db.select().from(categories).orderBy(categories.name).all().flatMap((cat) => {
    const spent = sumFor(cat.id, "settled");
    const committed = sumFor(cat.id, "scheduled");
    if (cat.archived && spent === 0 && committed === 0) return [];
    const p = budgetProgress(budgetForMonth(entries, cat.id, month), Money.fromCents(spent), Money.fromCents(committed));
    return [{
      categoryId: cat.id,
      name: cat.name,
      kind: cat.kind,
      archived: cat.archived,
      budgetCents: p.budget.cents,
      spentCents: p.spent.cents,
      committedCents: p.committed.cents,
      remainingCents: p.remaining.cents,
      availableAfterCommittedCents: p.availableAfterCommitted.cents,
      ratio: p.ratio,
      status: p.status,
    }];
  });

  const budgeted = rows.filter((r) => r.budgetCents > 0);
  return {
  month,
    categories: rows,
    uncategorized: { spentCents: sumFor(null, "settled"), committedCents: sumFor(null, "scheduled") },
    totals: {
      budgetCents: budgeted.reduce((s, r) => s + r.budgetCents, 0),
      spentCents: budgeted.reduce((s, r) => s + r.spentCents, 0),
      remainingCents: budgeted.reduce((s, r) => s + r.remainingCents, 0),
    },
  };
}
