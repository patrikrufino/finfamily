import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import type { BackupConfig } from "./backup/backup";

export interface AppConfig {
  /** Port of the API alone (`/api/*`). */
  apiPort: number;
  /** Port of the web app, which also answers `/api/*` so the browser stays on a single origin. */
  webPort: number;
  databasePath: string;
  /** Folder with the built web app, or null when the API runs alone (development). */
  webDist: string | null;
  backup: BackupConfig;
}

type Env = Record<string, string | undefined>;

function number(env: Env, name: string, fallback: number, min: number): number {
  const raw = env[name];
  if (raw === undefined || raw === "") return fallback;
  const value = Number(raw);
  if (!Number.isFinite(value) || value < min) throw new Error(`${name} must be a number >= ${min}, received "${raw}"`);
  return value;
}

/** Reads the settings from environment variables. `baseDir` is the folder of the API package. */
export function loadConfig(env: Env, baseDir: string): AppConfig {
  const databasePath = env.DATABASE_PATH || "finfamily.db";
  const defaultDist = join(baseDir, "..", "web", "dist");
  const apiPort = number(env, "API_PORT", 3132, 1);
  const webPort = number(env, "WEB_PORT", 3152, 1);
  if (apiPort === webPort) throw new Error(`API_PORT and WEB_PORT must be different, both are ${apiPort}`);
  return {
    apiPort,
    webPort,
    databasePath,
    // WEB_DIST=off keeps the web port free for a dev server.
    webDist: env.WEB_DIST === "off" ? null : env.WEB_DIST || (existsSync(defaultDist) ? defaultDist : null),
    backup: {
      dir: env.BACKUP_DIR || join(dirname(databasePath), "backups"),
      keep: number(env, "BACKUP_KEEP", 14, 1),
      intervalHours: number(env, "BACKUP_INTERVAL_HOURS", 24, 0),
    },
  };
}

/** HTTPS needs a secure context for installing the PWA on a phone. Both files are required, or neither. */
export function loadTlsOptions(env: Env): { cert: Buffer; key: Buffer } | null {
  const certPath = env.TLS_CERT;
  const keyPath = env.TLS_KEY;
  if (!certPath && !keyPath) return null;
  if (!certPath) throw new Error("TLS_KEY is set but TLS_CERT is missing");
  if (!keyPath) throw new Error("TLS_CERT is set but TLS_KEY is missing");
  for (const path of [certPath, keyPath]) {
    if (!existsSync(path)) throw new Error(`TLS file not found: ${path}`);
  }
  return { cert: readFileSync(certPath), key: readFileSync(keyPath) };
}
