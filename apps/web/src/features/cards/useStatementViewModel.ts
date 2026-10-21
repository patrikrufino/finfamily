import { Money, addMonths } from "@finfamily/domain";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useRepository } from "../../data/RepositoryContext";
import { useLocale } from "../../shared/useLocale";
import type { CommandResult } from "../accounts/useAccountsViewModel";
import { usePersonViewModel } from "../people/usePersonViewModel";
import { errorCode, parseDay } from "./useCardsViewModel";

export interface PaymentFormInput {
  accountId: number;
  amountText: string;
  interestText: string;
  fineText: string;
  date: string;
}

export interface RuleFormInput {
  fromMonth: string;
  closingDay: string;
  dueDay: string;
}

export function useStatementViewModel(cardId: number) {
  const repository = useRepository();
  const locale = useLocale();
  const queryClient = useQueryClient();
  const { person } = usePersonViewModel();
  /** Undefined means "the statement that is open today". */
  const [month, setMonth] = useState<string | undefined>();

  const query = useQuery({
    queryKey: ["statement", cardId, month ?? "open"],
    queryFn: () => repository.getStatement(cardId, month),
  });
  const people = useQuery({ queryKey: ["people"], queryFn: () => repository.listPeople() }).data ?? [];
  const statement = query.data;

  const refresh = () => {
    for (const key of ["statement", "cards", "accounts", "transactions", "budget"]) {
      queryClient.invalidateQueries({ queryKey: [key] });
    }
  };
  const payMutation = useMutation({
    mutationFn: (input: Parameters<typeof repository.payStatement>[2] & { month: string }) =>
      repository.payStatement(cardId, input.month, input),
    onSuccess: refresh,
  });
  const ruleMutation = useMutation({
    mutationFn: (rule: Parameters<typeof repository.setCardRule>[1]) => repository.setCardRule(cardId, rule),
    onSuccess: refresh,
  });
  const removeMutation = useMutation({ mutationFn: repository.deleteTransaction, onSuccess: refresh });

  const parseOptionalMoney = (text: string) => (text.trim() === "" ? Money.zero() : Money.parse(text, locale));

  return {
    statement,
    isLoading: query.isLoading,
    previousMonth: () => statement && setMonth(addMonths(statement.month, -1)),
    nextMonth: () => statement && setMonth(addMonths(statement.month, 1)),

    async pay(input: PaymentFormInput): Promise<CommandResult> {
      const amount = Money.parse(input.amountText, locale);
      const interest = parseOptionalMoney(input.interestText);
      const fine = parseOptionalMoney(input.fineText);
      if (!amount || amount.cents <= 0 || !interest || interest.cents < 0 || !fine || fine.cents < 0) {
        return { ok: false, error: "invalid_amount" };
      }
      const personId = people.find((p) => p.name.toLowerCase() === person)?.id;
      if (!statement || personId === undefined) return { ok: false, error: "person_unknown" };
      try {
        await payMutation.mutateAsync({
          month: statement.month, accountId: input.accountId, amountCents: amount.cents,
          interestCents: interest.cents, fineCents: fine.cents, date: input.date, personId,
        });
        return { ok: true };
      } catch (e) {
        return { ok: false, error: errorCode(e) };
      }
    },

    async changeRule(input: RuleFormInput): Promise<CommandResult> {
      const closingDay = parseDay(input.closingDay);
      const dueDay = parseDay(input.dueDay);
      if (closingDay === null || dueDay === null) return { ok: false, error: "invalid_day" };
      try {
        await ruleMutation.mutateAsync({ fromMonth: input.fromMonth, closingDay, dueDay });
        return { ok: true };
      } catch (e) {
        return { ok: false, error: errorCode(e) };
      }
    },

    /** Removes a payment or a fee item that was recorded by mistake. */
    removeTransaction: (id: number) => removeMutation.mutateAsync(id).then(() => undefined),
  };
}
