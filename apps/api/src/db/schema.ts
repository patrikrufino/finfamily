import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const people = sqliteTable("people", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull().unique(),
});

export const accounts = sqliteTable("accounts", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  type: text("type", { enum: ["checking", "savings", "wallet", "investment"] }).notNull(),
  initialBalanceCents: integer("initial_balance_cents").notNull().default(0),
  archived: integer("archived", { mode: "boolean" }).notNull().default(false),
});

export const transactions = sqliteTable("transactions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  kind: text("kind", { enum: ["income", "expense", "transfer"] }).notNull(),
  amountCents: integer("amount_cents").notNull(),
  date: text("date").notNull(),
  accountId: integer("account_id").notNull().references(() => accounts.id),
  toAccountId: integer("to_account_id").references(() => accounts.id),
  description: text("description").notNull().default(""),
  status: text("status", { enum: ["settled", "scheduled"] }).notNull().default("settled"),
  personId: integer("person_id").notNull().references(() => people.id),
});
