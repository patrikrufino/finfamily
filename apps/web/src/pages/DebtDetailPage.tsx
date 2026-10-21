import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate, useParams } from "react-router";
import { css } from "../../styled-system/css";
import { DebtEntryDialog } from "../features/debts/DebtEntryDialog";
import { DebtPayDialog } from "../features/debts/DebtPayDialog";
import { useDebtViewModel } from "../features/debts/useDebtViewModel";
import { ConfirmDialog } from "../shared/ConfirmDialog";
import { formatShortDate } from "../shared/format";
import { MoneyText } from "../shared/MoneyText";
import { card, dangerButton, errorText, primaryButton, secondaryButton } from "../shared/ui";
import { useLocale } from "../shared/useLocale";

export function DebtDetailPage() {
  const { t } = useTranslation();
  const locale = useLocale();
  const navigate = useNavigate();
  const debtId = Number(useParams().id);
  const vm = useDebtViewModel(debtId);
  const [paying, setPaying] = useState(false);
  const [entry, setEntry] = useState<"interest" | "discount" | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const debt = vm.debt;

  return (
    <div className={css({ display: "grid", gap: "4" })}>
      <Link to="/debts" className={css({ color: "primary", fontSize: "sm" })}>‹ {t("debts.back")}</Link>

      {debt && (
        <>
          <h1 className={css({ fontSize: "xl", fontWeight: "bold" })}>{debt.creditor}</h1>

          <section aria-label={debt.creditor} className={`${card} ${css({ display: "grid", gap: "1" })}`}>
            <p className={css({ color: "muted", fontSize: "sm" })}>
              {t("debts.balance")} {debt.status === "settled" && <strong className={css({ color: "primary" })}>· {t("debts.settledBadge")}</strong>}
            </p>
            <p data-testid="debt-balance" className={css({ fontSize: "3xl", fontWeight: "bold" })}><MoneyText cents={debt.balanceCents} /></p>
            <p className={css({ fontSize: "sm", color: "muted" })}>
              {t("debts.original")}: <MoneyText cents={debt.originalCents} /> · {t("debts.interest")}: <MoneyText cents={debt.interestCents} /> ·{" "}
              {t("debts.discount")}: <MoneyText cents={debt.discountCents} /> · {t("debts.paid")}: <MoneyText cents={debt.paidCents} />
            </p>
            <div className={css({ display: "flex", gap: "2", flexWrap: "wrap", marginTop: "2" })}>
              {debt.status === "open" && <button type="button" className={primaryButton} onClick={() => setPaying(true)}>{t("debts.pay")}</button>}
              <button type="button" className={secondaryButton} onClick={() => setEntry("interest")}>{t("debts.postInterest")}</button>
              {debt.status === "open" && <button type="button" className={secondaryButton} onClick={() => setEntry("discount")}>{t("debts.giveDiscount")}</button>}
            </div>
          </section>

          {error && <p role="alert" className={errorText}>{t(`errors.${error}`, { defaultValue: t("errors.unknown") })}</p>}

          <section aria-labelledby="ledger-title" className={css({ display: "grid", gap: "2" })}>
            <h2 id="ledger-title" className={css({ fontWeight: "bold" })}>{t("debts.statement")}</h2>
            <ul className={css({ display: "grid", gap: "2", listStyle: "none" })}>
              {debt.ledger.map((line) => {
                const increases = line.type === "opening" || line.type === "interest";
                return (
                  <li key={`${line.type}-${line.id}`} className={`${card} ${css({ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "2" })}`}>
                    <span>
                      <span className={css({ display: "block", fontWeight: "bold" })}>{t(`debts.type.${line.type}`)}</span>
                      <span className={css({ color: "muted", fontSize: "sm" })}>
                        {formatShortDate(line.date, locale)}{line.note && line.type !== "payment" ? ` · ${line.note}` : ""} · {t("debts.after")} <MoneyText cents={line.balanceAfterCents} />
                      </span>
                    </span>
                    <span className={css({ display: "flex", alignItems: "center", gap: "2" })}>
                      <MoneyText cents={line.amountCents} className={css({ fontWeight: "bold", color: increases ? "red.500" : "primary" })} />
                      {line.type !== "opening" && (
                        <button
                          type="button"
                          className={`${dangerButton} ${css({ paddingBlock: "1", paddingInline: "2", fontSize: "xs" })}`}
                          aria-label={`${t("debts.remove")} ${t(`debts.type.${line.type}`)} ${formatShortDate(line.date, locale)}`}
                          onClick={async () => {
                            const result = await vm.removeLine(line);
                            setError(result.ok ? null : result.error);
                          }}
                        >
                          {t("debts.remove")}
                        </button>
                      )}
                    </span>
                  </li>
                );
              })}
            </ul>
          </section>

          {debt.paidCents === 0 && (
            <button type="button" className={dangerButton} onClick={() => setDeleting(true)}>{t("debts.deleteDebt")}</button>
          )}

          {paying && <DebtPayDialog balanceCents={debt.balanceCents} defaultCategoryId={debt.categoryId} vm={vm} onClose={() => setPaying(false)} />}
          {entry && <DebtEntryDialog kind={entry} vm={vm} onClose={() => setEntry(null)} />}
          {deleting && (
            <ConfirmDialog
              title={t("debts.deleteDebt")}
              message={t("debts.deleteConfirm")}
              confirmLabel={t("common.delete")}
              onClose={() => setDeleting(false)}
              onConfirm={async () => {
                const result = await vm.deleteDebt();
                setDeleting(false);
                if (result.ok) navigate("/debts");
                else setError(result.error);
              }}
            />
          )}
        </>
      )}
    </div>
  );
}
