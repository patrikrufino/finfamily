import Database from "better-sqlite3";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const folder = fileURLToPath(new URL("../drizzle", import.meta.url));
const migrations = readdirSync(folder).filter((f) => f.endsWith(".sql")).sort();

function apply(db: Database.Database, file: string) {
  const sql = readFileSync(join(folder, file), "utf8");
  for (const statement of sql.split("--> statement-breakpoint")) db.exec(statement);
}

describe("migrations", () => {
  it("keep existing data when the credit card migration rebuilds the transactions table", () => {
    const db = new Database(":memory:");
    for (const file of migrations.filter((f) => f < "0003")) apply(db, file);

    db.exec(`
      insert into people (name) values ('Patrik');
      insert into accounts (name, type) values ('Checking', 'checking');
      insert into categories (name) values ('Food');
      insert into transactions (kind, amount_cents, date, account_id, category_id, description, status, person_id)
      values ('expense', 1234, '2026-10-05', 1, 1, 'Lunch', 'settled', 1);
    `);

    for (const file of migrations.filter((f) => f >= "0003")) apply(db, file);

    const row = db.prepare("select * from transactions").get() as Record<string, unknown>;
    expect(row).toMatchObject({
      amount_cents: 1234, date: "2026-10-05", account_id: 1, category_id: 1, description: "Lunch",
      card_id: null, statement_month: null, fee_kind: null,
    });
  });
});
