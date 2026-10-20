import type { AccountType, TransactionKind, TransactionStatus } from "@finfamily/domain";

export interface PersonDto {
  id: number;
  name: string;
}

export interface AccountDto {
  id: number;
  name: string;
  type: AccountType;
  initialBalanceCents: number;
  archived: boolean;
  balanceCents: number;
  projectedBalanceCents: number;
}

export interface TransactionDto {
  id: number;
  kind: TransactionKind;
  amountCents: number;
  date: string;
  accountId: number;
  toAccountId: number | null;
  description: string;
  status: TransactionStatus;
  personId: number;
}

export type NewTransaction = Omit<TransactionDto, "id">;
export type NewAccount = Pick<AccountDto, "name" | "type" | "initialBalanceCents">;

export interface TransactionFilter {
  month: string;
  accountId?: number;
  personId?: number;
}

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly codes: string[],
  ) {
    super(codes.join(", ") || `HTTP ${status}`);
  }
}

/** The Model boundary: ViewModels only talk to this interface. */
export interface FinanceRepository {
  listPeople(): Promise<PersonDto[]>;
  listAccounts(): Promise<AccountDto[]>;
  createAccount(input: NewAccount): Promise<AccountDto>;
  updateAccount(id: number, patch: Partial<Pick<AccountDto, "name" | "archived">>): Promise<AccountDto>;
  listTransactions(filter: TransactionFilter): Promise<TransactionDto[]>;
  createTransaction(input: NewTransaction): Promise<TransactionDto>;
  updateTransaction(id: number, input: NewTransaction): Promise<TransactionDto>;
  deleteTransaction(id: number): Promise<void>;
}
