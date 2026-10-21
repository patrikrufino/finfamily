import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate, useParams } from "react-router";
import { css } from "../../styled-system/css";
import { useRepository } from "../data/RepositoryContext";
import type { PlanInstallmentDto } from "../data/types";
import { AnticipateDialog } from "../features/installments/AnticipateDialog";
import { EditInstallmentDialog } from "../features/installments/EditInstallmentDialog";
import { usePlanViewModel } from "../features/installments/usePlanViewModel";
import { ConfirmDialog } from "../shared/ConfirmDialog";
import { formatShortDate } from "../shared/format";
import { MoneyText } from "../shared/MoneyText";
import { card, dangerButton, primaryButton, secondaryButton } from "../shared/ui";
import { useLocale } from "../shared/useLocale";

export function PlanDetailPage() {
  const { t } = useTranslation();
  const locale = useLocale();
  const navigate = useNavigate();
  const repository = useRepository();
  const planId = Number(useParams().id);
  const vm = usePlanViewModel(planId);
  const accounts = useQuery({ queryKey: ["accounts"], queryFn: () => repository.listAccounts() }).data ?? [];
  const cards = useQuery({ queryKey: ["cards"], queryFn: () => repository.listCards() }).data ?? [];
  const [editing, setEditing] = useState<PlanInstallmentDto | null>(null);
  const [anticipating, setAnticipating] = useState(false);
  const [canceling, setCanceling] = useState(false);
  const plan = vm.plan;

  const sourceName = plan
    ? plan.cardId !== null
      ? cards.find((c) => c.id === plan.cardId)?.name
      : accounts.find((a) => a.id === plan.accountId)?.name
    : undefined;

  return (
    <div className={css({ display: "grid", gap: "4" })}>
      <Link to="/installments" className={css({ color: "primary", fontSize: "sm" })}>‹ {t("installments.title")}</Link>

      {plan && (
        <>
          <h1 className={css({ fontSize: "xl", fontWeight: "bold" })}>{plan.description}</h1>

          <section className={`${card} ${css({ display: "grid", gap: "1" })}`} aria-label={plan.description}>
            <p data-testid="plan-progress" className={css({ fontWeight: "bold" })}>
              {t("installments.progress", { paid: plan.paidCount, count: plan.count })}
            </p>
            <p className={css({ fontSize: "sm", color: "muted" })}>
              {t("installments.paid")}: <MoneyText cents={plan.paidCents} /> · {t("installments.remaining")}: <MoneyText cents={plan.remainingCents} />
            </p>
            {sourceName && <p className={css({ fontSize: "sm", color: "muted" })}>{t("installments.payer")}: {sourceName}</p>}
            <div className={css({ display: "flex", gap: "2", flexWrap: "wrap", marginTop: "2" })}>
              {vm.anticipable.length > 0 && (
                <button type="button" className={primaryButton} onClick={() => setAnticipating(true)}>{t("installments.anticipate")}</button>
              )}
              {plan.remainingCount > 0 && (
                <button type="button" className={dangerButton} onClick={() => setCanceling(true)}>{t("installments.cancel")}</button>
              )}
            </div>
          </section>

          <section aria-labelledby="installments-title" className={css({ display: "grid", gap: "2" })}>
            <h2 id="installments-title" className={css({ fontWeight: "bold" })}>{t("installments.list")}</h2>
            <ul className={css({ display: "grid", gap: "2", listStyle: "none" })}>
              {plan.installments.map((i) => (
                <li key={i.id} className={`${card} ${css({ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "2" })}`}>
                  <span>
                    <span className={css({ display: "block", fontWeight: "bold" })}>
                      {i.installmentNumber === null ? t("installments.anticipation") : t("installments.badge", { n: i.installmentNumber, count: plan.count })}
                    </span>
                    <span className={css({ color: "muted", fontSize: "sm" })}>
                      {formatShortDate(i.date, locale)} · {t(`installments.status.${i.status}`)}
                    </span>
                  </span>
                  <span className={css({ display: "flex", alignItems: "center", gap: "2" })}>
                    <MoneyText cents={i.amountCents} className={css({ fontWeight: "bold" })} />
                    <button
                      type="button"
                      className={`${secondaryButton} ${css({ paddingBlock: "1", paddingInline: "2", fontSize: "xs" })}`}
                      aria-label={`${t("installments.editInstallment")} ${i.installmentNumber === null ? t("installments.anticipation") : t("installments.badge", { n: i.installmentNumber, count: plan.count })}`}
                      onClick={() => setEditing(i)}
                    >
                      {t("accounts.edit")}
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          </section>

          {editing && <EditInstallmentDialog installment={editing} vm={vm} onClose={() => setEditing(null)} />}
          {anticipating && <AnticipateDialog vm={vm} onClose={() => setAnticipating(false)} />}
          {canceling && (
            <ConfirmDialog
              title={t("installments.cancel")}
              message={t("installments.cancelConfirm")}
              confirmLabel={t("installments.confirm")}
              onClose={() => setCanceling(false)}
              onConfirm={async () => {
                await vm.cancel();
                setCanceling(false);
                if (plan.paidCount === 0 && plan.installments.every((i) => i.status === "scheduled")) navigate("/installments");
              }}
            />
          )}
        </>
      )}
    </div>
  );
}
