import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { css } from "../../styled-system/css";
import type { DebtDto } from "../data/types";
import { BudgetBar } from "../features/budget/BudgetBar";
import { DebtDialog } from "../features/debts/DebtDialog";
import { useDebtsViewModel } from "../features/debts/useDebtsViewModel";
import { MoneyText } from "../shared/MoneyText";
import { card, primaryButton } from "../shared/ui";

export function DebtsPage() {
  const { t } = useTranslation();
  const vm = useDebtsViewModel();
  const [creating, setCreating] = useState(false);
  const open = vm.debts.filter((d) => d.status === "open");
  const settled = vm.debts.filter((d) => d.status === "settled");

  const debtCard = (d: DebtDto) => {
    const due = d.originalCents + d.interestCents - d.discountCents;
    const ratio = due > 0 ? d.paidCents / due : 1;
    return (
      <li key={d.id}>
        <Link to={`/debts/${d.id}`} className={`${card} ${css({ display: "grid", gap: "2" })}`}>
          <span className={css({ display: "flex", justifyContent: "space-between", alignItems: "baseline" })}>
            <strong>{d.creditor}</strong>
            {d.status === "settled" && <span className={css({ color: "primary", fontSize: "sm" })}>{t("debts.settledBadge")}</span>}
          </span>
          <span className={css({ color: "muted", fontSize: "sm" })}>{t("debts.balance")}</span>
          <MoneyText cents={d.balanceCents} className={css({ fontSize: "2xl", fontWeight: "bold" })} />
          <BudgetBar ratio={ratio} status="ok" label={`${d.creditor} · ${t("debts.progress", { percent: Math.round(ratio * 100) })}`} />
          <span className={css({ fontSize: "sm", color: "muted" })}>{t("debts.progress", { percent: Math.round(ratio * 100) })}</span>
        </Link>
      </li>
    );
  };

  return (
    <div className={css({ display: "grid", gap: "4" })}>
      <div className={css({ display: "flex", justifyContent: "space-between", alignItems: "center" })}>
        <h1 className={css({ fontSize: "xl", fontWeight: "bold" })}>{t("pages.debts")}</h1>
        <button type="button" className={primaryButton} onClick={() => setCreating(true)}>{t("debts.new")}</button>
      </div>

      {open.length > 0 && (
        <div className={card}>
          <p className={css({ color: "muted", fontSize: "sm" })}>{t("debts.owed")}</p>
          <p data-testid="total-owed" className={css({ fontSize: "3xl", fontWeight: "bold" })}><MoneyText cents={vm.totalOwedCents} /></p>
        </div>
      )}

      {vm.isLoading ? (
        <p>{t("common.loading")}</p>
      ) : vm.debts.length === 0 ? (
        <p className={css({ color: "muted" })}>{t("debts.empty")}</p>
      ) : (
        <>
          {open.length > 0 && (
            <section aria-labelledby="debts-open" className={css({ display: "grid", gap: "2" })}>
              <h2 id="debts-open" className={css({ fontWeight: "bold" })}>{t("debts.open")}</h2>
              <ul className={css({ display: "grid", gap: "2", listStyle: "none" })}>{open.map(debtCard)}</ul>
            </section>
          )}
          {settled.length > 0 && (
            <section aria-labelledby="debts-settled" className={css({ display: "grid", gap: "2" })}>
              <h2 id="debts-settled" className={css({ fontWeight: "bold" })}>{t("debts.settled")}</h2>
              <ul className={css({ display: "grid", gap: "2", listStyle: "none" })}>{settled.map(debtCard)}</ul>
            </section>
          )}
        </>
      )}

      <DebtDialog open={creating} onClose={() => setCreating(false)} vm={vm} />
    </div>
  );
}
