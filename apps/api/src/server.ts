import { serve } from "@hono/node-server";
import { createApp } from "./app";
import { createDatabase } from "./db/client";

const dbPath = process.env.DATABASE_PATH ?? "finfamily.db";
const port = Number(process.env.PORT ?? 3333);

const app = createApp(createDatabase(dbPath));
serve({ fetch: app.fetch, port, hostname: "0.0.0.0" }, (info) => {
  console.log(`FinFamily API listening on http://0.0.0.0:${info.port} (db: ${dbPath})`);
});
