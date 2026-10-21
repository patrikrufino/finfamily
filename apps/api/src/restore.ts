import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { listBackups, restoreBackup } from "./backup/backup";
import { loadConfig } from "./config";

// CLI: `pnpm restore <backup-file>` (or `pnpm restore latest`). Stop the server first.
const config = loadConfig(process.env, dirname(fileURLToPath(import.meta.url)) + "/..");
const arg = process.argv[2];

if (!arg) {
  console.log("Usage: pnpm restore <backup-file | latest>\n\nAvailable backups:");
  for (const b of listBackups(config.backup.dir)) console.log(`  ${b.name}  ${b.createdAt}  ${b.sizeBytes} bytes`);
  process.exit(1);
}

const file = arg === "latest" ? resolve(config.backup.dir, listBackups(config.backup.dir)[0]?.name ?? "") : resolve(arg);
if (!existsSync(file)) {
  console.error(`Backup not found: ${file}`);
  process.exit(1);
}

const { previousSavedAs } = restoreBackup(file, config.databasePath);
console.log(`Restored ${file} into ${config.databasePath}.`);
if (previousSavedAs) console.log(`The previous database was kept as ${previousSavedAs}.`);
