import { Money } from "./money";

export interface BudgetEntry {
  categoryId: number;
  /** First month (`YYYY-MM`) in which this amount applies. */
  fromMonth: string;
  amount: Money;
}

export type BudgetStatus = "none" | "ok" | "warning" | "over";

export const WARNING_RATIO = 0.8;

/** The budget amount that applies to a month: the latest entry that started on or before it. */
export function budgetForMonth(entries: readonly BudgetEntry[], categoryId: number, month: string): Money {
  const applicable = entries
    .filter((e) => e.categoryId === categoryId && e.fromMonth <= month)
    .sort((a, b) => b.fromMonth.localeCompare(a.fromMonth));
  return applicable[0]?.amount ?? Money.zero();
}

export interface BudgetProgress {
  budget: Money;
  spent: Money;
  committed: Money;
  remaining: Money;
  /** Budget left after also counting scheduled (committed) expenses. */
  availableAfterCommitted: Money;
  ratio: number;
  status: BudgetStatus;
}

export function budgetProgress(budget: Money, spent: Money, committed: Money = Money.zero()): BudgetProgress {
  const ratio = budget.cents > 0 ? spent.cents / budget.cents : 0;
  const status: BudgetStatus =
    budget.cents <= 0 ? "none" : ratio > 1 ? "over" : ratio >= WARNING_RATIO ? "warning" : "ok";
  return {
    budget,
    spent,
    committed,
    remaining: budget.subtract(spent),
    availableAfterCommitted: budget.subtract(spent).subtract(committed),
    ratio,
    status,
  };
}
