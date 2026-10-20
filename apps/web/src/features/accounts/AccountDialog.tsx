import { ACCOUNT_TYPES, type AccountType } from "@finfamily/domain";
import { useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { css } from "../../../styled-system/css";
import { Modal } from "../../shared/Modal";
import { errorText, field, label, primaryButton } from "../../shared/ui";
import { useAccountsViewModel } from "./useAccountsViewModel";

export function AccountDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  const vm = useAccountsViewModel();
  const [name, setName] = useState("");
  const [type, setType] = useState<AccountType>("checking");
  const [initialBalanceText, setInitial] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const result = await vm.createAccount({ name, type, initialBalanceText });
    if (result.ok) {
      setName("");
      setInitial("");
      setError(null);
      onClose();
    } else {
      setError(result.error);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={t("accounts.new")}>
      <form onSubmit={onSubmit} className={css({ display: "grid", gap: "3" })}>
        <div>
          <label htmlFor="account-name" className={label}>{t("accounts.name")}</label>
          <input id="account-name" className={field} value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div>
          <label htmlFor="account-type" className={label}>{t("accounts.type")}</label>
          <select id="account-type" className={field} value={type} onChange={(e) => setType(e.target.value as AccountType)}>
            {ACCOUNT_TYPES.map((value) => (
              <option key={value} value={value}>{t(`accounts.types.${value}`)}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="account-initial" className={label}>{t("accounts.initialBalance")}</label>
          <input id="account-initial" className={field} inputMode="decimal" placeholder="0,00" value={initialBalanceText} onChange={(e) => setInitial(e.target.value)} />
        </div>
        {error && <p role="alert" className={errorText}>{t(`errors.${error}`, { defaultValue: t("errors.unknown") })}</p>}
        <button type="submit" className={primaryButton}>{t("common.save")}</button>
      </form>
    </Modal>
  );
}
