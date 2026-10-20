import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { join } from "node:path";

const dbPath = process.env.DATABASE_PATH ?? "finfamily.db";
const backupDir = process.env.BACKUP_DIR ?? "backups";
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const target = join(backupDir, `finfamily-${stamp}.db`);

mkdirSync(backupDir, { recursive: true });
const db = new Database(dbPath, { readonly: true });
db.exec(`VACUUM INTO '${target.replace(/'/g, "''")}'`);
db.close();
console.log(`Backup written to ${target}`);
