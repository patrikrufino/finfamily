import type {
  AccountType,
  BudgetStatus,
  CategoryKind,
  StatementStatus,
  TransactionKind,
  TransactionStatus,
} from "@finfamily/domain";

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
  /** Null for card purchases. */
  accountId: number | null;
  toAccountId: number | null;
  categoryId: number | null;
  cardId: number | null;
  statementMonth: string | null;
  feeKind: "interest" | "fine" | null;
  /** Balance adjustment: not spending or earning. */
  adjustment: boolean;
  /** Installment plan this belongs to; `installmentNumber` is null for an anticipation item. */
  planId: number | null;
  installmentNumber: number | null;
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

export interface StatementDto {
  cardId: number;
  month: string;
  start: string;
  end: string;
  dueDate: string;
  totalCents: number;
  paidCents: number;
  feesCents: number;
  remainingCents: number;
  status: StatementStatus;
  closingDay: number;
  dueDay: number;
  purchases: TransactionDto[];
  payments: TransactionDto[];
  fees: TransactionDto[];
}

export interface CardDto {
  id: number;
  name: string;
  archived: boolean;
  limitCents: number;
  usedCents: number;
  availableCents: number;
  closingDay: number;
  dueDay: number;
  openStatementMonth: string;
  openStatement: Omit<StatementDto, "purchases" | "payments" | "fees" | "closingDay" | "dueDay">;
}

export interface NewCard {
  name: string;
  limitCents: number;
  closingDay: number;
  dueDay: number;
}

export interface CycleRuleInput {
  fromMonth: string;
  closingDay: number;
  dueDay: number;
}

export interface StatementPaymentInput {
  accountId: number;
  amountCents: number;
  interestCents: number;
  fineCents: number;
  date: string;
  personId: number;
}

export interface PlanDto {
  id: number;
  description: string;
  totalCents: number;
  count: number;
  firstDate: string;
  accountId: number | null;
  cardId: number | null;
  categoryId: number | null;
  personId: number;
  paidCount: number;
  remainingCount: number;
  paidCents: number;
  remainingCents: number;
  nextDate: string | null;
  nextCents: number | null;
  status: "active" | "done";
}

export interface PlanInstallmentDto extends TransactionDto {
  anticipable: boolean;
}

export interface PlanDetailDto extends PlanDto {
  installments: PlanInstallmentDto[];
}

export interface NewPlan {
  description: string;
  totalCents: number;
  count: number;
  firstDate: string;
  accountId: number | null;
  cardId: number | null;
  categoryId: number | null;
  personId: number;
}

export interface AnticipationInput {
  installmentIds: number[];
  amountCents: number;
  date: string;
}

export type NewCategory = Pick<CategoryDto, "name" | "kind">;

type CardFields = "cardId" | "statementMonth" | "feeKind" | "adjustment" | "planId" | "installmentNumber";
/** Card-related fields default to null when omitted. */
export type NewTransaction = Omit<TransactionDto, "id" | CardFields> & Partial<Pick<TransactionDto, CardFields>>;
export type NewAccount = Pick<AccountDto, "name" | "type" | "initialBalanceCents">;

export interface TransactionFilter {
  month: string;
  accountId?: number;
  personId?: number;
  categoryId?: number;
  cardId?: number;
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
  updateAccount(id: number, patch: Partial<Pick<AccountDto, "name" | "archived" | "initialBalanceCents">>): Promise<AccountDto>;
  /** Records the difference to `targetBalanceCents` as an adjustment transaction. */
  adjustAccount(id: number, input: { targetBalanceCents: number; personId: number; date?: string }): Promise<TransactionDto>;
  listTransactions(filter: TransactionFilter): Promise<TransactionDto[]>;
  createTransaction(input: NewTransaction): Promise<TransactionDto>;
  updateTransaction(id: number, input: NewTransaction): Promise<TransactionDto>;
  deleteTransaction(id: number): Promise<void>;
  listCategories(): Promise<CategoryDto[]>;
  createCategory(input: NewCategory): Promise<CategoryDto>;
  updateCategory(id: number, patch: Partial<Pick<CategoryDto, "name" | "kind" | "archived">>): Promise<CategoryDto>;
  setBudget(categoryId: number, month: string, amountCents: number): Promise<void>;
  getBudget(month: string): Promise<BudgetReportDto>;
  listCards(): Promise<CardDto[]>;
  createCard(input: NewCard): Promise<CardDto>;
  updateCard(id: number, patch: Partial<Pick<CardDto, "name" | "limitCents" | "archived">>): Promise<CardDto>;
  setCardRule(cardId: number, rule: CycleRuleInput): Promise<void>;
  /** Without a month, returns the statement that is currently open. */
  getStatement(cardId: number, month?: string): Promise<StatementDto>;
  payStatement(cardId: number, month: string, input: StatementPaymentInput): Promise<StatementDto>;
  listPlans(): Promise<PlanDto[]>;
  getPlan(id: number): Promise<PlanDetailDto>;
  createPlan(input: NewPlan): Promise<PlanDetailDto>;
  anticipatePlan(id: number, input: AnticipationInput): Promise<PlanDetailDto>;
  cancelPlan(id: number): Promise<void>;
}
