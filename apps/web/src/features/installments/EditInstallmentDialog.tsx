import { Money } from "@finfamily/domain";
import { useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { css } from "../../../styled-system/css";
import type { PlanInstallmentDto } from "../../data/types";
import { Modal } from "../../shared/Modal";
import { errorText, field, label, primaryButton } from "../../shared/ui";
import { useLocale } from "../../shared/useLocale";
import type { usePlanViewModel } from "./usePlanViewModel";

interface Props {
  installment: PlanInstallmentDto;
  vm: ReturnType<typeof usePlanViewModel>;
  onClose: () => void;
}

export function EditInstallmentDialog({ installment, vm, onClose }: Props) {
  const { t } = useTranslation();
  const locale = useLocale();
  const [amountText, setAmount] = useState(Money.fromCents(installment.amountCents).format(locale).replace(/[^\d.,-]/g, "").trim());
  const [date, setDate] = useState(installment.date);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const result = await vm.editInstallment(installment, { amountText, date });
    if (result.ok) onClose();
    else setError(result.error);
  }

  return (
    <Modal open onClose={onClose} title={t("installments.editInstallment")}>
      <form onSubmit={onSubmit} className={css({ display: "grid", gap: "3" })}>
        <div>
          <label htmlFor="inst-amount" className={label}>{t("installments.amount")}</label>
          <input id="inst-amount" className={field} inputMode="decimal" value={amountText} onChange={(e) => setAmount(e.target.value)} />
        </div>
        <div>
          <label htmlFor="inst-date" className={label}>{t("installments.date")}</label>
          <input id="inst-date" type="date" className={field} value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        {error && <p role="alert" className={errorText}>{t(`errors.${error}`, { defaultValue: t("errors.unknown") })}</p>}
        <button type="submit" className={primaryButton}>{t("common.save")}</button>
      </form>
    </Modal>
  );
}
