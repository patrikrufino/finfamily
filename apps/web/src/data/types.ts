import type { AccountType, BudgetStatus, CategoryKind, TransactionKind, TransactionStatus } from "@finfamily/domain";

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
  categoryId: number | null;
  description: string;
  status: TransactionStatus;
  personId: number;
}

export interface CategoryDto {
  id: number;
  name: string;
  kind: CategoryKind;
  archived: boolean;
}

export interface BudgetCategoryDto {
  categoryId: number;
  name: string;
  kind: CategoryKind;
  archived: boolean;
  budgetCents: number;
  spentCents: number;
  committedCents: number;
  remainingCents: number;
  availableAfterCommittedCents: number;
  ratio: number;
  status: BudgetStatus;
}

export interface BudgetReportDto {
  month: string;
  categories: BudgetCategoryDto[];
  uncategorized: { spentCents: number; committedCents: number };
  totals: { budgetCents: number; spentCents: number; remainingCents: number };
}

export type NewCategory = Pick<CategoryDto, "name" | "kind">;

export type NewTransaction = Omit<TransactionDto, "id">;
export type NewAccount = Pick<AccountDto, "name" | "type" | "initialBalanceCents">;

export interface TransactionFilter {
  month: string;
  accountId?: number;
  personId?: number;
  categoryId?: number;
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
  listCategories(): Promise<CategoryDto[]>;
  createCategory(input: NewCategory): Promise<CategoryDto>;
  updateCategory(id: number, patch: Partial<Pick<CategoryDto, "name" | "kind" | "archived">>): Promise<CategoryDto>;
  setBudget(categoryId: number, month: string, amountCents: number): Promise<void>;
  getBudget(month: string): Promise<BudgetReportDto>;
}
