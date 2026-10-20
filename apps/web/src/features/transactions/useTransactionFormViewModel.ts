import {
  Money,
  validateTransactionInput,
  type TransactionError,
  type TransactionKind,
} from "@finfamily/domain";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useRepository } from "../../data/RepositoryContext";
import type { TransactionDto } from "../../data/types";
import { useLocale } from "../../shared/useLocale";
import { usePersonViewModel } from "../people/usePersonViewModel";

export interface TransactionFormValues {
  kind: TransactionKind;
  amountText: string;
  date: string;
  accountId: number | null;
  toAccountId: number | null;
  description: string;
  settled: boolean;
}

export type FormError = TransactionError | "invalid_amount" | "account_required" | "person_unknown";

interface Options {
  transaction?: TransactionDto;
  /** ISO date used as the default; injectable for tests. */
  today?: string;
}

const isoToday = () => new Date().toLocaleDateString("sv-SE");

export function useTransactionFormViewModel({ transaction, today = isoToday() }: Options = {}) {
  const repository = useRepository();
  const locale = useLocale();
  const queryClient = useQueryClient();
  const { person } = usePersonViewModel();

  const accountsQuery = useQuery({ queryKey: ["accounts"], queryFn: () => repository.listAccounts() });
  const peopleQuery = useQuery({ queryKey: ["people"], queryFn: () => repository.listPeople() });
  const accounts = accountsQuery.data ?? [];
  const people = peopleQuery.data ?? [];

  const [edited, setEdited] = useState<Partial<TransactionFormValues>>({});
  const [errors, setErrors] = useState<FormError[]>([]);

  const base: TransactionFormValues = transaction
    ? {
        kind: transaction.kind,
        amountText: Money.fromCents(transaction.amountCents)
          .format(locale)
          .replace(/[^\d.,-]/g, "")
          .trim(),
        date: transaction.date,
        accountId: transaction.accountId,
        toAccountId: transaction.toAccountId,
        description: transaction.description,
        settled: transaction.status === "settled",
      }
    : {
        kind: "expense",
        amountText: "",
        date: today,
        accountId: accounts[0]?.id ?? null,
        toAccountId: null,
        description: "",
        settled: true,
      };
  const values: TransactionFormValues = { ...base, ...edited };

  const save = useMutation({
    mutationFn: (input: Omit<TransactionDto, "id">) =>
      transaction ? repository.updateTransaction(transaction.id, input) : repository.createTransaction(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
    },
  });

  function setField<K extends keyof TransactionFormValues>(key: K, value: TransactionFormValues[K]) {
    setEdited((prev) => ({
      ...prev,
      [key]: value,
      ...(key === "kind" && value !== "transfer" ? { toAccountId: null } : {}),
    }));
  }

  async function submit(): Promise<boolean> {
    const found: FormError[] = [];
    const amount = Money.parse(values.amountText, locale);
    const personId = people.find((p) => p.name.toLowerCase() === person)?.id;
    if (!amount) found.push("invalid_amount");
    if (values.accountId === null) found.push("account_required");
    if (personId === undefined) found.push("person_unknown");
    if (amount && values.accountId !== null && personId !== undefined) {
      const input = {
        kind: values.kind,
        amountCents: amount.cents,
        date: values.date,
        accountId: values.accountId,
        toAccountId: values.kind === "transfer" ? values.toAccountId : null,
        description: values.description.trim(),
        status: values.settled ? ("settled" as const) : ("scheduled" as const),
        personId: transaction?.personId ?? personId,
      };
      found.push(...validateTransactionInput({ ...input, amount }));
      if (found.length === 0) {
        await save.mutateAsync(input);
        setErrors([]);
        return true;
      }
    }
    setErrors(found);
    return false;
  }

  return { values, setField, errors, submit, accounts, isSaving: save.isPending };
}
