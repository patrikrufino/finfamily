import { serve } from "@hono/node-server";
import { createServer } from "node:https";
import { networkInterfaces } from "node:os";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createApp } from "./app";
import { startBackupSchedule } from "./backup/backup";
import { loadConfig, loadTlsOptions } from "./config";
import { createDatabase } from "./db/client";

const config = loadConfig(process.env, dirname(fileURLToPath(import.meta.url)) + "/..");
const tls = loadTlsOptions(process.env);

const db = createDatabase(config.databasePath);
const app = createApp(db, { backup: config.backup, webDist: config.webDist });
const stopBackups = startBackupSchedule(db.$client, config.backup);

const protocol = tls ? "https" : "http";
const server = serve(
  { fetch: app.fetch, port: config.port, hostname: "0.0.0.0", ...(tls ? { createServer, serverOptions: tls } : {}) },
  (info) => {
    console.log(`FinFamily listening on port ${info.port} (db: ${config.databasePath})`);
    if (!config.webDist) console.log("Web app not found: run `pnpm build` to serve it from here, or use `pnpm dev`.");
    console.log(`Open on this computer: ${protocol}://localhost:${info.port}`);
    for (const addresses of Object.values(networkInterfaces())) {
      for (const a of addresses ?? []) {
        if (a.family === "IPv4" && !a.internal) console.log(`Open on your phone:    ${protocol}://${a.address}:${info.port}`);
      }
    }
  },
);

function shutdown() {
  stopBackups();
  server.close(() => {
    db.$client.close(); // checkpoints the WAL so the .db file is complete on disk
    process.exit(0);
  });
  setTimeout(() => process.exit(0), 3000).unref();
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
