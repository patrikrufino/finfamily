import { Money } from "@finfamily/domain";
import { useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { css } from "../../../styled-system/css";
import type { RecurringDto } from "../../data/types";
import { Modal } from "../../shared/Modal";
import { errorText, field, label, primaryButton } from "../../shared/ui";
import { useLocale } from "../../shared/useLocale";
import type { useRecurringViewModel } from "./useRecurringViewModel";

interface Props {
  rule: RecurringDto;
  vm: ReturnType<typeof useRecurringViewModel>;
  onClose: () => void;
}

export function RuleEditDialog({ rule, vm, onClose }: Props) {
  const { t } = useTranslation();
  const locale = useLocale();
  const [amountText, setAmount] = useState(Money.fromCents(rule.amountCents).format(locale).replace(/[^\d.,-]/g, "").trim());
  const [description, setDescription] = useState(rule.description);
  const [endDate, setEndDate] = useState(rule.endDate ?? "");
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const result = await vm.editRule(rule.id, { amountText, description, endDate });
    if (result.ok) onClose();
    else setError(result.error);
  }

  return (
    <Modal open onClose={onClose} title={t("recurring.edit")}>
      <form onSubmit={onSubmit} className={css({ display: "grid", gap: "3" })}>
        <p className={css({ color: "muted", fontSize: "sm" })}>{t("recurring.editHint")}</p>
        <div>
          <label htmlFor="rule-description" className={label}>{t("recurring.description")}</label>
          <input id="rule-description" className={field} value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>
        <div>
          <label htmlFor="rule-amount" className={label}>{t("recurring.amount")}</label>
          <input id="rule-amount" className={field} inputMode="decimal" value={amountText} onChange={(e) => setAmount(e.target.value)} />
        </div>
        <div>
          <label htmlFor="rule-end" className={label}>{t("recurring.endDate")}</label>
          <input id="rule-end" type="date" className={field} value={endDate} onChange={(e) => setEndDate(e.target.value)} />
        </div>
        {error && <p role="alert" className={errorText}>{t(`errors.${error}`, { defaultValue: t("errors.unknown") })}</p>}
        <button type="submit" className={primaryButton}>{t("common.save")}</button>
      </form>
    </Modal>
  );
}
