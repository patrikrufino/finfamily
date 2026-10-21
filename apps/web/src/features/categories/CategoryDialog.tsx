import { useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { css } from "../../../styled-system/css";
import type { CategoryDto } from "../../data/types";
import { Modal } from "../../shared/Modal";
import { dangerButton, errorText, field, label, primaryButton } from "../../shared/ui";
import { IconPicker } from "./IconPicker";
import type { useCategoriesViewModel } from "./useCategoriesViewModel";

interface Props {
  /** Editing an existing category, or creating one of `kind`. */
  category?: CategoryDto;
  kind: CategoryDto["kind"];
  vm: ReturnType<typeof useCategoriesViewModel>;
  onClose: () => void;
}

export function CategoryDialog({ category, kind, vm, onClose }: Props) {
  const { t } = useTranslation();
  const [name, setName] = useState(category?.name ?? "");
  const [icon, setIcon] = useState<string | null>(category?.icon ?? null);
  const [error, setError] = useState<string | null>(null);
  const shownKind = category?.kind ?? kind;

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const result = category ? await vm.updateCategory(category.id, { name, icon }) : await vm.createCategory({ name, kind, icon });
    if (result.ok) onClose();
    else setError(result.error);
  }

  return (
    <Modal open onClose={onClose} title={category ? t("categories.edit") : t("categories.new")}>
      <form onSubmit={onSubmit} className={css({ display: "grid", gap: "3" })}>
        <p className={css({ color: "muted", fontSize: "sm" })}>
          {shownKind === "income" ? t("categories.kindIncome") : t("categories.kindExpense")}
          {category ? ` · ${t("categories.kindFixed")}` : ""}
        </p>
        <div>
          <label htmlFor="category-name" className={label}>{t("categories.name")}</label>
          <input id="category-name" className={field} value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <IconPicker value={icon} onChange={setIcon} />
        {error && <p role="alert" className={errorText}>{t(`errors.${error}`, { defaultValue: t("errors.unknown") })}</p>}
        <button type="submit" className={primaryButton}>{t("common.save")}</button>
        {category && (
          <button
            type="button"
            className={dangerButton}
            onClick={async () => {
              await vm.archiveCategory(category.id);
              onClose();
            }}
          >
            {t("categories.archive")}
          </button>
        )}
      </form>
    </Modal>
  );
}
