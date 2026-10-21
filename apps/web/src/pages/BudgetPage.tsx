import { useState } from "react";
import { useTranslation } from "react-i18next";
import { css } from "../../styled-system/css";
import type { BudgetCategoryDto } from "../data/types";
import { BudgetBar } from "../features/budget/BudgetBar";
import { BudgetDialog } from "../features/budget/BudgetDialog";
import { CategoryIcon } from "../features/categories/CategoryIcon";
import { useBudgetViewModel } from "../features/budget/useBudgetViewModel";
import { MoneyText } from "../shared/MoneyText";
import { MonthNavigator } from "../shared/MonthNavigator";
import { Link } from "react-router";
import { card } from "../shared/ui";

export function BudgetPage() {
  const { t } = useTranslation();
  const vm = useBudgetViewModel();
  const [editing, setEditing] = useState<BudgetCategoryDto | null>(null);
  const report = vm.report;

  return (
    <div className={css({ display: "grid", gap: "4" })}>
      <h1 className={css({ fontSize: "xl", fontWeight: "bold" })}>{t("pages.budget")}</h1>
      <MonthNavigator month={vm.month} onPrevious={vm.previousMonth} onNext={vm.nextMonth} />

      {report && (
        <div className={`${card} ${css({ display: "flex", justifyContent: "space-around", textAlign: "center" })}`} data-testid="budget-totals">
          <div>
            <p className={css({ color: "muted", fontSize: "sm" })}>{t("budget.total")}</p>
            <MoneyText cents={report.totals.budgetCents} className={css({ fontWeight: "bold" })} />
          </div>
          <div>
            <p className={css({ color: "muted", fontSize: "sm" })}>{t("budget.spent")}</p>
            <MoneyText cents={report.totals.spentCents} className={css({ fontWeight: "bold" })} />
          </div>
          <div>
            <p className={css({ color: "muted", fontSize: "sm" })}>{t("budget.remaining")}</p>
            <MoneyText
              cents={report.totals.remainingCents}
              className={css({ fontWeight: "bold", color: report.totals.remainingCents < 0 ? "red.500" : "primary" })}
            />
          </div>
        </div>
      )}

      <div className={css({ display: "flex", justifyContent: "flex-end" })}>
        <Link to="/categories" className={css({ color: "primary", fontSize: "sm" })}>{t("categories.manage")}</Link>
      </div>

      {vm.isLoading ? (
        <p>{t("common.loading")}</p>
      ) : report && report.categories.length === 0 ? (
        <p className={css({ color: "muted" })}>{t("budget.empty")}</p>
      ) : (
        <ul className={css({ display: "grid", gap: "2", listStyle: "none" })}>
          {report?.categories.map((c) => (
            <li key={c.categoryId}>
              <button
                type="button"
                onClick={() => setEditing(c)}
                aria-label={`${c.name}: ${t(`budget.status.${c.status}`)}`}
                className={`${card} ${css({ width: "100%", display: "grid", gap: "2", textAlign: "left", cursor: "pointer" })}`}
              >
                <span className={css({ display: "flex", justifyContent: "space-between" })}>
                  <span className={css({ display: "flex", alignItems: "center", gap: "2" })}>
                    <CategoryIcon icon={c.icon} />
                    <strong>{c.name}</strong>
                  </span>
                  {c.budgetCents > 0 ? (
                    <span className={css({ fontSize: "sm", color: "muted" })}>
                      <MoneyText cents={c.spentCents} /> / <MoneyText cents={c.budgetCents} />
                    </span>
                  ) : (
                    <span className={css({ fontSize: "sm", color: "muted" })}>
                      <MoneyText cents={c.spentCents} /> · {t("budget.noBudget")}
                    </span>
                  )}
                </span>
                {c.budgetCents > 0 && (
                  <>
                    <BudgetBar ratio={c.ratio} status={c.status} label={c.name} />
                    <span className={css({ fontSize: "sm", display: "flex", justifyContent: "space-between" })}>
                      <span>{t("budget.used", { percent: Math.round(c.ratio * 100) })}</span>
                      <span className={css({ color: c.remainingCents < 0 ? "red.500" : "text" })}>
                        {c.remainingCents < 0 ? `${t("budget.overBy")} ` : `${t("budget.remaining")}: `}
                        <MoneyText cents={Math.abs(c.remainingCents)} />
                      </span>
                    </span>
                  </>
                )}
                {c.committedCents > 0 && (
                  <span className={css({ fontSize: "xs", color: "muted" })}>
                    {t("budget.committed")}: <MoneyText cents={c.committedCents} />
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}

      {report && (report.uncategorized.spentCents > 0 || report.uncategorized.committedCents > 0) && (
        <p className={css({ color: "muted", fontSize: "sm" })}>
          {t("budget.uncategorized")}: <MoneyText cents={report.uncategorized.spentCents} />
        </p>
      )}

      {editing && <BudgetDialog category={editing} vm={vm} onClose={() => setEditing(null)} />}
    </div>
  );
}
