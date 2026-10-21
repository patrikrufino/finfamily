import { Money, isValidIsoDate } from "@finfamily/domain";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRepository } from "../../data/RepositoryContext";
import { useLocale } from "../../shared/useLocale";
import type { CommandResult } from "../accounts/useAccountsViewModel";
import { errorCode } from "../cards/useCardsViewModel";
import { usePersonViewModel } from "../people/usePersonViewModel";

export interface DebtFormInput {
  creditor: string;
  originalText: string;
  openedOn: string;
  categoryId: number | null;
}

export function useDebtsViewModel() {
  const repository = useRepository();
  const locale = useLocale();
  const queryClient = useQueryClient();
  const { person } = usePersonViewModel();

  const query = useQuery({ queryKey: ["debts"], queryFn: () => repository.listDebts() });
  const people = useQuery({ queryKey: ["people"], queryFn: () => repository.listPeople() }).data ?? [];
  const create = useMutation({
    mutationFn: repository.createDebt,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["debts"] }),
  });

  const debts = query.data ?? [];

  return {
    debts,
    isLoading: query.isLoading,
    /** Sum of what is still owed across open debts. */
    totalOwedCents: debts.filter((d) => d.status === "open").reduce((s, d) => s + d.balanceCents, 0),

    async createDebt(input: DebtFormInput): Promise<CommandResult> {
      const creditor = input.creditor.trim();
      if (!creditor) return { ok: false, error: "name_required" };
      const original = Money.parse(input.originalText, locale);
      if (!original || original.cents <= 0) return { ok: false, error: "invalid_amount" };
      if (!isValidIsoDate(input.openedOn)) return { ok: false, error: "invalid_date" };
      const personId = people.find((p) => p.name.toLowerCase() === person)?.id;
      if (personId === undefined) return { ok: false, error: "person_unknown" };
      try {
        await create.mutateAsync({ creditor, originalCents: original.cents, openedOn: input.openedOn, categoryId: input.categoryId, personId });
        return { ok: true };
      } catch (e) {
        return { ok: false, error: errorCode(e) };
      }
    },
  };
}
