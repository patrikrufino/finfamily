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

export const installmentPlans = sqliteTable("installment_plans", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  description: text("description").notNull(),
  totalCents: integer("total_cents").notNull(),
  count: integer("count").notNull(),
  firstDate: text("first_date").notNull(),
  accountId: integer("account_id").references(() => accounts.id),
  cardId: integer("card_id").references(() => cards.id),
  categoryId: integer("category_id").references(() => categories.id),
  personId: integer("person_id").notNull().references(() => people.id),
});

export const debts = sqliteTable("debts", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  creditor: text("creditor").notNull(),
  originalCents: integer("original_cents").notNull(),
  openedOn: text("opened_on").notNull(),
  categoryId: integer("category_id").references(() => categories.id),
  personId: integer("person_id").notNull().references(() => people.id),
});

export const debtEntries = sqliteTable("debt_entries", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  debtId: integer("debt_id").notNull().references(() => debts.id),
  kind: text("kind", { enum: ["interest", "discount"] }).notNull(),
  amountCents: integer("amount_cents").notNull(),
  date: text("date").notNull(),
  note: text("note").notNull().default(""),
});

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
  adjustment: integer("adjustment", { mode: "boolean" }).notNull().default(false),
  planId: integer("plan_id").references(() => installmentPlans.id),
  installmentNumber: integer("installment_number"),
  debtId: integer("debt_id").references(() => debts.id),
  description: text("description").notNull().default(""),
  status: text("status", { enum: ["settled", "scheduled"] }).notNull().default("settled"),
  personId: integer("person_id").notNull().references(() => people.id),
});
