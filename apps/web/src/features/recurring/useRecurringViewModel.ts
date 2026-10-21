import { Money, isValidIsoDate } from "@finfamily/domain";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRepository } from "../../data/RepositoryContext";
import { useLocale } from "../../shared/useLocale";
import type { CommandResult } from "../accounts/useAccountsViewModel";
import { errorCode } from "../cards/useCardsViewModel";

export interface RuleEditInput {
  amountText: string;
  description: string;
  /** Empty means the rule has no end. */
  endDate: string;
}

export function useRecurringViewModel() {
  const repository = useRepository();
  const locale = useLocale();
  const queryClient = useQueryClient();

  const query = useQuery({ queryKey: ["recurring"], queryFn: () => repository.listRecurring() });
  const refresh = () => {
    for (const key of ["recurring", "transactions", "accounts", "budget", "cards", "dashboard"]) {
      queryClient.invalidateQueries({ queryKey: [key] });
    }
  };
  const update = useMutation({
    mutationFn: ({ id, patch }: { id: number; patch: Parameters<typeof repository.updateRecurring>[1] }) =>
      repository.updateRecurring(id, patch),
    onSuccess: refresh,
  });
  const remove = useMutation({ mutationFn: repository.deleteRecurring, onSuccess: refresh });

  async function run(action: () => Promise<unknown>): Promise<CommandResult> {
    try {
      await action();
      return { ok: true };
    } catch (e) {
      return { ok: false, error: errorCode(e) };
    }
  }

  return {
    rules: query.data ?? [],
    isLoading: query.isLoading,

    /** Pausing stops posting; resuming continues from the next occurrence (nothing is backfilled). */
    setActive: (id: number, active: boolean) => update.mutateAsync({ id, patch: { active } }).then(() => undefined),

    /** Changes apply to future occurrences only; what was already posted stays as it is. */
    async editRule(id: number, input: RuleEditInput): Promise<CommandResult> {
      const amount = Money.parse(input.amountText, locale);
      if (!amount || amount.cents <= 0) return { ok: false, error: "invalid_amount" };
      const endDate = input.endDate.trim() === "" ? null : input.endDate;
      if (endDate !== null && !isValidIsoDate(endDate)) return { ok: false, error: "invalid_date" };
      return run(() => update.mutateAsync({ id, patch: { amountCents: amount.cents, description: input.description.trim(), endDate } }));
    },

    deleteRule: (id: number): Promise<CommandResult> => run(() => remove.mutateAsync(id)),
  };
}
