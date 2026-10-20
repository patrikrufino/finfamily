import { Money } from "./money";
import type { Transaction } from "./transaction";

export const ACCOUNT_TYPES = ["checking", "savings", "wallet", "investment"] as const;
export type AccountType = (typeof ACCOUNT_TYPES)[number];

export interface Account {
  id: number;
  name: string;
  type: AccountType;
  initialBalance: Money;
  archived: boolean;
}

export interface BalanceOptions {
  /** Also count scheduled transactions (projected balance). */
  includeScheduled?: boolean;
}

export function accountBalance(
  account: Account,
  transactions: readonly Transaction[],
  { includeScheduled = false }: BalanceOptions = {},
): Money {
  return transactions.reduce((balance, t) => {
    if (t.status === "scheduled" && !includeScheduled) return balance;
    if (t.accountId === account.id) {
      return t.kind === "income" ? balance.add(t.amount) : balance.subtract(t.amount);
    }
    if (t.kind === "transfer" && t.toAccountId === account.id) return balance.add(t.amount);
    return balance;
  }, account.initialBalance);
}
