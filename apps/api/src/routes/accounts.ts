import { ACCOUNT_TYPES, accountBalance } from "@finfamily/domain";
import { and, eq } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import type { AppDatabase } from "../db/client";
import { accounts, transactions } from "../db/schema";
import { toDomainAccount, toDomainTransaction } from "../mappers";

const createSchema = z.object({
  name: z.string().trim().min(1).max(80),
  type: z.enum(ACCOUNT_TYPES),
  initialBalanceCents: z.number().int().default(0),
});
const patchSchema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  archived: z.boolean().optional(),
});

export function accountsRoutes(db: AppDatabase) {
  const app = new Hono();

  const withBalances = (row: typeof accounts.$inferSelect) => {
    const account = toDomainAccount(row);
    const txs = db.select().from(transactions).all().map(toDomainTransaction);
    return {
      id: row.id,
      name: row.name,
      type: row.type,
      initialBalanceCents: row.initialBalanceCents,
      archived: row.archived,
      balanceCents: accountBalance(account, txs).cents,
      projectedBalanceCents: accountBalance(account, txs, { includeScheduled: true }).cents,
    };
  };

  const activeNameTaken = (name: string, exceptId?: number) =>
    db.select().from(accounts).where(and(eq(accounts.name, name), eq(accounts.archived, false))).all()
      .some((a) => a.id !== exceptId);

  app.get("/", (c) => {
    const includeArchived = c.req.query("includeArchived") === "true";
    const rows = db.select().from(accounts).orderBy(accounts.id).all();
    return c.json(rows.filter((r) => includeArchived || !r.archived).map(withBalances));
  });

  app.post("/", async (c) => {
    const parsed = createSchema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) return c.json({ errors: ["invalid_account"] }, 422);
    if (activeNameTaken(parsed.data.name)) return c.json({ errors: ["account_name_taken"] }, 409);
    const row = db.insert(accounts).values(parsed.data).returning().get();
    return c.json(withBalances(row), 201);
  });

  app.patch("/:id", async (c) => {
    const id = Number(c.req.param("id"));
    const existing = db.select().from(accounts).where(eq(accounts.id, id)).get();
    if (!existing) return c.json({ errors: ["account_not_found"] }, 404);
    const parsed = patchSchema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) return c.json({ errors: ["invalid_account"] }, 422);
    const next = { ...existing, ...parsed.data };
    if (!next.archived && activeNameTaken(next.name, id)) return c.json({ errors: ["account_name_taken"] }, 409);
    const row = db.update(accounts).set(parsed.data).where(eq(accounts.id, id)).returning().get();
    return c.json(withBalances(row));
  });

  return app;
}
