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

  it("split the old 'both' categories without losing or mixing anything", () => {
    const db = new Database(":memory:");
    for (const file of migrations.filter((f) => f < "0008")) apply(db, file);

    db.exec(`
      insert into people (name) values ('Patrik');
      insert into accounts (name, type) values ('Checking', 'checking');
      insert into categories (name, kind, archived) values ('Salary', 'both', 0);
      insert into categories (name, kind, archived) values ('Food', 'expense', 0);
      insert into categories (name, kind, archived) values ('Gifts', 'both', 0);
      insert into budgets (category_id, from_month, amount_cents) values (1, '2026-01', 50000);
      insert into transactions (kind, amount_cents, date, account_id, category_id, status, person_id) values
        ('income', 300000, '2026-10-05', 1, 1, 'settled', 1),
        ('expense', 1500, '2026-10-06', 1, 1, 'settled', 1),
        ('expense', 8000, '2026-10-07', 1, 2, 'settled', 1);
      insert into recurring_rules (kind, amount_cents, description, account_id, category_id, person_id, frequency, start_date)
        values ('income', 300000, 'Salary', 1, 1, 1, 'monthly', '2026-01-05');
    `);

    for (const file of migrations.filter((f) => f >= "0008")) apply(db, file);

    const categories = db.prepare("select id, name, kind from categories order by id").all();
    expect(categories).toEqual([
      { id: 1, name: "Salary", kind: "expense" },
      { id: 2, name: "Food", kind: "expense" },
      { id: 3, name: "Gifts", kind: "expense" }, // no income used it, so no income twin
      { id: 4, name: "Salary", kind: "income" },
    ]);
    const txs = db.prepare("select kind, category_id from transactions order by id").all();
    expect(txs).toEqual([
      { kind: "income", category_id: 4 },
      { kind: "expense", category_id: 1 },
      { kind: "expense", category_id: 2 },
    ]);
    expect(db.prepare("select category_id from recurring_rules").get()).toEqual({ category_id: 4 });
    expect(db.prepare("select category_id, amount_cents from budgets").get()).toEqual({ category_id: 1, amount_cents: 50000 });
    expect(db.prepare("select count(*) as n from categories where kind not in ('income', 'expense')").get()).toEqual({ n: 0 });
  });
});
