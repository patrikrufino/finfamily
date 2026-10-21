import { integer, sqliteTable, text, unique } from "drizzle-orm/sqlite-core";

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

export const categories = sqliteTable("categories", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  kind: text("kind", { enum: ["expense", "both"] }).notNull().default("expense"),
  archived: integer("archived", { mode: "boolean" }).notNull().default(false),
});

export const budgets = sqliteTable(
  "budgets",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    categoryId: integer("category_id").notNull().references(() => categories.id),
    fromMonth: text("from_month").notNull(),
    amountCents: integer("amount_cents").notNull(),
  },
  (t) => [unique().on(t.categoryId, t.fromMonth)],
);

export const cards = sqliteTable("cards", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  limitCents: integer("limit_cents").notNull().default(0),
  archived: integer("archived", { mode: "boolean" }).notNull().default(false),
});

export const cardCycleRules = sqliteTable(
  "card_cycle_rules",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    cardId: integer("card_id").notNull().references(() => cards.id),
    fromMonth: text("from_month").notNull(),
    closingDay: integer("closing_day").notNull(),
    dueDay: integer("due_day").notNull(),
  },
  (t) => [unique().on(t.cardId, t.fromMonth)],
);

export const transactions = sqliteTable("transactions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  kind: text("kind", { enum: ["income", "expense", "transfer"] }).notNull(),
  amountCents: integer("amount_cents").notNull(),
  date: text("date").notNull(),
  accountId: integer("account_id").references(() => accounts.id),
  toAccountId: integer("to_account_id").references(() => accounts.id),
  categoryId: integer("category_id").references(() => categories.id),
  cardId: integer("card_id").references(() => cards.id),
  statementMonth: text("statement_month"),
  feeKind: text("fee_kind", { enum: ["interest", "fine"] }),
  description: text("description").notNull().default(""),
  status: text("status", { enum: ["settled", "scheduled"] }).notNull().default("settled"),
  personId: integer("person_id").notNull().references(() => people.id),
});
