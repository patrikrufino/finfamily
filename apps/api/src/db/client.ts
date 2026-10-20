import Database from "better-sqlite3";
import { drizzle, type BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { fileURLToPath } from "node:url";
import { people } from "./schema";
import * as schema from "./schema";

export type AppDatabase = BetterSQLite3Database<typeof schema> & { $client: Database.Database };

const MIGRATIONS_FOLDER = fileURLToPath(new URL("../../drizzle", import.meta.url));
const HOUSEHOLD_MEMBERS = ["Patrik", "Heloisa"];

export function createDatabase(path: string): AppDatabase {
  const sqlite = new Database(path);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  const db = drizzle(sqlite, { schema });
  migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });
  db.insert(people)
    .values(HOUSEHOLD_MEMBERS.map((name) => ({ name })))
    .onConflictDoNothing()
    .run();
  return db;
}
