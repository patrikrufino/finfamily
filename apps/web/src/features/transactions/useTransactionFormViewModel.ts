import {
  categoryAllows,
  Money,
  validateInstallmentPlan,
  type InstallmentError,
  validateTransactionCategory,
  validateTransactionInput,
  type TransactionError,
  type TransactionKind,
} from "@finfamily/domain";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useRepository } from "../../data/RepositoryContext";
import type { NewTransaction, TransactionDto } from "../../data/types";
import { useLocale } from "../../shared/useLocale";
import { usePersonViewModel } from "../people/usePersonViewModel";

export interface TransactionFormValues {
  kind: TransactionKind;
  amountText: string;
  date: string;
  accountId: number | null;
  /** Set when an expense is charged to a credit card instead of an account. */
  cardId: number | null;
  toAccountId: number | null;
  categoryId: number | null;
  description: string;
  settled: boolean;
  /** Number of installments typed by the user; empty means a single payment. */
  installmentsText: string;
}

export type PaymentSource = { type: "account" | "card"; id: number };

export type FormError = TransactionError | InstallmentError | "invalid_amount" | "account_required" | "person_unknown" | "description_required";

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
  const cardsQuery = useQuery({ queryKey: ["cards"], queryFn: () => repository.listCards() });
  const categoriesQuery = useQuery({ queryKey: ["categories"], queryFn: () => repository.listCategories() });
  const peopleQuery = useQuery({ queryKey: ["people"], queryFn: () => repository.listPeople() });
  const accounts = accountsQuery.data ?? [];
  const people = peopleQuery.data ?? [];
  const allCategories = categoriesQuery.data ?? [];
  const cards = cardsQuery.data ?? [];

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
        cardId: transaction.cardId,
        toAccountId: transaction.toAccountId,
        categoryId: transaction.categoryId,
        description: transaction.description,
        settled: transaction.status === "settled",
        installmentsText: "",
      }
    : {
        kind: "expense",
        amountText: "",
        date: today,
        accountId: accounts[0]?.id ?? null,
        cardId: null,
        toAccountId: null,
        categoryId: null,
        description: "",
        settled: true,
        installmentsText: "",
      };
  const merged: TransactionFormValues = { ...base, ...edited };
  const categories = allCategories.filter((c) => categoryAllows(c, merged.kind));
  // A category that no longer fits the kind (or is not loaded yet) is treated as unset.
  const categoryId = categories.some((c) => c.id === merged.categoryId) ? merged.categoryId : null;
  // Only expenses can be charged to a card; any other kind goes back to an account.
  const cardId = merged.kind === "expense" ? merged.cardId : null;
  const accountId = cardId !== null ? null : (merged.accountId ?? accounts[0]?.id ?? null);
  const values: TransactionFormValues = { ...merged, categoryId, cardId, accountId };

  const savePlan = useMutation({
    mutationFn: repository.createPlan,
    onSuccess: () => {
      for (const key of ["plans", "transactions", "accounts", "budget", "cards", "statement"]) {
        queryClient.invalidateQueries({ queryKey: [key] });
      }
    },
  });

  /** Only a new expense can be split; editing keeps working on the single transaction. */
  const canSplitInInstallments = !transaction && values.kind === "expense";
  const installmentCount = /^\d+$/.test(values.installmentsText.trim()) ? Number(values.installmentsText) : null;
  const total = Money.parse(values.amountText, locale);
  const installmentPreview =
    canSplitInInstallments && installmentCount !== null && installmentCount >= 2 && total && total.cents > 0 && total.cents >= installmentCount
      ? (() => {
          const parts = total.split(installmentCount);
          return { count: installmentCount, firstCents: parts[0]!.cents, lastCents: parts[parts.length - 1]!.cents };
        })()
      : null;

  const save = useMutation({
    mutationFn: (input: NewTransaction) =>
      transaction ? repository.updateTransaction(transaction.id, input) : repository.createTransaction(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
      queryClient.invalidateQueries({ queryKey: ["budget"] });
      queryClient.invalidateQueries({ queryKey: ["cards"] });
      queryClient.invalidateQueries({ queryKey: ["statement"] });
    },
  });

  function setField<K extends keyof TransactionFormValues>(key: K, value: TransactionFormValues[K]) {
    setEdited((prev) => ({
      ...prev,
      [key]: value,
      ...(key === "kind" && value !== "transfer" ? { toAccountId: null } : {}),
    }));
  }

  async function submitPlan(): Promise<boolean> {
    const found: FormError[] = [];
    const amount = Money.parse(values.amountText, locale);
    const personId = people.find((p) => p.name.toLowerCase() === person)?.id;
    if (!amount) found.push("invalid_amount");
    if (!values.description.trim()) found.push("description_required");
    if (personId === undefined) found.push("person_unknown");
    if (amount && personId !== undefined) {
      const count = installmentCount ?? Number.NaN;
      found.push(...validateInstallmentPlan({ total: amount, count, firstDate: values.date, accountId: values.accountId, cardId: values.cardId }));
      if (found.length === 0) {
        await savePlan.mutateAsync({
          description: values.description.trim(), totalCents: amount.cents, count, firstDate: values.date,
          accountId: values.accountId, cardId: values.cardId, categoryId: values.categoryId, personId,
        });
        setErrors([]);
        return true;
      }
    }
    setErrors(found);
    return false;
  }

  async function submit(): Promise<boolean> {
    if (canSplitInInstallments && values.installmentsText.trim() !== "") return submitPlan();
    const found: FormError[] = [];
    const amount = Money.parse(values.amountText, locale);
    const personId = people.find((p) => p.name.toLowerCase() === person)?.id;
    if (!amount) found.push("invalid_amount");
    if (values.accountId === null && values.cardId === null) found.push("account_required");
    if (personId === undefined) found.push("person_unknown");
    if (amount && (values.accountId !== null || values.cardId !== null) && personId !== undefined) {
      const input = {
        kind: values.kind,
        amountCents: amount.cents,
        date: values.date,
        accountId: values.accountId,
        cardId: values.cardId,
        toAccountId: values.kind === "transfer" ? values.toAccountId : null,
        categoryId: values.categoryId,
        description: values.description.trim(),
        status: values.settled ? ("settled" as const) : ("scheduled" as const),
        personId: transaction?.personId ?? personId,
      };
      const category = allCategories.find((c) => c.id === input.categoryId) ?? null;
      found.push(...validateTransactionInput({ ...input, amount }), ...validateTransactionCategory(input.kind, category));
      if (found.length === 0) {
        await save.mutateAsync(input);
        setErrors([]);
        return true;
      }
    }
    setErrors(found);
    return false;
  }

  function setSource(source: PaymentSource) {
    setEdited((prev) => ({
      ...prev,
      accountId: source.type === "account" ? source.id : null,
      cardId: source.type === "card" ? source.id : null,
    }));
  }

  return {
    values, setField, setSource, errors, submit, accounts, cards, categories,
    canSplitInInstallments, installmentPreview,
    isSaving: save.isPending || savePlan.isPending,
  };
}
