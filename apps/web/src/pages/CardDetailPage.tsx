import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useParams } from "react-router";
import { css } from "../../styled-system/css";
import type { TransactionDto } from "../data/types";
import { PayStatementDialog } from "../features/cards/PayStatementDialog";
import { RuleDialog } from "../features/cards/RuleDialog";
import { useCardsViewModel } from "../features/cards/useCardsViewModel";
import { useStatementViewModel } from "../features/cards/useStatementViewModel";
import { formatShortDate } from "../shared/format";
import { MoneyText } from "../shared/MoneyText";
import { MonthNavigator } from "../shared/MonthNavigator";
import { card, dangerButton, primaryButton, secondaryButton } from "../shared/ui";
import { useLocale } from "../shared/useLocale";

export function CardDetailPage() {
  const { t } = useTranslation();
  const locale = useLocale();
  const cardId = Number(useParams().id);
  const cards = useCardsViewModel();
  const vm = useStatementViewModel(cardId);
  const [paying, setPaying] = useState(false);
  const [editingRule, setEditingRule] = useState(false);
  const summary = cards.cards.find((c) => c.id === cardId);
  const s = vm.statement;

  const row = (tx: TransactionDto, title: string, removable: boolean) => (
    <li key={tx.id} className={`${card} ${css({ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "2" })}`}>
      <span>
        <span className={css({ display: "block", fontWeight: "bold" })}>{title}</span>
        <span className={css({ color: "muted", fontSize: "sm" })}>{formatShortDate(tx.date, locale)}</span>
      </span>
      <span className={css({ display: "flex", alignItems: "center", gap: "2" })}>
        <MoneyText cents={tx.amountCents} className={css({ fontWeight: "bold" })} />
        {removable && (
          <button
            type="button"
            className={`${dangerButton} ${css({ paddingBlock: "1", paddingInline: "2", fontSize: "xs" })}`}
            aria-label={`${t("cards.removePayment")} ${title}`}
            onClick={() => vm.removeTransaction(tx.id)}
          >
            {t("cards.removePayment")}
          </button>
        )}
      </span>
    </li>
  );

  return (
    <div className={css({ display: "grid", gap: "4" })}>
      <Link to="/cards" className={css({ color: "primary", fontSize: "sm" })}>‹ {t("cards.back")}</Link>
      <h1 className={css({ fontSize: "xl", fontWeight: "bold" })}>{summary?.name ?? t("pages.cards")}</h1>

      {s && (
        <>
          <MonthNavigator month={s.month} onPrevious={vm.previousMonth} onNext={vm.nextMonth} />

          <section aria-label={t("cards.openStatement")} className={`${card} ${css({ display: "grid", gap: "2" })}`}>
            <div className={css({ display: "flex", justifyContent: "space-between", alignItems: "center" })}>
              <span data-testid="statement-status" className={css({ fontWeight: "bold", color: s.status === "paid" ? "primary" : "text" })}>
                {t(`cards.status.${s.status}`)}
              </span>
              <span className={css({ color: "muted", fontSize: "sm" })}>{t("cards.dueOn", { date: formatShortDate(s.dueDate, locale) })}</span>
            </div>
            <p className={css({ color: "muted", fontSize: "sm" })}>
              {t("cards.period")}: {formatShortDate(s.start, locale)} – {formatShortDate(s.end, locale)}
            </p>
            <p data-testid="statement-total" className={css({ fontSize: "3xl", fontWeight: "bold" })}>
              <MoneyText cents={s.totalCents} />
            </p>
            <p className={css({ fontSize: "sm", color: "muted" })}>
              {t("cards.paid")}: <MoneyText cents={s.paidCents} /> · {t("cards.remaining")}: <MoneyText cents={Math.max(s.remainingCents, 0)} />
              {s.feesCents > 0 && <> · {t("cards.fees")}: <MoneyText cents={s.feesCents} /></>}
            </p>
            <div className={css({ display: "flex", gap: "2", flexWrap: "wrap" })}>
              {s.totalCents > 0 && s.remainingCents > 0 && (
                <button type="button" className={primaryButton} onClick={() => setPaying(true)}>{t("cards.pay")}</button>
              )}
              <button type="button" className={secondaryButton} onClick={() => setEditingRule(true)}>{t("cards.changeClosing")}</button>
            </div>
          </section>

          <section aria-labelledby="purchases-title" className={css({ display: "grid", gap: "2" })}>
            <h2 id="purchases-title" className={css({ fontWeight: "bold" })}>{t("cards.purchases")}</h2>
            {s.purchases.length === 0 ? (
              <p className={css({ color: "muted" })}>{t("cards.noPurchases")}</p>
            ) : (
              <ul className={css({ display: "grid", gap: "2", listStyle: "none" })}>
                {s.purchases.map((tx) => row(tx, tx.description || t("transactions.expense"), false))}
              </ul>
            )}
          </section>

          {s.payments.length > 0 && (
            <section aria-labelledby="payments-title" className={css({ display: "grid", gap: "2" })}>
              <h2 id="payments-title" className={css({ fontWeight: "bold" })}>{t("cards.payments")}</h2>
              <ul className={css({ display: "grid", gap: "2", listStyle: "none" })}>
                {s.payments.map((tx) => row(tx, t("cards.statementPayment"), true))}
              </ul>
            </section>
          )}

          {s.fees.length > 0 && (
            <section aria-labelledby="fees-title" className={css({ display: "grid", gap: "2" })}>
              <h2 id="fees-title" className={css({ fontWeight: "bold" })}>{t("cards.feeItems")}</h2>
              <ul className={css({ display: "grid", gap: "2", listStyle: "none" })}>
                {s.fees.map((tx) => row(tx, t(`cards.fee.${tx.feeKind ?? "interest"}`), true))}
              </ul>
            </section>
          )}

          {paying && <PayStatementDialog statement={s} vm={vm} onClose={() => setPaying(false)} />}
          {editingRule && summary && (
            <RuleDialog
              openMonth={summary.openStatementMonth}
              closingDay={summary.closingDay}
              dueDay={summary.dueDay}
              vm={vm}
              onClose={() => setEditingRule(false)}
            />
          )}
        </>
      )}
    </div>
  );
}
