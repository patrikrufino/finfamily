import { useQuery } from "@tanstack/react-query";
import { useRepository } from "../../data/RepositoryContext";

export function useDashboardViewModel() {
  const repository = useRepository();
  // Always refetched when the home screen mounts (default staleTime is 0), so it never shows stale totals.
  const query = useQuery({ queryKey: ["dashboard"], queryFn: () => repository.getDashboard() });
  const dashboard = query.data;

  const budgetCents = dashboard?.budget.totals.budgetCents ?? 0;
  const spentCents = dashboard?.budget.totals.spentCents ?? 0;

  return {
    dashboard,
    isLoading: query.isLoading,
    hasBudget: budgetCents > 0,
    /** Share of the total monthly budget already spent (can exceed 1). */
    budgetUsedRatio: budgetCents > 0 ? spentCents / budgetCents : 0,
    /** First forecast month whose projected end balance is below zero, if any. */
    firstNegativeMonth: dashboard?.forecast.find((m) => m.endBalanceCents < 0)?.month ?? null,
  };
}
