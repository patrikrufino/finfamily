import { Money, type AccountType } from "@finfamily/domain";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiError } from "../../data/types";
import { useRepository } from "../../data/RepositoryContext";
import { useLocale } from "../../shared/useLocale";

export interface AccountFormInput {
  name: string;
  type: AccountType;
  initialBalanceText: string;
}

export type CommandResult = { ok: true } | { ok: false; error: string };

export function useAccountsViewModel() {
  const repository = useRepository();
  const locale = useLocale();
  const queryClient = useQueryClient();
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["accounts"] });

  const query = useQuery({ queryKey: ["accounts"], queryFn: () => repository.listAccounts() });
  const create = useMutation({ mutationFn: repository.createAccount, onSuccess: refresh });
  const update = useMutation({
    mutationFn: ({ id, archived }: { id: number; archived: boolean }) => repository.updateAccount(id, { archived }),
    onSuccess: refresh,
  });

  const accounts = query.data ?? [];

  return {
    accounts,
    isLoading: query.isLoading,
    totalBalanceCents: accounts.reduce((sum, a) => sum + a.balanceCents, 0),
    totalProjectedCents: accounts.reduce((sum, a) => sum + a.projectedBalanceCents, 0),

    async createAccount(input: AccountFormInput): Promise<CommandResult> {
      const name = input.name.trim();
      if (!name) return { ok: false, error: "name_required" };
      const initial = input.initialBalanceText.trim() === "" ? Money.zero() : Money.parse(input.initialBalanceText, locale);
      if (!initial) return { ok: false, error: "invalid_amount" };
      try {
        await create.mutateAsync({ name, type: input.type, initialBalanceCents: initial.cents });
        return { ok: true };
      } catch (e) {
        return { ok: false, error: e instanceof ApiError ? (e.codes[0] ?? "unknown") : "unknown" };
      }
    },

    archiveAccount: (id: number) => update.mutateAsync({ id, archived: true }).then(() => undefined),
  };
}
