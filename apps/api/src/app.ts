import { and, eq, isNotNull, lte } from "drizzle-orm";
import { Hono } from "hono";
import type { AppDatabase } from "./db/client";
import { people, transactions } from "./db/schema";
import { budgetRoutes } from "./routes/budget";
import { cardsRoutes } from "./routes/cards";
import { categoriesRoutes } from "./routes/categories";
import { accountsRoutes } from "./routes/accounts";
import { debtsRoutes } from "./routes/debts";
import { installmentsRoutes } from "./routes/installments";
import { transactionsRoutes } from "./routes/transactions";

export interface AppOptions {
  /** Current local date (`YYYY-MM-DD`); injectable so statements can be tested deterministically. */
  today?: () => string;
}

const localToday = () => new Date().toLocaleDateString("sv-SE");

export function createApp(db: AppDatabase, { today = localToday }: AppOptions = {}) {
  const app = new Hono();

  // Installments are settled automatically once their date arrives (idempotent and cheap, so done per request).
  app.use("/api/*", async (_c, next) => {
    db.update(transactions).set({ status: "settled" })
      .where(and(eq(transactions.status, "scheduled"), isNotNull(transactions.planId), lte(transactions.date, today())))
      .run();
    await next();
  });

  app.get("/api/health", (c) => c.json({ status: "ok" }));
  app.get("/api/people", (c) => c.json(db.select().from(people).orderBy(people.id).all()));
  app.route("/api/accounts", accountsRoutes(db, today));
  app.route("/api/categories", categoriesRoutes(db));
  app.route("/api/cards", cardsRoutes(db, today));
  app.route("/", budgetRoutes(db));
  app.route("/api/debts", debtsRoutes(db, today));
  app.route("/api/installment-plans", installmentsRoutes(db, today));
  app.route("/api/transactions", transactionsRoutes(db));

  return app;
}
