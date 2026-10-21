import { Money } from "@finfamily/domain";
import { useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { css } from "../../../styled-system/css";
import type { AccountDto } from "../../data/types";
import { Modal } from "../../shared/Modal";
import { MoneyText } from "../../shared/MoneyText";
import { errorText, field, label, primaryButton, secondaryButton } from "../../shared/ui";
import { useLocale } from "../../shared/useLocale";
import type { useAccountsViewModel } from "./useAccountsViewModel";

interface Props {
  account: AccountDto;
  vm: ReturnType<typeof useAccountsViewModel>;
  onClose: () => void;
}

const asInput = (cents: number, locale: string) => Money.fromCents(cents).format(locale).replace(/[^\d.,-]/g, "").trim();

export function AccountEditDialog({ account, vm, onClose }: Props) {
  const { t } = useTranslation();
  const locale = useLocale();
  const [name, setName] = useState(account.name);
  const [initialText, setInitial] = useState(asInput(account.initialBalanceCents, locale));
  const [targetText, setTarget] = useState("");
  const [editError, setEditError] = useState<string | null>(null);
  const [adjustError, setAdjustError] = useState<string | null>(null);
  const preview = targetText.trim() === "" ? null : vm.previewAdjustment(account, targetText);

  async function onSave(event: FormEvent) {
    event.preventDefault();
    const result = await vm.updateAccount(account.id, { name, initialBalanceText: initialText });
    if (result.ok) onClose();
    else setEditError(result.error);
  }

  async function onAdjust() {
    const result = await vm.adjustBalance(account.id, targetText);
    if (result.ok) onClose();
    else setAdjustError(result.error);
  }

  return (
    <Modal open onClose={onClose} title={`${t("accounts.editTitle")} · ${account.name}`}>
      <div className={css({ display: "grid", gap: "5" })}>
        <form onSubmit={onSave} className={css({ display: "grid", gap: "3" })} aria-label={t("accounts.editTitle")}>
          <div>
            <label htmlFor="edit-account-name" className={label}>{t("accounts.name")}</label>
            <input id="edit-account-name" className={field} value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <label htmlFor="edit-account-initial" className={label}>{t("accounts.initialBalance")}</label>
            <input id="edit-account-initial" className={field} inputMode="decimal" value={initialText} onChange={(e) => setInitial(e.target.value)} />
            <p className={css({ color: "muted", fontSize: "xs", marginTop: "1" })}>{t("accounts.initialHint")}</p>
          </div>
          {editError && <p role="alert" className={errorText}>{t(`errors.${editError}`, { defaultValue: t("errors.unknown") })}</p>}
          <button type="submit" className={primaryButton}>{t("common.save")}</button>
        </form>

        <section aria-label={t("accounts.adjust.title")} className={css({ display: "grid", gap: "3", borderTopWidth: "1px", borderTopStyle: "solid", borderTopColor: "border", paddingTop: "4" })}>
          <h3 className={css({ fontWeight: "bold" })}>{t("accounts.adjust.title")}</h3>
          <p className={css({ color: "muted", fontSize: "sm" })}>
            {t("accounts.current")}: <MoneyText cents={account.balanceCents} />. {t("accounts.adjust.hint")}
          </p>
          <div>
            <label htmlFor="adjust-target" className={label}>{t("accounts.adjust.target")}</label>
            <input id="adjust-target" className={field} inputMode="decimal" placeholder="0,00" value={targetText} onChange={(e) => { setTarget(e.target.value); setAdjustError(null); }} />
          </div>
          {preview && preview.kind !== "invalid" && (
            <p data-testid="adjust-preview" className={css({ fontSize: "sm" })}>
              {preview.kind === "none"
                ? t("accounts.adjust.none")
                : t(`accounts.adjust.${preview.kind}`, { amount: Money.fromCents(preview.amountCents).format(locale) })}
            </p>
          )}
          {adjustError && <p role="alert" className={errorText}>{t(`errors.${adjustError}`, { defaultValue: t("errors.unknown") })}</p>}
          <button
            type="button"
            className={secondaryButton}
            disabled={!preview || preview.kind === "none" || preview.kind === "invalid"}
            onClick={onAdjust}
          >
            {t("accounts.adjust.button")}
          </button>
        </section>
      </div>
    </Modal>
  );
}
