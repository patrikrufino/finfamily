import Database from "better-sqlite3";
import { copyFileSync, existsSync, mkdirSync, readdirSync, renameSync, rmSync, statSync } from "node:fs";
import { join } from "node:path";

export interface BackupConfig {
  dir: string;
  /** How many of the newest backups to keep. */
  keep: number;
  /** Hours between automatic backups; 0 turns the schedule off. */
  intervalHours: number;
}

export interface BackupInfo {
  name: string;
  sizeBytes: number;
  /** Modification time of the file, ISO 8601. */
  createdAt: string;
}

const BACKUP_PATTERN = /^finfamily-\d{8}-\d{6}\.db$/;

const pad = (n: number) => String(n).padStart(2, "0");
/** `YYYYMMDD-HHmmss` in local time, so file names match the clock of the machine at home. */
export function timestamp(now: Date): string {
  return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
}

/** True when the file is a SQLite database that passes `PRAGMA integrity_check`. */
export function verifyDatabase(path: string): boolean {
  try {
    const db = new Database(path, { readonly: true, fileMustExist: true });
    try {
      db.prepare("select count(*) from sqlite_master").get();
      return db.pragma("integrity_check", { simple: true }) === "ok";
    } finally {
      db.close();
    }
  } catch {
    return false;
  }
}

const toInfo = (dir: string, name: string): BackupInfo => {
  const stat = statSync(join(dir, name));
  return { name, sizeBytes: stat.size, createdAt: stat.mtime.toISOString() };
};

/** Backups in `dir`, newest first. Files that are not FinFamily backups are ignored. */
export function listBackups(dir: string): BackupInfo[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((name) => BACKUP_PATTERN.test(name))
    .sort()
    .reverse()
    .map((name) => toInfo(dir, name));
}

/**
 * Online backup (safe while the app is in use). The copy is written aside, verified, and only then moved into place;
 * a copy that fails verification is deleted. Older backups beyond `keep` are pruned.
 */
export async function createBackup(
  sqlite: Database.Database,
  { dir, keep }: Pick<BackupConfig, "dir" | "keep">,
  now: Date = new Date(),
): Promise<BackupInfo> {
  mkdirSync(dir, { recursive: true });
  const name = `finfamily-${timestamp(now)}.db`;
  const partial = join(dir, `${name}.partial`);
  try {
    await sqlite.backup(partial);
    // The copy inherits WAL mode; switch it to a plain journal so the backup is one self-contained file.
    const copy = new Database(partial);
    try {
      copy.pragma("journal_mode = DELETE");
    } finally {
      copy.close();
    }
    if (!verifyDatabase(partial)) throw new Error("The backup failed the integrity check and was discarded");
    renameSync(partial, join(dir, name));
  } finally {
    for (const suffix of ["", "-wal", "-shm", "-journal"]) rmSync(partial + suffix, { force: true });
  }
  for (const old of listBackups(dir).slice(Math.max(keep, 1))) rmSync(join(dir, old.name), { force: true });
  return toInfo(dir, name);
}

/**
 * Replaces the database file with a backup. The current database (and any WAL files) is saved next to it as
 * `<db>.before-restore-<timestamp>` first. The server must not be running.
 */
export function restoreBackup(backupFile: string, dbPath: string, now: Date = new Date()): { previousSavedAs: string | null } {
  if (!verifyDatabase(backupFile)) throw new Error("The backup file failed the integrity check; nothing was changed");

  let previousSavedAs: string | null = null;
  if (existsSync(dbPath)) {
    previousSavedAs = `${dbPath}.before-restore-${timestamp(now)}`;
    copyFileSync(dbPath, previousSavedAs);
    for (const suffix of ["-wal", "-shm"]) {
      if (existsSync(dbPath + suffix)) copyFileSync(dbPath + suffix, previousSavedAs + suffix);
    }
  }
  // A stale WAL next to the restored file would be replayed over it, so the sidecar files must go too.
  for (const suffix of ["", "-wal", "-shm"]) rmSync(dbPath + suffix, { force: true });
  copyFileSync(backupFile, dbPath);
  return { previousSavedAs };
}

/** Makes a backup on start (unless a recent one exists) and then every `intervalHours`. Returns a function that stops the schedule. */
export function startBackupSchedule(
  sqlite: Database.Database,
  config: BackupConfig,
  log: Pick<Console, "log" | "error"> = console,
): () => void {
  if (config.intervalHours <= 0) return () => undefined;
  const intervalMs = config.intervalHours * 3_600_000;

  const run = () =>
    createBackup(sqlite, config)
      .then((info) => log.log(`Backup created: ${info.name}`))
      .catch((error: unknown) => log.error("Backup failed:", error));

  const latest = listBackups(config.dir)[0];
  if (!latest || Date.now() - Date.parse(latest.createdAt) >= intervalMs) void run();
  const timer = setInterval(() => void run(), intervalMs);
  timer.unref();
  return () => clearInterval(timer);
}
