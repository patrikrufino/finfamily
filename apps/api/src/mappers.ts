import { Money, type Account, type Transaction } from "@finfamily/domain";
import type { accounts, transactions } from "./db/schema";

type AccountRow = typeof accounts.$inferSelect;
type TransactionRow = typeof transactions.$inferSelect;

export const toDomainAccount = (row: AccountRow): Account => ({
  id: row.id,
  name: row.name,
  type: row.type,
  initialBalance: Money.fromCents(row.initialBalanceCents),
  archived: row.archived,
});

export const toDomainTransaction = (row: TransactionRow): Transaction => ({
  id: row.id,
  kind: row.kind,
  amount: Money.fromCents(row.amountCents),
  date: row.date,
  accountId: row.accountId,
  toAccountId: row.toAccountId,
  description: row.description,
  status: row.status,
  personId: row.personId,
});

export const transactionDto = (row: TransactionRow) => ({
  id: row.id,
  kind: row.kind,
  amountCents: row.amountCents,
  date: row.date,
  accountId: row.accountId,
  toAccountId: row.toAccountId,
  description: row.description,
  status: row.status,
  personId: row.personId,
});
