import { Money, isValidIsoDate } from "@finfamily/domain";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRepository } from "../../data/RepositoryContext";
import type { PlanInstallmentDto } from "../../data/types";
import { useLocale } from "../../shared/useLocale";
import type { CommandResult } from "../accounts/useAccountsViewModel";
import { errorCode } from "../cards/useCardsViewModel";

export interface InstallmentEditInput {
  amountText: string;
  date: string;
}

export interface AnticipationFormInput {
  installmentIds: number[];
  amountText: string;
  date: string;
}

export function usePlanViewModel(planId: number) {
  const repository = useRepository();
  const locale = useLocale();
  const queryClient = useQueryClient();

  const query = useQuery({ queryKey: ["plan", planId], queryFn: () => repository.getPlan(planId) });
  const plan = query.data;

  const refresh = () => {
    for (const key of ["plan", "plans", "accounts", "transactions", "budget", "cards", "statement"]) {
      queryClient.invalidateQueries({ queryKey: [key] });
    }
  };
  const edit = useMutation({
    mutationFn: ({ tx, amountCents, date }: { tx: PlanInstallmentDto; amountCents: number; date: string }) =>
      repository.updateTransaction(tx.id, {
        kind: tx.kind, amountCents, date, accountId: tx.accountId, cardId: tx.cardId, toAccountId: tx.toAccountId,
        categoryId: tx.categoryId, description: tx.description, status: tx.status, personId: tx.personId,
      }),
    onSuccess: refresh,
  });
  const anticipateMutation = useMutation({
    mutationFn: (input: Parameters<typeof repository.anticipatePlan>[1]) => repository.anticipatePlan(planId, input),
    onSuccess: refresh,
  });
  const cancelMutation = useMutation({ mutationFn: () => repository.cancelPlan(planId), onSuccess: refresh });

  const anticipable = (plan?.installments ?? []).filter((i) => i.anticipable);

  return {
    plan,
    isLoading: query.isLoading,
    /** Installments that can still be paid ahead of time. */
    anticipable,

    async editInstallment(tx: PlanInstallmentDto, input: InstallmentEditInput): Promise<CommandResult> {
      const amount = Money.parse(input.amountText, locale);
      if (!amount || amount.cents <= 0) return { ok: false, error: "invalid_amount" };
      if (!isValidIsoDate(input.date)) return { ok: false, error: "invalid_date" };
      try {
        await edit.mutateAsync({ tx, amountCents: amount.cents, date: input.date });
        return { ok: true };
      } catch (e) {
        return { ok: false, error: errorCode(e) };
      }
    },

    /** Sum of the picked installments, what is actually paid and the discount; `null` while the amount is not valid. */
    anticipationSummary(installmentIds: number[], amountText: string) {
      const nominalCents = anticipable.filter((i) => installmentIds.includes(i.id)).reduce((s, i) => s + i.amountCents, 0);
      const paid = Money.parse(amountText, locale);
      return {
        nominalCents,
        paidCents: paid ? paid.cents : null,
        savingCents: paid ? nominalCents - paid.cents : null,
      };
    },

    async anticipate(input: AnticipationFormInput): Promise<CommandResult> {
      if (input.installmentIds.length === 0) return { ok: false, error: "nothing_to_anticipate" };
      const amount = Money.parse(input.amountText, locale);
      if (!amount || amount.cents <= 0) return { ok: false, error: "invalid_amount" };
      if (!isValidIsoDate(input.date)) return { ok: false, error: "invalid_date" };
      try {
        await anticipateMutation.mutateAsync({ installmentIds: input.installmentIds, amountCents: amount.cents, date: input.date });
        return { ok: true };
      } catch (e) {
        return { ok: false, error: errorCode(e) };
      }
    },

    cancel: () => cancelMutation.mutateAsync().then(() => undefined),
  };
}
