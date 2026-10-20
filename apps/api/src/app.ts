import { Hono } from "hono";
import type { AppDatabase } from "./db/client";
import { people } from "./db/schema";

export function createApp(db: AppDatabase) {
  const app = new Hono();

  app.get("/api/health", (c) => c.json({ status: "ok" }));
  app.get("/api/people", (c) => c.json(db.select().from(people).orderBy(people.id).all()));

  return app;
}
