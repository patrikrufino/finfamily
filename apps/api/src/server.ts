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
const stopBackups = startBackupSchedule(db.$client, config.backup);

const protocol = tls ? "https" : "http";
const listen = (fetch: (request: Request) => Response | Promise<Response>, port: number, onListening: () => void) =>
  serve({ fetch, port, hostname: "0.0.0.0", ...(tls ? { createServer, serverOptions: tls } : {}) }, onListening);

// Two listeners on the same database: one with the API only, one with the web app, which also answers /api so the browser
// (and the service worker) stay on a single origin.
const servers = [
  listen(createApp(db, { backup: config.backup }).fetch, config.apiPort, () => {
    console.log(`API listening on port ${config.apiPort} (db: ${config.databasePath})`);
  }),
];

if (config.webDist) {
  servers.push(
    listen(createApp(db, { backup: config.backup, webDist: config.webDist }).fetch, config.webPort, () => {
      console.log(`App listening on port ${config.webPort}`);
      console.log(`Open on this computer: ${protocol}://localhost:${config.webPort}`);
      for (const addresses of Object.values(networkInterfaces())) {
        for (const a of addresses ?? []) {
          if (a.family === "IPv4" && !a.internal) console.log(`Open on your phone:    ${protocol}://${a.address}:${config.webPort}`);
        }
      }
      if (!tls) {
        console.log(
          "\nNote: over plain HTTP a phone cannot install the app (PWA) or use offline mode; it only works as a website.\n" +
            `For that, open it over HTTPS, e.g. with Tailscale: tailscale serve --bg --https=443 http://localhost:${config.webPort}\n` +
            "(see README, \"Instalar no celular\"). On this computer, http://localhost already counts as secure.\n",
        );
      }
    }),
  );
} else {
  console.log("Web app not found: run `pnpm build` to serve it from here, or use `pnpm dev` (Vite serves it on the web port).");
}

function shutdown() {
  stopBackups();
  let open = servers.length;
  const done = () => {
    if (--open === 0) {
      db.$client.close(); // checkpoints the WAL so the .db file is complete on disk
      process.exit(0);
    }
  };
  for (const server of servers) server.close(done);
  setTimeout(() => process.exit(0), 3000).unref();
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
