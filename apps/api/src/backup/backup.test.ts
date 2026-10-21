import Database from "better-sqlite3";
import { existsSync, mkdtempSync, readdirSync, rmSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createDatabase } from "../db/client";
import { createBackup, listBackups, restoreBackup, verifyDatabase } from "./backup";

let dir: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "finfamily-backup-"));
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

const newDb = () => {
  const path = join(dir, "app.db");
  const db = createDatabase(path);
  db.$client.exec("insert into accounts (name, type) values ('Checking', 'checking')");
  return { path, db };
};
const names = (backupDir: string) => readdirSync(backupDir).filter((f) => f.endsWith(".db")).sort();

describe("createBackup", () => {
  it("writes a verified copy with the same data, named by timestamp", async () => {
    const { db } = newDb();
    const info = await createBackup(db.$client, { dir: join(dir, "backups"), keep: 5 }, new Date(2026, 9, 21, 8, 5, 9));
    expect(info.name).toBe("finfamily-20261021-080509.db");
    expect(info.sizeBytes).toBeGreaterThan(0);
    const copy = new Database(join(dir, "backups", info.name), { readonly: true });
    expect((copy.prepare("select name from accounts").get() as { name: string }).name).toBe("Checking");
    expect(copy.pragma("integrity_check", { simple: true })).toBe("ok");
    copy.close();
  });

  it("leaves a single self-contained file per backup, without WAL or partial leftovers", async () => {
    const { db } = newDb();
    const backups = join(dir, "backups");
    await createBackup(db.$client, { dir: backups, keep: 5 }, new Date(2026, 0, 1));
    await createBackup(db.$client, { dir: backups, keep: 5 }, new Date(2026, 0, 2));
    expect(readdirSync(backups).sort()).toEqual(["finfamily-20260101-000000.db", "finfamily-20260102-000000.db"]);
    // Opening a backup (e.g. to verify or restore it) must not create sidecar files either.
    verifyDatabase(join(backups, "finfamily-20260101-000000.db"));
    expect(readdirSync(backups)).toHaveLength(2);
  });

  it("keeps only the newest backups", async () => {
    const { db } = newDb();
    const backups = join(dir, "backups");
    for (let i = 1; i <= 5; i++) await createBackup(db.$client, { dir: backups, keep: 3 }, new Date(2026, 9, i, 10, 0, 0));
    expect(names(backups)).toEqual([
      "finfamily-20261003-100000.db", "finfamily-20261004-100000.db", "finfamily-20261005-100000.db",
    ]);
  });

  it("is safe while the database is being written to", async () => {
    const { db } = newDb();
    const writing = (async () => {
      for (let i = 0; i < 50; i++) db.$client.exec(`insert into categories (name) values ('c${i}')`);
    })();
    const info = await createBackup(db.$client, { dir: join(dir, "backups"), keep: 2 });
    await writing;
    expect(verifyDatabase(join(dir, "backups", info.name))).toBe(true);
  });

  it("never prunes files that are not backups", async () => {
    const { db } = newDb();
    const backups = join(dir, "backups");
    await createBackup(db.$client, { dir: backups, keep: 1 }, new Date(2026, 0, 1));
    writeFileSync(join(backups, "notes.txt"), "keep me");
    writeFileSync(join(backups, "other.db"), "not ours");
    await createBackup(db.$client, { dir: backups, keep: 1 }, new Date(2026, 0, 2));
    expect(existsSync(join(backups, "notes.txt"))).toBe(true);
    expect(existsSync(join(backups, "other.db"))).toBe(true);
    expect(names(backups).filter((n) => n.startsWith("finfamily-"))).toEqual(["finfamily-20260102-000000.db"]);
  });
});

describe("listBackups", () => {
  it("lists the newest first with size and date, and is empty without a directory", async () => {
    expect(listBackups(join(dir, "missing"))).toEqual([]);
    const { db } = newDb();
    const backups = join(dir, "backups");
    await createBackup(db.$client, { dir: backups, keep: 5 }, new Date(2026, 5, 1, 9, 0, 0));
    await createBackup(db.$client, { dir: backups, keep: 5 }, new Date(2026, 5, 2, 9, 0, 0));
    utimesSync(join(backups, "finfamily-20260601-090000.db"), new Date("2026-06-01T12:00:00Z"), new Date("2026-06-01T12:00:00Z"));
    const list = listBackups(backups);
    expect(list.map((b) => b.name)).toEqual(["finfamily-20260602-090000.db", "finfamily-20260601-090000.db"]);
    expect(list[0]).toMatchObject({ sizeBytes: expect.any(Number), createdAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/) });
  });
});

describe("verifyDatabase", () => {
  it("accepts a healthy database and rejects garbage or missing files", () => {
    const { path, db } = newDb();
    db.$client.close();
    expect(verifyDatabase(path)).toBe(true);
    const junk = join(dir, "junk.db");
    writeFileSync(junk, "this is not a sqlite database at all");
    expect(verifyDatabase(junk)).toBe(false);
    expect(verifyDatabase(join(dir, "nope.db"))).toBe(false);
  });
});

describe("restoreBackup", () => {
  it("keeps the current database aside and brings the backup data back", async () => {
    const { path, db } = newDb();
    const backups = join(dir, "backups");
    const info = await createBackup(db.$client, { dir: backups, keep: 5 });
    db.$client.exec("insert into accounts (name, type) values ('Savings', 'savings')");
    db.$client.close();

    const result = restoreBackup(join(backups, info.name), path, new Date(2026, 9, 21, 10, 0, 0));
    expect(result.previousSavedAs).toBe(`${path}.before-restore-20261021-100000`);
    expect(existsSync(result.previousSavedAs!)).toBe(true);

    const restored = new Database(path, { readonly: true });
    expect((restored.prepare("select count(*) as n from accounts").get() as { n: number }).n).toBe(1);
    restored.close();
    const aside = new Database(result.previousSavedAs!, { readonly: true });
    expect((aside.prepare("select count(*) as n from accounts").get() as { n: number }).n).toBe(2);
    aside.close();
  });

  it("refuses a backup that fails the integrity check and leaves the database untouched", () => {
    const { path, db } = newDb();
    db.$client.close();
    const junk = join(dir, "junk.db");
    writeFileSync(junk, "garbage");
    expect(() => restoreBackup(junk, path)).toThrow(/integrity/i);
    expect(verifyDatabase(path)).toBe(true);
  });

  it("works when there is no current database yet", async () => {
    const { db } = newDb();
    const info = await createBackup(db.$client, { dir: join(dir, "backups"), keep: 5 });
    const target = join(dir, "fresh.db");
    const result = restoreBackup(join(dir, "backups", info.name), target);
    expect(result.previousSavedAs).toBeNull();
    expect(verifyDatabase(target)).toBe(true);
  });
});
