import { Money } from "@finfamily/domain";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRepository } from "../../data/RepositoryContext";
import { ApiError } from "../../data/types";
import { useLocale } from "../../shared/useLocale";
import type { CommandResult } from "../accounts/useAccountsViewModel";

export interface CardFormInput {
  name: string;
  limitText: string;
  closingDay: string;
  dueDay: string;
}

/** Parses a day of month typed by the user; null when it is not an integer from 1 to 31. */
export function parseDay(text: string): number | null {
  if (!/^\d{1,2}$/.test(text.trim())) return null;
  const day = Number(text);
  return day >= 1 && day <= 31 ? day : null;
}

export const errorCode = (e: unknown) => (e instanceof ApiError ? (e.codes[0] ?? "unknown") : "unknown");

export function useCardsViewModel() {
  const repository = useRepository();
  const locale = useLocale();
  const queryClient = useQueryClient();
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["cards"] });

  const query = useQuery({ queryKey: ["cards"], queryFn: () => repository.listCards() });
  const create = useMutation({ mutationFn: repository.createCard, onSuccess: refresh });
  const update = useMutation({
    mutationFn: ({ id, archived }: { id: number; archived: boolean }) => repository.updateCard(id, { archived }),
    onSuccess: refresh,
  });

  return {
    cards: query.data ?? [],
    isLoading: query.isLoading,

    async createCard(input: CardFormInput): Promise<CommandResult> {
      const name = input.name.trim();
      if (!name) return { ok: false, error: "name_required" };
      const limit = input.limitText.trim() === "" ? Money.zero() : Money.parse(input.limitText, locale);
      if (!limit || limit.cents < 0) return { ok: false, error: "invalid_amount" };
      const closingDay = parseDay(input.closingDay);
      const dueDay = parseDay(input.dueDay);
      if (closingDay === null || dueDay === null) return { ok: false, error: "invalid_day" };
      try {
        await create.mutateAsync({ name, limitCents: limit.cents, closingDay, dueDay });
        return { ok: true };
      } catch (e) {
        return { ok: false, error: errorCode(e) };
      }
    },

    archiveCard: (id: number) => update.mutateAsync({ id, archived: true }).then(() => undefined),
  };
}
