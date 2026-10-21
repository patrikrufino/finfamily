import Database from "better-sqlite3";
import { createBackup } from "./backup/backup";
import { loadConfig } from "./config";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

// CLI: `pnpm backup` makes a verified backup of the database and prunes old ones.
const config = loadConfig(process.env, dirname(fileURLToPath(import.meta.url)) + "/..");
const db = new Database(config.databasePath, { fileMustExist: true });
try {
  const info = await createBackup(db, config.backup);
  console.log(`Backup written to ${config.backup.dir}/${info.name} (${info.sizeBytes} bytes)`);
} finally {
  db.close();
}
