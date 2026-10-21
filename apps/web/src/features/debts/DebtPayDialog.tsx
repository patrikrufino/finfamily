import { Money } from "@finfamily/domain";
import { useQuery } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { css } from "../../../styled-system/css";
import { useRepository } from "../../data/RepositoryContext";
import { Modal } from "../../shared/Modal";
import { categoryLabel } from "../categories/CategoryIcon";
import { errorText, field, label, primaryButton, secondaryButton } from "../../shared/ui";
import { useLocale } from "../../shared/useLocale";
import type { useDebtViewModel } from "./useDebtViewModel";

interface Props {
  balanceCents: number;
  defaultCategoryId: number | null;
  vm: ReturnType<typeof useDebtViewModel>;
  onClose: () => void;
}

const asInput = (cents: number, locale: string) => Money.fromCents(cents).format(locale).replace(/[^\d.,-]/g, "").trim();

/** A payment (baixa), partial or total: an expense on the chosen account that lowers the balance. */
export function DebtPayDialog({ balanceCents, defaultCategoryId, vm, onClose }: Props) {
  const { t } = useTranslation();
  const locale = useLocale();
  const repository = useRepository();
  const accounts = useQuery({ queryKey: ["accounts"], queryFn: () => repository.listAccounts() }).data ?? [];
  const categories = useQuery({ queryKey: ["categories"], queryFn: () => repository.listCategories() }).data ?? [];
  const [accountId, setAccountId] = useState<number | null>(null);
  const [amountText, setAmount] = useState(asInput(balanceCents, locale));
  const [date, setDate] = useState(new Date().toLocaleDateString("sv-SE"));
  const [categoryId, setCategoryId] = useState<number | null>(defaultCategoryId);
  const [error, setError] = useState<string | null>(null);
  const selected = accountId ?? accounts[0]?.id ?? null;

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (selected === null) return setError("account_required");
    const result = await vm.pay({ accountId: selected, amountText, date, categoryId });
    if (result.ok) onClose();
    else setError(result.error);
  }

  return (
    <Modal open onClose={onClose} title={t("debts.pay")}>
      <form onSubmit={onSubmit} className={css({ display: "grid", gap: "3" })}>
        <p className={css({ color: "muted", fontSize: "sm" })}>{t("debts.hintPay")}</p>
        <div>
          <label htmlFor="debt-pay-account" className={label}>{t("debts.payFrom")}</label>
          <select id="debt-pay-account" className={field} value={selected ?? ""} onChange={(e) => setAccountId(Number(e.target.value))}>
            {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="debt-pay-amount" className={label}>{t("debts.amount")}</label>
          <input id="debt-pay-amount" className={field} inputMode="decimal" value={amountText} onChange={(e) => setAmount(e.target.value)} />
          <button type="button" className={`${secondaryButton} ${css({ marginTop: "2", paddingBlock: "1", fontSize: "sm" })}`} onClick={() => setAmount(asInput(balanceCents, locale))}>
            {t("debts.payAll")}
          </button>
        </div>
        <div>
          <label htmlFor="debt-pay-date" className={label}>{t("debts.date")}</label>
          <input id="debt-pay-date" type="date" className={field} value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        {categories.length > 0 && (
          <div>
            <label htmlFor="debt-pay-category" className={label}>{t("debts.category")}</label>
            <select id="debt-pay-category" className={field} value={categoryId ?? ""} onChange={(e) => setCategoryId(e.target.value ? Number(e.target.value) : null)}>
              <option value="">{t("debts.noCategory")}</option>
              {categories.filter((c) => c.kind === "expense").map((c) => <option key={c.id} value={c.id}>{categoryLabel(c)}</option>)}
            </select>
          </div>
        )}
        {error && <p role="alert" className={errorText}>{t(`errors.${error}`, { defaultValue: t("errors.unknown") })}</p>}
        <button type="submit" className={primaryButton}>{t("common.save")}</button>
      </form>
    </Modal>
  );
}
