import { TRANSACTION_KINDS } from "@finfamily/domain";
import type { FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { css } from "../../../styled-system/css";
import type { TransactionDto } from "../../data/types";
import { Modal } from "../../shared/Modal";
import { dangerButton, errorText, field, label, primaryButton } from "../../shared/ui";
import { useTransactionFormViewModel } from "./useTransactionFormViewModel";

interface Props {
  open: boolean;
  onClose: () => void;
  transaction?: TransactionDto;
  onDelete?: () => void;
}

function TransactionForm({ transaction, onClose, onDelete }: Pick<Props, "transaction" | "onClose" | "onDelete">) {
  const { t } = useTranslation();
  const vm = useTransactionFormViewModel({ transaction });
  const { values } = vm;

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (await vm.submit()) onClose();
  }

  return (
    <form onSubmit={onSubmit} className={css({ display: "grid", gap: "3" })}>
      <div role="radiogroup" aria-label={t("transactions.kind")} className={css({ display: "flex", gap: "2" })}>
        {TRANSACTION_KINDS.map((kind) => (
          <label
            key={kind}
            className={css({
              flex: 1,
              textAlign: "center",
              padding: "2",
              borderRadius: "md",
              border: "1px solid",
              borderColor: "border",
              cursor: "pointer",
              "&:has(input:checked)": { background: "primary", color: "onPrimary" },
            })}
          >
            <input
              type="radio"
              name="kind"
              value={kind}
              checked={values.kind === kind}
              onChange={() => vm.setField("kind", kind)}
              className={css({ position: "absolute", opacity: 0, pointerEvents: "none" })}
            />
            {t(`transactions.${kind}`)}
          </label>
        ))}
      </div>

      <div>
        <label htmlFor="tx-amount" className={label}>{t("transactions.amount")}</label>
        <input id="tx-amount" className={field} inputMode="decimal" placeholder="0,00" value={values.amountText} onChange={(e) => vm.setField("amountText", e.target.value)} />
      </div>
      <div>
        <label htmlFor="tx-date" className={label}>{t("transactions.date")}</label>
        <input id="tx-date" type="date" className={field} value={values.date} onChange={(e) => vm.setField("date", e.target.value)} />
      </div>
      <div>
        <label htmlFor="tx-account" className={label}>
          {values.kind === "expense" && vm.cards.length > 0 ? t("transactions.accountOrCard") : t("transactions.account")}
        </label>
        <select
          id="tx-account"
          className={field}
          value={values.cardId !== null ? `c:${values.cardId}` : `a:${values.accountId ?? ""}`}
          onChange={(e) => {
            const [type, id] = e.target.value.split(":");
            vm.setSource({ type: type === "c" ? "card" : "account", id: Number(id) });
          }}
        >
          <optgroup label={t("accounts.title")}>
            {vm.accounts.map((a) => <option key={a.id} value={`a:${a.id}`}>{a.name}</option>)}
          </optgroup>
          {values.kind === "expense" && vm.cards.length > 0 && (
            <optgroup label={t("cards.title")}>
              {vm.cards.map((c) => <option key={c.id} value={`c:${c.id}`}>{c.name}</option>)}
            </optgroup>
          )}
        </select>
      </div>
      {values.kind === "transfer" && (
        <div>
          <label htmlFor="tx-to-account" className={label}>{t("transactions.toAccount")}</label>
          <select id="tx-to-account" className={field} value={values.toAccountId ?? ""} onChange={(e) => vm.setField("toAccountId", e.target.value ? Number(e.target.value) : null)}>
            <option value="" />
            {vm.accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </div>
      )}
      {vm.categories.length > 0 && (
        <div>
          <label htmlFor="tx-category" className={label}>{t("transactions.category")}</label>
          <select id="tx-category" className={field} value={values.categoryId ?? ""} onChange={(e) => vm.setField("categoryId", e.target.value ? Number(e.target.value) : null)}>
            <option value="">{t("transactions.noCategory")}</option>
            {vm.categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
      )}
      <div>
        <label htmlFor="tx-description" className={label}>{t("transactions.description")}</label>
        <input id="tx-description" className={field} value={values.description} onChange={(e) => vm.setField("description", e.target.value)} />
      </div>
      <label className={css({ display: "flex", alignItems: "center", gap: "2" })}>
        <input type="checkbox" checked={values.settled} onChange={(e) => vm.setField("settled", e.target.checked)} />
        {t("transactions.settled")}
      </label>

      {vm.errors.length > 0 && (
        <ul role="alert" className={css({ listStyle: "none" })}>
          {vm.errors.map((code) => <li key={code} className={errorText}>{t(`errors.${code}`)}</li>)}
        </ul>
      )}
      <button type="submit" disabled={vm.isSaving} className={primaryButton}>{t("common.save")}</button>
      {onDelete && (
        <button type="button" className={dangerButton} onClick={onDelete}>{t("common.delete")}</button>
      )}
    </form>
  );
}

export function TransactionDialog({ open, onClose, transaction, onDelete }: Props) {
  const { t } = useTranslation();
  return (
    <Modal open={open} onClose={onClose} title={transaction ? t("transactions.edit") : t("transactions.new")}>
      <TransactionForm transaction={transaction} onClose={onClose} onDelete={onDelete} />
    </Modal>
  );
}
