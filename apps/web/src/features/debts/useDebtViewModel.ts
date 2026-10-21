import { Money, isValidIsoDate } from "@finfamily/domain";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRepository } from "../../data/RepositoryContext";
import type { LedgerLineDto } from "../../data/types";
import { useLocale } from "../../shared/useLocale";
import type { CommandResult } from "../accounts/useAccountsViewModel";
import { errorCode } from "../cards/useCardsViewModel";
import { usePersonViewModel } from "../people/usePersonViewModel";

export interface DebtEntryForm {
  amountText: string;
  date: string;
  note: string;
}

export interface DebtPaymentForm {
  accountId: number;
  amountText: string;
  date: string;
  categoryId: number | null;
}

export function useDebtViewModel(debtId: number) {
  const repository = useRepository();
  const locale = useLocale();
  const queryClient = useQueryClient();
  const { person } = usePersonViewModel();

  const query = useQuery({ queryKey: ["debt", debtId], queryFn: () => repository.getDebt(debtId) });
  const people = useQuery({ queryKey: ["people"], queryFn: () => repository.listPeople() }).data ?? [];

  const refresh = () => {
    for (const key of ["debt", "debts", "accounts", "transactions", "budget"]) {
      queryClient.invalidateQueries({ queryKey: [key] });
    }
  };
  const interest = useMutation({ mutationFn: (i: Parameters<typeof repository.addDebtInterest>[1]) => repository.addDebtInterest(debtId, i), onSuccess: refresh });
  const discount = useMutation({ mutationFn: (i: Parameters<typeof repository.addDebtDiscount>[1]) => repository.addDebtDiscount(debtId, i), onSuccess: refresh });
  const payment = useMutation({ mutationFn: (i: Parameters<typeof repository.payDebt>[1]) => repository.payDebt(debtId, i), onSuccess: refresh });
  const removeEntry = useMutation({ mutationFn: (entryId: number) => repository.removeDebtEntry(debtId, entryId), onSuccess: refresh });
  const removeTx = useMutation({ mutationFn: repository.deleteTransaction, onSuccess: refresh });
  const removeDebt = useMutation({ mutationFn: () => repository.deleteDebt(debtId), onSuccess: refresh });

  type Parsed = { ok: true; value: { amountCents: number; date: string; note: string } } | { ok: false; error: string };
  const parseEntry = (input: DebtEntryForm): Parsed => {
    const amount = Money.parse(input.amountText, locale);
    if (!amount || amount.cents <= 0) return { ok: false, error: "invalid_amount" };
    if (!isValidIsoDate(input.date)) return { ok: false, error: "invalid_date" };
    return { ok: true, value: { amountCents: amount.cents, date: input.date, note: input.note.trim() } };
  };

  async function run(action: () => Promise<unknown>): Promise<CommandResult> {
    try {
      await action();
      return { ok: true };
    } catch (e) {
      return { ok: false, error: errorCode(e) };
    }
  }

  return {
    debt: query.data,
    isLoading: query.isLoading,

    async addInterest(input: DebtEntryForm): Promise<CommandResult> {
      const parsed = parseEntry(input);
      if (!parsed.ok) return parsed;
      return run(() => interest.mutateAsync(parsed.value));
    },

    async addDiscount(input: DebtEntryForm): Promise<CommandResult> {
      const parsed = parseEntry(input);
      if (!parsed.ok) return parsed;
      return run(() => discount.mutateAsync(parsed.value));
    },

    /** A payment (baixa) is an expense on the chosen account, partial or total. */
    async pay(input: DebtPaymentForm): Promise<CommandResult> {
      const parsed = parseEntry({ amountText: input.amountText, date: input.date, note: "" });
      if (!parsed.ok) return parsed;
      const personId = people.find((p) => p.name.toLowerCase() === person)?.id;
      if (personId === undefined) return { ok: false, error: "person_unknown" };
      return run(() => payment.mutateAsync({
        accountId: input.accountId, amountCents: parsed.value.amountCents, date: parsed.value.date, personId, categoryId: input.categoryId,
      }));
    },

    /** Removes an interest/discount entry or a payment (which deletes its expense). */
    async removeLine(line: LedgerLineDto): Promise<CommandResult> {
      if (line.type === "opening") return { ok: false, error: "unknown" };
      return run(() => (line.type === "payment" ? removeTx.mutateAsync(line.id) : removeEntry.mutateAsync(line.id)));
    },

    deleteDebt: (): Promise<CommandResult> => run(() => removeDebt.mutateAsync()),
  };
}
