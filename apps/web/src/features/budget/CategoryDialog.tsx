import { CATEGORY_KINDS, type CategoryKind } from "@finfamily/domain";
import { useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { css } from "../../../styled-system/css";
import { Modal } from "../../shared/Modal";
import { errorText, field, label, primaryButton } from "../../shared/ui";
import type { useBudgetViewModel } from "./useBudgetViewModel";

interface Props {
  open: boolean;
  onClose: () => void;
  vm: ReturnType<typeof useBudgetViewModel>;
}

export function CategoryDialog({ open, onClose, vm }: Props) {
  const { t } = useTranslation();
  const [name, setName] = useState("");
  const [kind, setKind] = useState<CategoryKind>("expense");
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const result = await vm.createCategory({ name, kind });
    if (result.ok) {
      setName("");
      setError(null);
      onClose();
    } else {
      setError(result.error);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={t("budget.newCategory")}>
      <form onSubmit={onSubmit} className={css({ display: "grid", gap: "3" })}>
        <div>
          <label htmlFor="category-name" className={label}>{t("budget.categoryName")}</label>
          <input id="category-name" className={field} value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div>
          <label htmlFor="category-kind" className={label}>{t("budget.categoryKind")}</label>
          <select id="category-kind" className={field} value={kind} onChange={(e) => setKind(e.target.value as CategoryKind)}>
            {CATEGORY_KINDS.map((value) => (
              <option key={value} value={value}>{t(`budget.kinds.${value}`)}</option>
            ))}
          </select>
        </div>
        {error && <p role="alert" className={errorText}>{t(`errors.${error}`, { defaultValue: t("errors.unknown") })}</p>}
        <button type="submit" className={primaryButton}>{t("common.save")}</button>
      </form>
    </Modal>
  );
}
