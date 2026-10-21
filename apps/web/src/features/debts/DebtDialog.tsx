import { useQuery } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { css } from "../../../styled-system/css";
import { useRepository } from "../../data/RepositoryContext";
import { Modal } from "../../shared/Modal";
import { errorText, field, label, primaryButton } from "../../shared/ui";
import type { useDebtsViewModel } from "./useDebtsViewModel";

interface Props {
  open: boolean;
  onClose: () => void;
  vm: ReturnType<typeof useDebtsViewModel>;
}

export function DebtDialog({ open, onClose, vm }: Props) {
  const { t } = useTranslation();
  const repository = useRepository();
  const categories = useQuery({ queryKey: ["categories"], queryFn: () => repository.listCategories() }).data ?? [];
  const [creditor, setCreditor] = useState("");
  const [originalText, setOriginal] = useState("");
  const [openedOn, setOpenedOn] = useState(new Date().toLocaleDateString("sv-SE"));
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const result = await vm.createDebt({ creditor, originalText, openedOn, categoryId });
    if (result.ok) {
      setCreditor(""); setOriginal(""); setCategoryId(null); setError(null);
      onClose();
    } else {
      setError(result.error);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={t("debts.new")}>
      <form onSubmit={onSubmit} className={css({ display: "grid", gap: "3" })}>
        <div>
          <label htmlFor="debt-creditor" className={label}>{t("debts.creditor")}</label>
          <input id="debt-creditor" className={field} value={creditor} onChange={(e) => setCreditor(e.target.value)} />
        </div>
        <div>
          <label htmlFor="debt-original" className={label}>{t("debts.original")}</label>
          <input id="debt-original" className={field} inputMode="decimal" placeholder="0,00" value={originalText} onChange={(e) => setOriginal(e.target.value)} />
        </div>
        <div>
          <label htmlFor="debt-opened" className={label}>{t("debts.openedOn")}</label>
          <input id="debt-opened" type="date" className={field} value={openedOn} onChange={(e) => setOpenedOn(e.target.value)} />
        </div>
        {categories.length > 0 && (
          <div>
            <label htmlFor="debt-category" className={label}>{t("debts.category")}</label>
            <select id="debt-category" className={field} value={categoryId ?? ""} onChange={(e) => setCategoryId(e.target.value ? Number(e.target.value) : null)}>
              <option value="">{t("debts.noCategory")}</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
        )}
        {error && <p role="alert" className={errorText}>{t(`errors.${error}`, { defaultValue: t("errors.unknown") })}</p>}
        <button type="submit" className={primaryButton}>{t("common.save")}</button>
      </form>
    </Modal>
  );
}
