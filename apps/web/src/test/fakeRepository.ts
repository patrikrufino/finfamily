import { accountBalance, Money, type Account, type Transaction } from "@finfamily/domain";
import {
  ApiError,
  type AccountDto,
  type FinanceRepository,
  type NewAccount,
  type NewTransaction,
  type TransactionDto,
} from "../data/types";

/** In-memory repository mirroring the API behaviour, for ViewModel and component tests. */
export function createFakeRepository(seed: { accounts?: NewAccount[]; transactions?: NewTransaction[] } = {}) {
  const people = [
    { id: 1, name: "Patrik" },
    { id: 2, name: "Heloisa" },
  ];
  let accounts: (NewAccount & { id: number; archived: boolean })[] = [];
  let transactions: TransactionDto[] = [];
  let nextAccountId = 1;
  let nextTransactionId = 1;

  const toAccountDto = (a: (typeof accounts)[number]): AccountDto => {
    const domain: Account = { ...a, initialBalance: Money.fromCents(a.initialBalanceCents) };
    const txs: Transaction[] = transactions.map((t) => ({ ...t, amount: Money.fromCents(t.amountCents) }));
    return {
      ...a,
      balanceCents: accountBalance(domain, txs).cents,
      projectedBalanceCents: accountBalance(domain, txs, { includeScheduled: true }).cents,
    };
  };

  const repo: FinanceRepository & { calls: string[] } = {
    calls: [],
    listPeople: async () => people,
    listAccounts: async () => accounts.filter((a) => !a.archived).map(toAccountDto),
    createAccount: async (input) => {
      repo.calls.push("createAccount");
      if (accounts.some((a) => !a.archived && a.name === input.name)) throw new ApiError(409, ["account_name_taken"]);
      const account = { ...input, id: nextAccountId++, archived: false };
      accounts.push(account);
      return toAccountDto(account);
    },
    updateAccount: async (id, patch) => {
      accounts = accounts.map((a) => (a.id === id ? { ...a, ...patch } : a));
      return toAccountDto(accounts.find((a) => a.id === id)!);
    },
    listTransactions: async ({ month, accountId, personId }) =>
      transactions
        .filter((t) => t.date.startsWith(`${month}-`))
        .filter((t) => !accountId || t.accountId === accountId || t.toAccountId === accountId)
        .filter((t) => !personId || t.personId === personId)
        .sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id),
    createTransaction: async (input) => {
      repo.calls.push("createTransaction");
      const created = { ...input, id: nextTransactionId++ };
      transactions.push(created);
      return created;
    },
    updateTransaction: async (id, input) => {
      repo.calls.push("updateTransaction");
      transactions = transactions.map((t) => (t.id === id ? { ...input, id } : t));
      return transactions.find((t) => t.id === id)!;
    },
    deleteTransaction: async (id) => {
      repo.calls.push("deleteTransaction");
      transactions = transactions.filter((t) => t.id !== id);
    },
  };

  seed.accounts?.forEach((a) => {
    const account = { ...a, id: nextAccountId++, archived: false };
    accounts.push(account);
  });
  seed.transactions?.forEach((t) => transactions.push({ ...t, id: nextTransactionId++ }));
  return repo;
}
