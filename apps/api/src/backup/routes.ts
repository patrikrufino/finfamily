import type Database from "better-sqlite3";
import { Hono } from "hono";
import { createBackup, listBackups, type BackupConfig } from "./backup";

/** Lists backups and makes one on demand. Only names, sizes and dates are exposed, never server paths. */
export function backupRoutes(sqlite: Database.Database, config: BackupConfig) {
  const app = new Hono();

  app.get("/", (c) => {
    const backups = listBackups(config.dir);
    return c.json({
      backups,
      lastBackupAt: backups[0]?.createdAt ?? null,
      schedule: { intervalHours: config.intervalHours, keep: config.keep },
    });
  });

  app.post("/", async (c) => {
    try {
      return c.json(await createBackup(sqlite, config), 201);
    } catch (error) {
      console.error("Backup failed:", error);
      return c.json({ errors: ["backup_failed"] }, 500);
    }
  });

  return app;
}
