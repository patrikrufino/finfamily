import { useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { css } from "../../../styled-system/css";
import { Modal } from "../../shared/Modal";
import { errorText, field, label, primaryButton } from "../../shared/ui";
import type { useDebtViewModel } from "./useDebtViewModel";

interface Props {
  kind: "interest" | "discount";
  vm: ReturnType<typeof useDebtViewModel>;
  onClose: () => void;
}

/** Posts interest (raises the balance) or a discount (lowers it); neither moves money. */
export function DebtEntryDialog({ kind, vm, onClose }: Props) {
  const { t } = useTranslation();
  const [amountText, setAmount] = useState("");
  const [date, setDate] = useState(new Date().toLocaleDateString("sv-SE"));
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const input = { amountText, date, note };
    const result = kind === "interest" ? await vm.addInterest(input) : await vm.addDiscount(input);
    if (result.ok) onClose();
    else setError(result.error);
  }

  return (
    <Modal open onClose={onClose} title={kind === "interest" ? t("debts.postInterest") : t("debts.giveDiscount")}>
      <form onSubmit={onSubmit} className={css({ display: "grid", gap: "3" })}>
        <p className={css({ color: "muted", fontSize: "sm" })}>{kind === "interest" ? t("debts.hintInterest") : t("debts.hintDiscount")}</p>
        <div>
          <label htmlFor="entry-amount" className={label}>{t("debts.amount")}</label>
          <input id="entry-amount" className={field} inputMode="decimal" placeholder="0,00" value={amountText} onChange={(e) => setAmount(e.target.value)} />
        </div>
        <div>
          <label htmlFor="entry-date" className={label}>{t("debts.date")}</label>
          <input id="entry-date" type="date" className={field} value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div>
          <label htmlFor="entry-note" className={label}>{t("debts.note")}</label>
          <input id="entry-note" className={field} value={note} onChange={(e) => setNote(e.target.value)} />
        </div>
        {error && <p role="alert" className={errorText}>{t(`errors.${error}`, { defaultValue: t("errors.unknown") })}</p>}
        <button type="submit" className={primaryButton}>{t("common.save")}</button>
      </form>
    </Modal>
  );
}
