import { Money, balanceAdjustment, type AccountType } from "@finfamily/domain";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiError, type AccountDto } from "../../data/types";
import { useRepository } from "../../data/RepositoryContext";
import { useLocale } from "../../shared/useLocale";
import { usePersonViewModel } from "../people/usePersonViewModel";

export interface AccountFormInput {
  name: string;
  type: AccountType;
  initialBalanceText: string;
}

export interface AccountEditInput {
  name: string;
  initialBalanceText: string;
}

export type AdjustmentPreview =
  | { kind: "income" | "expense"; amountCents: number }
  | { kind: "none" }
  | { kind: "invalid" };

export type CommandResult = { ok: true } | { ok: false; error: string };

export function useAccountsViewModel() {
  const repository = useRepository();
  const locale = useLocale();
  const queryClient = useQueryClient();
  const { person } = usePersonViewModel();
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["accounts"] });
  const refreshAll = () => {
    for (const key of ["accounts", "transactions", "budget"]) queryClient.invalidateQueries({ queryKey: [key] });
  };

  const query = useQuery({ queryKey: ["accounts"], queryFn: () => repository.listAccounts() });
  const create = useMutation({ mutationFn: repository.createAccount, onSuccess: refresh });
  const update = useMutation({
    mutationFn: ({ id, ...patch }: { id: number } & Partial<Pick<AccountDto, "name" | "archived" | "initialBalanceCents">>) =>
      repository.updateAccount(id, patch),
    onSuccess: refresh,
  });
  const adjust = useMutation({
    mutationFn: ({ id, targetBalanceCents, personId }: { id: number; targetBalanceCents: number; personId: number }) =>
      repository.adjustAccount(id, { targetBalanceCents, personId }),
    onSuccess: refreshAll,
  });
  const people = useQuery({ queryKey: ["people"], queryFn: () => repository.listPeople() }).data ?? [];

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

    /** Renames the account and/or corrects its initial balance (which changes the balance directly). */
    async updateAccount(id: number, input: AccountEditInput): Promise<CommandResult> {
      const name = input.name.trim();
      if (!name) return { ok: false, error: "name_required" };
      const initial = input.initialBalanceText.trim() === "" ? Money.zero() : Money.parse(input.initialBalanceText, locale);
      if (!initial) return { ok: false, error: "invalid_amount" };
      try {
        await update.mutateAsync({ id, name, initialBalanceCents: initial.cents });
        return { ok: true };
      } catch (e) {
        return { ok: false, error: e instanceof ApiError ? (e.codes[0] ?? "unknown") : "unknown" };
      }
    },

    /** What adjusting the account to `targetText` (the balance the bank shows) would record. */
    previewAdjustment(account: AccountDto, targetText: string): AdjustmentPreview {
      const target = Money.parse(targetText, locale);
      if (!target) return { kind: "invalid" };
      const adjustment = balanceAdjustment(Money.fromCents(account.balanceCents), target);
      return adjustment ? { kind: adjustment.kind, amountCents: adjustment.amount.cents } : { kind: "none" };
    },

    async adjustBalance(id: number, targetText: string): Promise<CommandResult> {
      const target = Money.parse(targetText, locale);
      if (!target) return { ok: false, error: "invalid_amount" };
      const personId = people.find((p) => p.name.toLowerCase() === person)?.id;
      if (personId === undefined) return { ok: false, error: "person_unknown" };
      try {
        await adjust.mutateAsync({ id, targetBalanceCents: target.cents, personId });
        return { ok: true };
      } catch (e) {
        return { ok: false, error: e instanceof ApiError ? (e.codes[0] ?? "unknown") : "unknown" };
      }
    },
  };
}
