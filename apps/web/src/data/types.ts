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
  /** Debt this expense pays off. */
  debtId: number | null;
  /** Recurring rule that posted this transaction. */
  recurringId: number | null;
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

export interface DebtDto {
  id: number;
  creditor: string;
  openedOn: string;
  categoryId: number | null;
  personId: number;
  originalCents: number;
  interestCents: number;
  discountCents: number;
  paidCents: number;
  balanceCents: number;
  status: "open" | "settled";
}

export interface LedgerLineDto {
  type: "opening" | "interest" | "discount" | "payment";
  /** Entry id for interest/discount, transaction id for payments, 0 for the opening. */
  id: number;
  date: string;
  amountCents: number;
  note: string;
  accountId: number | null;
  balanceAfterCents: number;
}

export interface DebtDetailDto extends DebtDto {
  ledger: LedgerLineDto[];
}

export interface NewDebt {
  creditor: string;
  originalCents: number;
  openedOn?: string;
  categoryId: number | null;
  personId: number;
}

export interface DebtEntryInput {
  amountCents: number;
  date: string;
  note: string;
}

export interface DebtPaymentInput {
  accountId: number;
  amountCents: number;
  date: string;
  personId: number;
  categoryId: number | null;
}

export type Frequency = "weekly" | "monthly" | "yearly";

export interface RecurringDto {
  id: number;
  kind: "income" | "expense";
  amountCents: number;
  description: string;
  accountId: number | null;
  cardId: number | null;
  categoryId: number | null;
  personId: number;
  frequency: Frequency;
  startDate: string;
  endDate: string | null;
  active: boolean;
  nextDate: string;
  postedCount: number;
  status: "active" | "paused" | "ended";
}

export interface NewRecurring {
  kind: "income" | "expense";
  amountCents: number;
  description: string;
  accountId: number | null;
  cardId: number | null;
  categoryId: number | null;
  personId: number;
  frequency: Frequency;
  startDate: string;
  endDate: string | null;
}

export interface ForecastMonthDto {
  month: string;
  incomeCents: number;
  expenseCents: number;
  cardPaymentsCents: number;
  netCents: number;
  endBalanceCents: number;
}

export interface DashboardDto {
  today: string;
  month: string;
  balanceCents: number;
  projectedEndOfMonthCents: number;
  monthSummary: { incomeCents: number; expenseCents: number; resultCents: number };
  budget: {
    totals: { budgetCents: number; spentCents: number; remainingCents: number };
    highlights: {
      categoryId: number;
      name: string;
      status: BudgetStatus;
      ratio: number;
      budgetCents: number;
      spentCents: number;
      remainingCents: number;
    }[];
  };
  cardsDue: {
    cardId: number;
    name: string;
    month: string;
    dueDate: string;
    remainingCents: number;
    status: StatementStatus;
    overdue: boolean;
  }[];
  debts: { totalOwedCents: number; openCount: number };
  installments: { committedThisMonthCents: number; activePlans: number };
  forecast: ForecastMonthDto[];
}

export interface BackupInfoDto {
  name: string;
  sizeBytes: number;
  createdAt: string;
}

export interface BackupStatusDto {
  backups: BackupInfoDto[];
  lastBackupAt: string | null;
  schedule: { intervalHours: number; keep: number };
}

export type NewCategory = Pick<CategoryDto, "name" | "kind">;

type CardFields = "cardId" | "statementMonth" | "feeKind" | "adjustment" | "planId" | "installmentNumber" | "debtId" | "recurringId";
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
  /** Null when the server runs without backups configured. */
  getBackupStatus(): Promise<BackupStatusDto | null>;
  createBackup(): Promise<BackupInfoDto>;
  getDashboard(): Promise<DashboardDto>;
  listRecurring(): Promise<RecurringDto[]>;
  createRecurring(input: NewRecurring): Promise<RecurringDto>;
  updateRecurring(
    id: number,
    patch: Partial<Pick<RecurringDto, "amountCents" | "description" | "categoryId" | "endDate" | "active">>,
  ): Promise<RecurringDto>;
  deleteRecurring(id: number): Promise<void>;
  listDebts(): Promise<DebtDto[]>;
  getDebt(id: number): Promise<DebtDetailDto>;
  createDebt(input: NewDebt): Promise<DebtDetailDto>;
  addDebtInterest(id: number, input: DebtEntryInput): Promise<DebtDetailDto>;
  addDebtDiscount(id: number, input: DebtEntryInput): Promise<DebtDetailDto>;
  payDebt(id: number, input: DebtPaymentInput): Promise<DebtDetailDto>;
  /** Removes an interest or discount entry. */
  removeDebtEntry(debtId: number, entryId: number): Promise<void>;
  deleteDebt(id: number): Promise<void>;
  listPlans(): Promise<PlanDto[]>;
  getPlan(id: number): Promise<PlanDetailDto>;
  createPlan(input: NewPlan): Promise<PlanDetailDto>;
  anticipatePlan(id: number, input: AnticipationInput): Promise<PlanDetailDto>;
  cancelPlan(id: number): Promise<void>;
}
