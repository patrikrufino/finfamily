import { addMonths } from "@finfamily/domain";
import { useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { css } from "../../../styled-system/css";
import { Modal } from "../../shared/Modal";
import { formatMonth } from "../../shared/format";
import { errorText, field, label, primaryButton } from "../../shared/ui";
import { useLocale } from "../../shared/useLocale";
import type { useStatementViewModel } from "./useStatementViewModel";

interface Props {
  /** First statement the new rule may start at: the one that is open today. */
  openMonth: string;
  closingDay: number;
  dueDay: number;
  vm: ReturnType<typeof useStatementViewModel>;
  onClose: () => void;
}

const CHOICES = 6;

export function RuleDialog({ openMonth, closingDay: currentClosing, dueDay: currentDue, vm, onClose }: Props) {
  const { t } = useTranslation();
  const locale = useLocale();
  const [fromMonth, setFromMonth] = useState(openMonth);
  const [closingDay, setClosing] = useState(String(currentClosing));
  const [dueDay, setDue] = useState(String(currentDue));
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const result = await vm.changeRule({ fromMonth, closingDay, dueDay });
    if (result.ok) onClose();
    else setError(result.error);
  }

  return (
    <Modal open onClose={onClose} title={t("cards.changeClosing")}>
      <form onSubmit={onSubmit} className={css({ display: "grid", gap: "3" })}>
        <div className={css({ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "3" })}>
          <div>
            <label htmlFor="rule-closing" className={label}>{t("cards.closingDay")}</label>
            <input id="rule-closing" className={field} inputMode="numeric" value={closingDay} onChange={(e) => setClosing(e.target.value)} />
          </div>
          <div>
            <label htmlFor="rule-due" className={label}>{t("cards.dueDay")}</label>
            <input id="rule-due" className={field} inputMode="numeric" value={dueDay} onChange={(e) => setDue(e.target.value)} />
          </div>
        </div>
        <div>
          <label htmlFor="rule-from" className={label}>{t("cards.validFrom")}</label>
          <select id="rule-from" className={field} value={fromMonth} onChange={(e) => setFromMonth(e.target.value)}>
            {Array.from({ length: CHOICES }, (_, i) => addMonths(openMonth, i)).map((m) => (
              <option key={m} value={m}>{formatMonth(m, locale)}</option>
            ))}
          </select>
          <p className={css({ color: "muted", fontSize: "xs", marginTop: "1" })}>{t("cards.ruleHint")}</p>
        </div>
        {error && <p role="alert" className={errorText}>{t(`errors.${error}`, { defaultValue: t("errors.unknown") })}</p>}
        <button type="submit" className={primaryButton}>{t("common.save")}</button>
      </form>
    </Modal>
  );
}
