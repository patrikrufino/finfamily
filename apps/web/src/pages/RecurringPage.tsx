import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { css } from "../../styled-system/css";
import { useRepository } from "../data/RepositoryContext";
import type { RecurringDto } from "../data/types";
import { RuleEditDialog } from "../features/recurring/RuleEditDialog";
import { useRecurringViewModel } from "../features/recurring/useRecurringViewModel";
import { formatShortDate } from "../shared/format";
import { MoneyText } from "../shared/MoneyText";
import { card, dangerButton, errorText, secondaryButton } from "../shared/ui";
import { useLocale } from "../shared/useLocale";

export function RecurringPage() {
  const { t } = useTranslation();
  const locale = useLocale();
  const repository = useRepository();
  const vm = useRecurringViewModel();
  const accounts = useQuery({ queryKey: ["accounts"], queryFn: () => repository.listAccounts() }).data ?? [];
  const cards = useQuery({ queryKey: ["cards"], queryFn: () => repository.listCards() }).data ?? [];
  const [editing, setEditing] = useState<RecurringDto | null>(null);
  const [error, setError] = useState<string | null>(null);

  const sourceName = (r: RecurringDto) =>
    r.cardId !== null ? cards.find((c) => c.id === r.cardId)?.name : accounts.find((a) => a.id === r.accountId)?.name;

  const ruleCard = (r: RecurringDto) => (
    <li key={r.id} className={`${card} ${css({ display: "grid", gap: "2", opacity: r.status === "active" ? 1 : 0.75 })}`}>
      <span className={css({ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: "2" })}>
        <strong>{r.description || (r.kind === "income" ? t("recurring.incomeLabel") : t("recurring.expenseLabel"))}</strong>
        <MoneyText cents={r.kind === "expense" ? -r.amountCents : r.amountCents} className={css({ fontWeight: "bold", color: r.kind === "expense" ? "red.500" : "primary" })} />
      </span>
      <span className={css({ fontSize: "sm", color: "muted" })}>
        {t(`recurring.frequency.${r.frequency}`)} · {sourceName(r)} · {t(`recurring.status.${r.status}`)}
      </span>
      <span className={css({ fontSize: "sm", color: "muted" })}>
        {r.status !== "ended" && `${t("recurring.next", { date: formatShortDate(r.nextDate, locale) })} · `}{t("recurring.posted", { count: r.postedCount })}
      </span>
      <span className={css({ display: "flex", gap: "2", flexWrap: "wrap" })}>
        {r.status !== "ended" && (
          <button
            type="button"
            className={secondaryButton}
            aria-label={`${r.active ? t("recurring.pause") : t("recurring.resume")} ${r.description}`}
            onClick={() => vm.setActive(r.id, !r.active)}
          >
            {r.active ? t("recurring.pause") : t("recurring.resume")}
          </button>
        )}
        <button type="button" className={secondaryButton} aria-label={`${t("accounts.edit")} ${r.description}`} onClick={() => setEditing(r)}>
          {t("accounts.edit")}
        </button>
        {r.postedCount === 0 && (
          <button
            type="button"
            className={dangerButton}
            aria-label={`${t("recurring.delete")} ${r.description}`}
            onClick={async () => {
              const result = await vm.deleteRule(r.id);
              setError(result.ok ? null : result.error);
            }}
          >
            {t("recurring.delete")}
          </button>
        )}
      </span>
    </li>
  );

  const active = vm.rules.filter((r) => r.status === "active");
  const inactive = vm.rules.filter((r) => r.status !== "active");

  return (
    <div className={css({ display: "grid", gap: "4" })}>
      <Link to="/transactions" className={css({ color: "primary", fontSize: "sm" })}>‹ {t("recurring.back")}</Link>
      <h1 className={css({ fontSize: "xl", fontWeight: "bold" })}>{t("recurring.title")}</h1>
      {error && <p role="alert" className={errorText}>{t(`errors.${error}`, { defaultValue: t("errors.unknown") })}</p>}

      {vm.isLoading ? (
        <p>{t("common.loading")}</p>
      ) : vm.rules.length === 0 ? (
        <p className={css({ color: "muted" })}>{t("recurring.empty")}</p>
      ) : (
        <>
          {active.length > 0 && (
            <section aria-labelledby="rec-active" className={css({ display: "grid", gap: "2" })}>
              <h2 id="rec-active" className={css({ fontWeight: "bold" })}>{t("recurring.active")}</h2>
              <ul className={css({ display: "grid", gap: "2", listStyle: "none" })}>{active.map(ruleCard)}</ul>
            </section>
          )}
          {inactive.length > 0 && (
            <section aria-labelledby="rec-inactive" className={css({ display: "grid", gap: "2" })}>
              <h2 id="rec-inactive" className={css({ fontWeight: "bold" })}>{t("recurring.inactive")}</h2>
              <ul className={css({ display: "grid", gap: "2", listStyle: "none" })}>{inactive.map(ruleCard)}</ul>
            </section>
          )}
        </>
      )}

      {editing && <RuleEditDialog rule={editing} vm={vm} onClose={() => setEditing(null)} />}
    </div>
  );
}
