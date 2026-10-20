import { Money } from "@finfamily/domain";
import { useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { css } from "../../../styled-system/css";
import type { BudgetCategoryDto } from "../../data/types";
import { Modal } from "../../shared/Modal";
import { dangerButton, errorText, field, label, primaryButton } from "../../shared/ui";
import { useLocale } from "../../shared/useLocale";
import type { useBudgetViewModel } from "./useBudgetViewModel";

interface Props {
  category: BudgetCategoryDto;
  onClose: () => void;
  vm: ReturnType<typeof useBudgetViewModel>;
}

export function BudgetDialog({ category, onClose, vm }: Props) {
  const { t } = useTranslation();
  const locale = useLocale();
  const [amountText, setAmountText] = useState(
    category.budgetCents > 0 ? Money.fromCents(category.budgetCents).format(locale).replace(/[^\d.,-]/g, "").trim() : "",
  );
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const result = await vm.setBudget(category.categoryId, amountText);
    if (result.ok) onClose();
    else setError(result.error);
  }

  return (
    <Modal open onClose={onClose} title={`${t("budget.setBudget")} · ${category.name}`}>
      <form onSubmit={onSubmit} className={css({ display: "grid", gap: "3" })}>
        <div>
          <label htmlFor="budget-amount" className={label}>{t("budget.amount")}</label>
          <input id="budget-amount" className={field} inputMode="decimal" placeholder="0,00" value={amountText} onChange={(e) => setAmountText(e.target.value)} />
          <p className={css({ color: "muted", fontSize: "xs", marginTop: "1" })}>{t("budget.amountHint")}</p>
        </div>
        {error && <p role="alert" className={errorText}>{t(`errors.${error}`, { defaultValue: t("errors.unknown") })}</p>}
        <button type="submit" className={primaryButton}>{t("common.save")}</button>
        <button
          type="button"
          className={dangerButton}
          onClick={async () => {
            await vm.archiveCategory(category.categoryId);
            onClose();
          }}
        >
          {t("budget.archive")}
        </button>
      </form>
    </Modal>
  );
}
