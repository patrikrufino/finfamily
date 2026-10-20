import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useRepository } from "../../data/RepositoryContext";
import type { NewTransaction } from "../../data/types";

export function shiftMonth(month: string, delta: number): string {
  const [year, m] = month.split("-").map(Number) as [number, number];
  const index = year * 12 + (m - 1) + delta;
  return `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, "0")}`;
}

export function currentMonth(now = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export function useTransactionsViewModel(initialMonth: string = currentMonth()) {
  const repository = useRepository();
  const queryClient = useQueryClient();
  const [month, setMonth] = useState(initialMonth);
  const [accountId, setAccountFilter] = useState<number | undefined>();
  const [personId, setPersonFilter] = useState<number | undefined>();

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["transactions"] });
    queryClient.invalidateQueries({ queryKey: ["accounts"] });
    queryClient.invalidateQueries({ queryKey: ["budget"] });
  };

  const query = useQuery({
    queryKey: ["transactions", month, accountId ?? null, personId ?? null],
    queryFn: () => repository.listTransactions({ month, accountId, personId }),
  });
  const remove = useMutation({ mutationFn: repository.deleteTransaction, onSuccess: refresh });
  const save = useMutation({
    mutationFn: ({ id, input }: { id?: number; input: NewTransaction }) =>
      id === undefined ? repository.createTransaction(input) : repository.updateTransaction(id, input),
    onSuccess: refresh,
  });

  const transactions = query.data ?? [];
  const sumOf = (kind: "income" | "expense") =>
    transactions.filter((t) => t.kind === kind && t.status === "settled").reduce((s, t) => s + t.amountCents, 0);

  return {
    month,
    previousMonth: () => setMonth((m) => shiftMonth(m, -1)),
    nextMonth: () => setMonth((m) => shiftMonth(m, 1)),
    accountId,
    personId,
    setAccountFilter,
    setPersonFilter,
    transactions,
    isLoading: query.isLoading,
    incomeCents: sumOf("income"),
    expenseCents: sumOf("expense"),
    remove: (id: number) => remove.mutateAsync(id),
    save: (input: NewTransaction, id?: number) => save.mutateAsync({ id, input }),
  };
}
