import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { css } from "../../styled-system/css";
import type { PlanDto } from "../data/types";
import { BudgetBar } from "../features/budget/BudgetBar";
import { useInstallmentsViewModel } from "../features/installments/useInstallmentsViewModel";
import { formatShortDate } from "../shared/format";
import { MoneyText } from "../shared/MoneyText";
import { card } from "../shared/ui";
import { useLocale } from "../shared/useLocale";

export function InstallmentsPage() {
  const { t } = useTranslation();
  const locale = useLocale();
  const vm = useInstallmentsViewModel();

  const planCard = (p: PlanDto) => (
    <li key={p.id}>
      <Link to={`/installments/${p.id}`} className={`${card} ${css({ display: "grid", gap: "2" })}`}>
        <span className={css({ display: "flex", justifyContent: "space-between" })}>
          <strong>{p.description}</strong>
          <MoneyText cents={p.paidCents + p.remainingCents} className={css({ color: "muted", fontSize: "sm" })} />
        </span>
        <BudgetBar ratio={p.count > 0 ? p.paidCount / p.count : 0} status="ok" label={`${p.description} · ${t("installments.progress", { paid: p.paidCount, count: p.count })}`} />
        <span className={css({ fontSize: "sm", display: "flex", justifyContent: "space-between" })}>
          <span>{t("installments.progress", { paid: p.paidCount, count: p.count })}</span>
          <span>{t("installments.remaining")}: <MoneyText cents={p.remainingCents} /></span>
        </span>
        {p.nextDate && p.nextCents !== null && (
          <span className={css({ fontSize: "xs", color: "muted" })}>
            {t("installments.next", { date: formatShortDate(p.nextDate, locale), amount: new Intl.NumberFormat(locale, { style: "currency", currency: "BRL" }).format(p.nextCents / 100) })}
          </span>
        )}
      </Link>
    </li>
  );

  return (
    <div className={css({ display: "grid", gap: "4" })}>
      <Link to="/transactions" className={css({ color: "primary", fontSize: "sm" })}>‹ {t("installments.back")}</Link>
      <h1 className={css({ fontSize: "xl", fontWeight: "bold" })}>{t("installments.title")}</h1>

      {vm.isLoading ? (
        <p>{t("common.loading")}</p>
      ) : vm.plans.length === 0 ? (
        <p className={css({ color: "muted" })}>{t("installments.empty")}</p>
      ) : (
        <>
          {vm.active.length > 0 && (
            <section aria-labelledby="active-title" className={css({ display: "grid", gap: "2" })}>
              <h2 id="active-title" className={css({ fontWeight: "bold" })}>{t("installments.active")}</h2>
              <ul className={css({ display: "grid", gap: "2", listStyle: "none" })}>{vm.active.map(planCard)}</ul>
            </section>
          )}
          {vm.done.length > 0 && (
            <section aria-labelledby="done-title" className={css({ display: "grid", gap: "2" })}>
              <h2 id="done-title" className={css({ fontWeight: "bold" })}>{t("installments.done")}</h2>
              <ul className={css({ display: "grid", gap: "2", listStyle: "none" })}>{vm.done.map(planCard)}</ul>
            </section>
          )}
        </>
      )}
    </div>
  );
}
