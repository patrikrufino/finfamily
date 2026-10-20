import { CATEGORY_KINDS } from "@finfamily/domain";
import { and, eq } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import type { AppDatabase } from "../db/client";
import { categories, transactions } from "../db/schema";

const nameSchema = z.string().trim().min(1).max(60);
const createSchema = z.object({ name: nameSchema, kind: z.enum(CATEGORY_KINDS).default("expense") });
const patchSchema = z.object({
  name: nameSchema.optional(),
  kind: z.enum(CATEGORY_KINDS).optional(),
  archived: z.boolean().optional(),
});

export function categoriesRoutes(db: AppDatabase) {
  const app = new Hono();

  const activeNameTaken = (name: string, exceptId?: number) =>
    db.select().from(categories).where(eq(categories.archived, false)).all()
      .some((c) => c.id !== exceptId && c.name.toLowerCase() === name.toLowerCase());

  app.get("/", (c) => {
    const includeArchived = c.req.query("includeArchived") === "true";
    const rows = db.select().from(categories).orderBy(categories.name).all();
    return c.json(rows.filter((r) => includeArchived || !r.archived));
  });

  app.post("/", async (c) => {
    const parsed = createSchema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) return c.json({ errors: ["invalid_category"] }, 422);
    if (activeNameTaken(parsed.data.name)) return c.json({ errors: ["category_name_taken"] }, 409);
    return c.json(db.insert(categories).values(parsed.data).returning().get(), 201);
  });

  app.patch("/:id", async (c) => {
    const id = Number(c.req.param("id"));
    const existing = db.select().from(categories).where(eq(categories.id, id)).get();
    if (!existing) return c.json({ errors: ["category_not_found"] }, 404);
    const parsed = patchSchema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) return c.json({ errors: ["invalid_category"] }, 422);
    const next = { ...existing, ...parsed.data };
    if (!next.archived && activeNameTaken(next.name, id)) return c.json({ errors: ["category_name_taken"] }, 409);
    if (existing.kind === "both" && next.kind === "expense") {
      const usedByIncome = db.select().from(transactions)
        .where(and(eq(transactions.categoryId, id), eq(transactions.kind, "income"))).get();
      if (usedByIncome) return c.json({ errors: ["category_used_by_income"] }, 409);
    }
    return c.json(db.update(categories).set(parsed.data).where(eq(categories.id, id)).returning().get());
  });

  return app;
}
