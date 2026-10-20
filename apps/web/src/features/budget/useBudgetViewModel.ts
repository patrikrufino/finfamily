import { Money, type CategoryKind } from "@finfamily/domain";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useRepository } from "../../data/RepositoryContext";
import { ApiError } from "../../data/types";
import { useLocale } from "../../shared/useLocale";
import type { CommandResult } from "../accounts/useAccountsViewModel";
import { currentMonth, shiftMonth } from "../transactions/useTransactionsViewModel";

export function useBudgetViewModel(initialMonth: string = currentMonth()) {
  const repository = useRepository();
  const locale = useLocale();
  const queryClient = useQueryClient();
  const [month, setMonth] = useState(initialMonth);

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["budget"] });
    queryClient.invalidateQueries({ queryKey: ["categories"] });
  };

  const query = useQuery({ queryKey: ["budget", month], queryFn: () => repository.getBudget(month) });
  const setBudgetMutation = useMutation({
    mutationFn: ({ categoryId, cents }: { categoryId: number; cents: number }) =>
      repository.setBudget(categoryId, month, cents),
    onSuccess: refresh,
  });
  const createMutation = useMutation({ mutationFn: repository.createCategory, onSuccess: refresh });
  const updateMutation = useMutation({
    mutationFn: ({ id, archived }: { id: number; archived: boolean }) => repository.updateCategory(id, { archived }),
    onSuccess: refresh,
  });

  return {
    month,
    previousMonth: () => setMonth((m) => shiftMonth(m, -1)),
    nextMonth: () => setMonth((m) => shiftMonth(m, 1)),
    report: query.data,
    isLoading: query.isLoading,

    /** Sets the budget from `month` onward. Empty text removes it (amount zero). */
    async setBudget(categoryId: number, amountText: string): Promise<CommandResult> {
      const amount = amountText.trim() === "" ? Money.zero() : Money.parse(amountText, locale);
      if (!amount || amount.cents < 0) return { ok: false, error: "invalid_amount" };
      try {
        await setBudgetMutation.mutateAsync({ categoryId, cents: amount.cents });
        return { ok: true };
      } catch (e) {
        return { ok: false, error: e instanceof ApiError ? (e.codes[0] ?? "unknown") : "unknown" };
      }
    },

    async createCategory(input: { name: string; kind: CategoryKind }): Promise<CommandResult> {
      const name = input.name.trim();
      if (!name) return { ok: false, error: "name_required" };
      try {
        await createMutation.mutateAsync({ name, kind: input.kind });
        return { ok: true };
      } catch (e) {
        return { ok: false, error: e instanceof ApiError ? (e.codes[0] ?? "unknown") : "unknown" };
      }
    },

    archiveCategory: (id: number) => updateMutation.mutateAsync({ id, archived: true }).then(() => undefined),
  };
}
