import { useState } from "react";
import { useTranslation } from "react-i18next";
import { css } from "../../styled-system/css";
import { useQuery } from "@tanstack/react-query";
import { useRepository } from "../data/RepositoryContext";
import type { TransactionDto } from "../data/types";
import { TransactionDialog } from "../features/transactions/TransactionDialog";
import { useTransactionsViewModel } from "../features/transactions/useTransactionsViewModel";
import { MoneyText } from "../shared/MoneyText";
import { card, field, secondaryButton } from "../shared/ui";
import { useLocale } from "../shared/useLocale";

export function TransactionsPage() {
  const { t } = useTranslation();
  const locale = useLocale();
  const repository = useRepository();
  const vm = useTransactionsViewModel();
  const [editing, setEditing] = useState<TransactionDto | null>(null);
  const accounts = useQuery({ queryKey: ["accounts"], queryFn: () => repository.listAccounts() }).data ?? [];
  const people = useQuery({ queryKey: ["people"], queryFn: () => repository.listPeople() }).data ?? [];

  const rawMonthLabel = new Intl.DateTimeFormat(locale, { month: "long", year: "numeric", timeZone: "UTC" }).format(
    new Date(`${vm.month}-01T00:00:00Z`),
  );
  const monthLabel = rawMonthLabel.charAt(0).toLocaleUpperCase(locale) + rawMonthLabel.slice(1);
  const accountName = (id: number) => accounts.find((a) => a.id === id)?.name ?? "";
  const personName = (id: number) => people.find((p) => p.id === id)?.name ?? "";
  const formatDate = (iso: string) =>
    new Intl.DateTimeFormat(locale, { day: "2-digit", month: "short", timeZone: "UTC" }).format(new Date(`${iso}T00:00:00Z`));

  return (
    <div className={css({ display: "grid", gap: "4" })}>
      <h1 className={css({ fontSize: "xl", fontWeight: "bold" })}>{t("pages.transactions")}</h1>

      <div className={css({ display: "flex", alignItems: "center", justifyContent: "space-between" })}>
        <button type="button" className={secondaryButton} aria-label={t("transactions.previousMonth")} onClick={vm.previousMonth}>‹</button>
        <strong data-testid="month-label">{monthLabel}</strong>
        <button type="button" className={secondaryButton} aria-label={t("transactions.nextMonth")} onClick={vm.nextMonth}>›</button>
      </div>

      <div className={css({ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "2" })}>
        <select className={field} aria-label={t("transactions.filterAccount")} value={vm.accountId ?? ""} onChange={(e) => vm.setAccountFilter(e.target.value ? Number(e.target.value) : undefined)}>
          <option value="">{t("common.all")}</option>
          {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
        <select className={field} aria-label={t("transactions.filterPerson")} value={vm.personId ?? ""} onChange={(e) => vm.setPersonFilter(e.target.value ? Number(e.target.value) : undefined)}>
          <option value="">{t("common.everyone")}</option>
          {people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </div>

      <div className={`${card} ${css({ display: "flex", justifyContent: "space-around" })}`}>
        <div>
          <p className={css({ color: "muted", fontSize: "sm" })}>{t("transactions.incomeTotal")}</p>
          <MoneyText cents={vm.incomeCents} className={css({ color: "primary", fontWeight: "bold" })} />
        </div>
        <div>
          <p className={css({ color: "muted", fontSize: "sm" })}>{t("transactions.expenseTotal")}</p>
          <MoneyText cents={vm.expenseCents} className={css({ color: "red.500", fontWeight: "bold" })} />
        </div>
      </div>

      {vm.isLoading ? (
        <p>{t("common.loading")}</p>
      ) : vm.transactions.length === 0 ? (
        <p className={css({ color: "muted" })}>{t("transactions.empty")}</p>
      ) : (
        <ul className={css({ display: "grid", gap: "2", listStyle: "none" })}>
          {vm.transactions.map((tx) => (
            <li key={tx.id}>
              <button
                type="button"
                onClick={() => setEditing(tx)}
                className={`${card} ${css({ width: "100%", display: "flex", justifyContent: "space-between", textAlign: "left", cursor: "pointer", opacity: tx.status === "scheduled" ? 0.7 : 1 })}`}
              >
                <span>
                  <span className={css({ display: "block", fontWeight: "bold" })}>{tx.description || t(`transactions.${tx.kind}`)}</span>
                  <span className={css({ color: "muted", fontSize: "sm" })}>
                    {formatDate(tx.date)} · {accountName(tx.accountId)}
                    {tx.toAccountId ? ` → ${accountName(tx.toAccountId)}` : ""} · {personName(tx.personId)}
                    {tx.status === "scheduled" ? ` · ${t("transactions.scheduled")}` : ""}
                  </span>
                </span>
                <MoneyText
                  cents={tx.kind === "expense" ? -tx.amountCents : tx.amountCents}
                  className={css({ fontWeight: "bold", color: tx.kind === "expense" ? "red.500" : tx.kind === "income" ? "primary" : "text" })}
                />
              </button>
            </li>
          ))}
        </ul>
      )}

      {editing && (
        <TransactionDialog
          open
          transaction={editing}
          onClose={() => setEditing(null)}
          onDelete={async () => {
            await vm.remove(editing.id);
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}
