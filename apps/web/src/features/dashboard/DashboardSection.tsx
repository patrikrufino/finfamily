import { Money } from "@finfamily/domain";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { css } from "../../../styled-system/css";
import { MoneyText } from "../../shared/MoneyText";
import { formatMonth, formatShortDate } from "../../shared/format";
import { card } from "../../shared/ui";
import { useLocale } from "../../shared/useLocale";
import { BudgetBar } from "../budget/BudgetBar";
import { useDashboardViewModel } from "./useDashboardViewModel";

const sectionTitle = css({ fontWeight: "bold", fontSize: "lg" });
const muted = css({ color: "muted", fontSize: "sm" });

/** Home dashboard: month result, budget, statements due, commitments and the forecast. */
export function DashboardSection() {
  const { t } = useTranslation();
  const locale = useLocale();
  const vm = useDashboardViewModel();
  const d = vm.dashboard;
  const money = (cents: number) => Money.fromCents(cents).format(locale);
  if (!d) return null;

  const maxAbs = Math.max(1, ...d.forecast.map((m) => Math.abs(m.endBalanceCents)));

  return (
    <div className={css({ display: "grid", gap: "4" })}>
      <section aria-labelledby="dash-month" className={`${card} ${css({ display: "grid", gap: "3" })}`} data-testid="month-result">
        <h2 id="dash-month" className={sectionTitle}>{t("dashboard.month")}</h2>
        <div className={css({ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "2", textAlign: "center" })}>
          <div>
            <p className={muted}>{t("dashboard.income")}</p>
            <MoneyText cents={d.monthSummary.incomeCents} className={css({ fontWeight: "bold", color: "primary" })} />
          </div>
          <div>
            <p className={muted}>{t("dashboard.expenses")}</p>
            <MoneyText cents={d.monthSummary.expenseCents} className={css({ fontWeight: "bold", color: "red.500" })} />
          </div>
          <div>
            <p className={muted}>{t("dashboard.result")}</p>
            <MoneyText cents={d.monthSummary.resultCents} className={css({ fontWeight: "bold" })} />
          </div>
        </div>
        <p className={muted}>{t("dashboard.projectedEnd")}: <MoneyText cents={d.projectedEndOfMonthCents} /></p>
      </section>

      <section aria-labelledby="dash-budget" className={`${card} ${css({ display: "grid", gap: "2" })}`}>
        <h2 id="dash-budget" className={sectionTitle}>{t("dashboard.budgetTitle")}</h2>
        {vm.hasBudget ? (
          <>
            <BudgetBar
              ratio={vm.budgetUsedRatio}
              status={vm.budgetUsedRatio > 1 ? "over" : vm.budgetUsedRatio >= 0.8 ? "warning" : "ok"}
              label={t("dashboard.budgetTitle")}
            />
            <p className={muted}>
              {t("dashboard.budgetUsed", { percent: Math.round(vm.budgetUsedRatio * 100) })} ·{" "}
              {t("dashboard.budgetOf", { spent: money(d.budget.totals.spentCents), budget: money(d.budget.totals.budgetCents) })}
            </p>
            {d.budget.highlights.length > 0 && (
              <ul aria-label={t("dashboard.attention")} className={css({ display: "grid", gap: "1", listStyle: "none", marginTop: "1" })}>
                {d.budget.highlights.map((h) => (
                  <li key={h.categoryId} className={css({ display: "flex", justifyContent: "space-between", fontSize: "sm" })}>
                    <span>
                      <strong>{h.name}</strong> · {h.status === "over" ? t("dashboard.over") : t("dashboard.near")}
                    </span>
                    <span className={css({ color: h.remainingCents < 0 ? "red.500" : "muted" })}>
                      {h.remainingCents < 0
                        ? t("dashboard.exceeded", { amount: money(-h.remainingCents) })
                        : t("dashboard.left", { amount: money(h.remainingCents) })}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </>
        ) : (
          <p className={muted}>{t("dashboard.noBudget")}</p>
        )}
      </section>

      <section aria-labelledby="dash-due" className={`${card} ${css({ display: "grid", gap: "2" })}`}>
        <h2 id="dash-due" className={sectionTitle}>{t("dashboard.dueTitle")}</h2>
        {d.cardsDue.length === 0 ? (
          <p className={muted}>{t("dashboard.nothingDue")}</p>
        ) : (
          <ul className={css({ display: "grid", gap: "2", listStyle: "none" })}>
            {d.cardsDue.map((due) => (
              <li key={`${due.cardId}-${due.month}`}>
                <Link to={`/cards/${due.cardId}`} className={css({ display: "flex", justifyContent: "space-between", alignItems: "center" })}>
                  <span>
                    <strong>{due.name}</strong>
                    <span className={css({ display: "block", fontSize: "sm", color: due.overdue ? "red.500" : "muted" })}>
                      {due.overdue
                        ? t("dashboard.overdueSince", { date: formatShortDate(due.dueDate, locale) })
                        : t("dashboard.dueOn", { date: formatShortDate(due.dueDate, locale) })}
                    </span>
                  </span>
                  <MoneyText cents={due.remainingCents} className={css({ fontWeight: "bold" })} />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="dash-commitments" className={`${card} ${css({ display: "grid", gap: "2" })}`}>
        <h2 id="dash-commitments" className={sectionTitle}>{t("dashboard.commitments")}</h2>
        <Link to="/installments" className={css({ display: "flex", justifyContent: "space-between", alignItems: "center" })}>
          <span>
            {t("dashboard.installmentsMonth")}
            <span className={css({ display: "block", fontSize: "sm", color: "muted" })}>{t("dashboard.plans", { count: d.installments.activePlans })}</span>
          </span>
          <MoneyText cents={d.installments.committedThisMonthCents} className={css({ fontWeight: "bold" })} />
        </Link>
        <Link to="/debts" className={css({ display: "flex", justifyContent: "space-between", alignItems: "center" })}>
          <span>
            {t("dashboard.debtsOwed")}
            <span className={css({ display: "block", fontSize: "sm", color: "muted" })}>{t("dashboard.debtsCount", { count: d.debts.openCount })}</span>
          </span>
          <MoneyText cents={d.debts.totalOwedCents} className={css({ fontWeight: "bold" })} />
        </Link>
      </section>

      <section aria-labelledby="dash-forecast" className={`${card} ${css({ display: "grid", gap: "3" })}`}>
        <h2 id="dash-forecast" className={sectionTitle}>{t("dashboard.forecastTitle")}</h2>
        <p className={muted}>{t("dashboard.forecastNote")}</p>
        {vm.firstNegativeMonth && (
          <p role="status" className={css({ color: "red.500", fontWeight: "bold", fontSize: "sm" })}>
            {t("dashboard.negativeWarning", { month: formatMonth(vm.firstNegativeMonth, locale) })}
          </p>
        )}
        <ul className={css({ display: "grid", gap: "3", listStyle: "none" })}>
          {d.forecast.map((m, i) => (
            <li key={m.month} data-testid={`forecast-${m.month}`} className={css({ display: "grid", gap: "1" })}>
              <span className={css({ display: "flex", justifyContent: "space-between", alignItems: "baseline" })}>
                <strong>{formatMonth(m.month, locale)}{i === 0 ? ` · ${t("dashboard.currentMonth")}` : ""}</strong>
                <span aria-label={t("dashboard.endBalance")}>
                  <MoneyText cents={m.endBalanceCents} className={css({ fontWeight: "bold", color: m.endBalanceCents < 0 ? "red.500" : "text" })} />
                </span>
              </span>
              <span
                aria-hidden="true"
                className={css({ display: "block", height: "1.5", borderRadius: "full", background: "border", overflow: "hidden" })}
              >
                <span
                  className={m.endBalanceCents < 0 ? negativeFill : positiveFill}
                  style={{ width: `${Math.max(2, Math.round((Math.abs(m.endBalanceCents) / maxAbs) * 100))}%` }}
                />
              </span>
              <span className={css({ fontSize: "xs", color: "muted" })}>
                {t("dashboard.fIncome")} {money(m.incomeCents)} · {t("dashboard.fExpenses")} {money(m.expenseCents)} · {t("dashboard.fCards")} {money(m.cardPaymentsCents)}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

// Literal css() calls so Panda generates both colors.
const positiveFill = css({ display: "block", height: "100%", background: "primary" });
const negativeFill = css({ display: "block", height: "100%", background: "red.500" });
