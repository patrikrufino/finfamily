import { CATEGORY_KINDS, DEFAULT_CATEGORIES, isCategoryIcon, type CategoryKind } from "@finfamily/domain";
import { and, eq } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import type { AppDatabase } from "../db/client";
import { categories } from "../db/schema";

const nameSchema = z.string().trim().min(1).max(60);
const iconSchema = z.string().refine(isCategoryIcon, { message: "invalid_icon" });
const createSchema = z.object({
  name: nameSchema,
  kind: z.enum(CATEGORY_KINDS).default("expense"),
  icon: iconSchema.nullish().transform((v) => v ?? null),
});
// The kind is chosen when the category is created and never changes, so it is not part of an edit.
const patchSchema = z.object({
  name: nameSchema.optional(),
  icon: iconSchema.nullable().optional(),
  archived: z.boolean().optional(),
});

const sameName = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();

/**
 * Adds the default categories that are missing, matching by name and kind (archived ones count, so a default the user archived
 * does not come back). Existing categories are never touched.
 */
export function seedDefaultCategories(db: AppDatabase): { created: number } {
  const existing = db.select().from(categories).all();
  const missing = DEFAULT_CATEGORIES.filter((d) => !existing.some((c) => c.kind === d.kind && sameName(c.name, d.name)));
  if (missing.length > 0) {
    db.insert(categories).values(missing.map((d) => ({ name: d.name, kind: d.kind, icon: d.icon }))).run();
  }
  return { created: missing.length };
}

export function categoriesRoutes(db: AppDatabase) {
  const app = new Hono();

  const activeNameTaken = (name: string, kind: CategoryKind, exceptId?: number) =>
    db.select().from(categories).where(and(eq(categories.archived, false), eq(categories.kind, kind))).all()
      .some((c) => c.id !== exceptId && sameName(c.name, name));

  const invalid = (error: z.ZodError) =>
    error.issues.some((i) => i.message === "invalid_icon") ? ["invalid_icon"] : ["invalid_category"];

  app.get("/", (c) => {
    const includeArchived = c.req.query("includeArchived") === "true";
    const kind = c.req.query("kind");
    if (kind !== undefined && !(CATEGORY_KINDS as readonly string[]).includes(kind)) return c.json({ errors: ["invalid_kind"] }, 422);
    const rows = db.select().from(categories).orderBy(categories.name).all();
    return c.json(rows.filter((r) => (includeArchived || !r.archived) && (kind === undefined || r.kind === kind)));
  });

  /** Adds the missing default categories (idempotent). */
  app.post("/defaults", (c) => c.json(seedDefaultCategories(db), 201));

  app.post("/", async (c) => {
    const parsed = createSchema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) return c.json({ errors: invalid(parsed.error) }, 422);
    if (activeNameTaken(parsed.data.name, parsed.data.kind)) return c.json({ errors: ["category_name_taken"] }, 409);
    return c.json(db.insert(categories).values(parsed.data).returning().get(), 201);
  });

  app.patch("/:id", async (c) => {
    const id = Number(c.req.param("id"));
    const existing = db.select().from(categories).where(eq(categories.id, id)).get();
    if (!existing) return c.json({ errors: ["category_not_found"] }, 404);
    const body = await c.req.json().catch(() => null);
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) return c.json({ errors: invalid(parsed.error) }, 422);
    if (Object.keys(parsed.data).length === 0) return c.json(existing); // e.g. an attempt to change the kind: nothing to change
    const next = { ...existing, ...parsed.data };
    if (!next.archived && activeNameTaken(next.name, existing.kind, id)) return c.json({ errors: ["category_name_taken"] }, 409);
    return c.json(db.update(categories).set(parsed.data).where(eq(categories.id, id)).returning().get());
  });

  return app;
}
