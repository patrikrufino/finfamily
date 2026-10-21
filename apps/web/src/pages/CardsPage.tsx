import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { css } from "../../styled-system/css";
import { BudgetBar } from "../features/budget/BudgetBar";
import { CardDialog } from "../features/cards/CardDialog";
import { useCardsViewModel } from "../features/cards/useCardsViewModel";
import { formatShortDate } from "../shared/format";
import { MoneyText } from "../shared/MoneyText";
import { card, primaryButton } from "../shared/ui";
import { useLocale } from "../shared/useLocale";

export function CardsPage() {
  const { t } = useTranslation();
  const locale = useLocale();
  const vm = useCardsViewModel();
  const [creating, setCreating] = useState(false);

  return (
    <div className={css({ display: "grid", gap: "4" })}>
      <div className={css({ display: "flex", justifyContent: "space-between", alignItems: "center" })}>
        <h1 className={css({ fontSize: "xl", fontWeight: "bold" })}>{t("pages.cards")}</h1>
        <button type="button" className={primaryButton} onClick={() => setCreating(true)}>{t("cards.new")}</button>
      </div>

      {vm.isLoading ? (
        <p>{t("common.loading")}</p>
      ) : vm.cards.length === 0 ? (
        <p className={css({ color: "muted" })}>{t("cards.empty")}</p>
      ) : (
        <ul className={css({ display: "grid", gap: "3", listStyle: "none" })}>
          {vm.cards.map((c) => {
            const ratio = c.limitCents > 0 ? c.usedCents / c.limitCents : 0;
            return (
              <li key={c.id}>
                <Link to={`/cards/${c.id}`} className={`${card} ${css({ display: "grid", gap: "2" })}`}>
                  <span className={css({ display: "flex", justifyContent: "space-between" })}>
                    <strong>{c.name}</strong>
                    <span className={css({ color: "muted", fontSize: "sm" })}>
                      {t("cards.dueOn", { date: formatShortDate(c.openStatement.dueDate, locale) })}
                    </span>
                  </span>
                  <span className={css({ fontSize: "sm", color: "muted" })}>{t("cards.openStatement")}</span>
                  <MoneyText cents={c.openStatement.totalCents} className={css({ fontSize: "2xl", fontWeight: "bold" })} />
                  <BudgetBar ratio={ratio} status={ratio > 1 ? "over" : ratio >= 0.8 ? "warning" : "ok"} label={`${c.name} · ${t("cards.limitUsage")}`} />
                  <span className={css({ fontSize: "sm", color: "muted" })}>
                    {t("cards.available")}: <MoneyText cents={c.availableCents} />
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      <CardDialog open={creating} onClose={() => setCreating(false)} vm={vm} />
    </div>
  );
}
