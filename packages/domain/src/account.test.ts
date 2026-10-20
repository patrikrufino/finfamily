import { describe, expect, it } from "vitest";
import { Money } from "./money";
import { accountBalance, type Account } from "./account";
import type { Transaction } from "./transaction";

const checking: Account = { id: 1, name: "Checking", type: "checking", initialBalance: Money.fromCents(100000), archived: false };
const savings: Account = { id: 2, name: "Savings", type: "savings", initialBalance: Money.zero(), archived: false };

let nextId = 1;
const tx = (over: Partial<Transaction>): Transaction => ({
  id: nextId++,
  kind: "expense",
  amount: Money.fromCents(1000),
  date: "2026-10-01",
  accountId: 1,
  toAccountId: null,
  categoryId: null,
  description: "",
  status: "settled",
  personId: 1,
  ...over,
});

describe("accountBalance", () => {
  it("sums income and expenses on top of the initial balance", () => {
    const txs = [
      tx({ kind: "income", amount: Money.fromCents(50000) }),
      tx({ kind: "expense", amount: Money.fromCents(20000) }),
    ];
    expect(accountBalance(checking, txs).cents).toBe(130000);
  });

  it("ignores scheduled transactions unless projected", () => {
    const txs = [tx({ status: "scheduled", amount: Money.fromCents(10000) })];
    expect(accountBalance(checking, txs).cents).toBe(100000);
    expect(accountBalance(checking, txs, { includeScheduled: true }).cents).toBe(90000);
  });

  it("moves money out of the source and into the destination on transfers", () => {
    const txs = [tx({ kind: "transfer", amount: Money.fromCents(30000), toAccountId: 2 })];
    expect(accountBalance(checking, txs).cents).toBe(70000);
    expect(accountBalance(savings, txs).cents).toBe(30000);
  });

  it("ignores transactions from other accounts", () => {
    const txs = [tx({ accountId: 99, amount: Money.fromCents(5000) })];
    expect(accountBalance(checking, txs).cents).toBe(100000);
  });
});
