import { Hono } from "hono";
import type { AppDatabase } from "./db/client";
import { people } from "./db/schema";
import { budgetRoutes } from "./routes/budget";
import { categoriesRoutes } from "./routes/categories";
import { accountsRoutes } from "./routes/accounts";
import { transactionsRoutes } from "./routes/transactions";

export function createApp(db: AppDatabase) {
  const app = new Hono();

  app.get("/api/health", (c) => c.json({ status: "ok" }));
  app.get("/api/people", (c) => c.json(db.select().from(people).orderBy(people.id).all()));
  app.route("/api/accounts", accountsRoutes(db));
  app.route("/api/categories", categoriesRoutes(db));
  app.route("/", budgetRoutes(db));
  app.route("/api/transactions", transactionsRoutes(db));

  return app;
}
