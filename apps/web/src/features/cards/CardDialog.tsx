import { useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { css } from "../../../styled-system/css";
import { Modal } from "../../shared/Modal";
import { errorText, field, label, primaryButton } from "../../shared/ui";
import type { useCardsViewModel } from "./useCardsViewModel";

interface Props {
  open: boolean;
  onClose: () => void;
  vm: ReturnType<typeof useCardsViewModel>;
}

export function CardDialog({ open, onClose, vm }: Props) {
  const { t } = useTranslation();
  const [name, setName] = useState("");
  const [limitText, setLimit] = useState("");
  const [closingDay, setClosing] = useState("");
  const [dueDay, setDue] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const result = await vm.createCard({ name, limitText, closingDay, dueDay });
    if (result.ok) {
      setName(""); setLimit(""); setClosing(""); setDue(""); setError(null);
      onClose();
    } else {
      setError(result.error);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={t("cards.new")}>
      <form onSubmit={onSubmit} className={css({ display: "grid", gap: "3" })}>
        <div>
          <label htmlFor="card-name" className={label}>{t("cards.name")}</label>
          <input id="card-name" className={field} value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div>
          <label htmlFor="card-limit" className={label}>{t("cards.limit")}</label>
          <input id="card-limit" className={field} inputMode="decimal" placeholder="0,00" value={limitText} onChange={(e) => setLimit(e.target.value)} />
        </div>
        <div className={css({ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "3" })}>
          <div>
            <label htmlFor="card-closing" className={label}>{t("cards.closingDay")}</label>
            <input id="card-closing" className={field} inputMode="numeric" value={closingDay} onChange={(e) => setClosing(e.target.value)} />
          </div>
          <div>
            <label htmlFor="card-due" className={label}>{t("cards.dueDay")}</label>
            <input id="card-due" className={field} inputMode="numeric" value={dueDay} onChange={(e) => setDue(e.target.value)} />
          </div>
        </div>
        {error && <p role="alert" className={errorText}>{t(`errors.${error}`, { defaultValue: t("errors.unknown") })}</p>}
        <button type="submit" className={primaryButton}>{t("common.save")}</button>
      </form>
    </Modal>
  );
}
