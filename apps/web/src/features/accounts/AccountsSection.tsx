import { useState } from "react";
import { useTranslation } from "react-i18next";
import { css } from "../../../styled-system/css";
import { MoneyText } from "../../shared/MoneyText";
import { card, primaryButton, secondaryButton } from "../../shared/ui";
import { AccountDialog } from "./AccountDialog";
import { useAccountsViewModel } from "./useAccountsViewModel";

export function AccountsSection() {
  const { t } = useTranslation();
  const vm = useAccountsViewModel();
  const [creating, setCreating] = useState(false);

  return (
    <section aria-labelledby="accounts-title" className={css({ display: "grid", gap: "4" })}>
      <div className={card}>
        <p className={css({ color: "muted", fontSize: "sm" })}>{t("accounts.total")}</p>
        <p data-testid="total-balance" className={css({ fontSize: "3xl", fontWeight: "bold" })}>
          <MoneyText cents={vm.totalBalanceCents} />
        </p>
        <p className={css({ color: "muted", fontSize: "sm" })}>
          {t("accounts.projected")}: <MoneyText cents={vm.totalProjectedCents} />
        </p>
      </div>

      <div className={css({ display: "flex", justifyContent: "space-between", alignItems: "center" })}>
        <h2 id="accounts-title" className={css({ fontSize: "lg", fontWeight: "bold" })}>{t("accounts.title")}</h2>
        <button type="button" className={primaryButton} onClick={() => setCreating(true)}>{t("accounts.new")}</button>
      </div>

      {vm.isLoading ? (
        <p>{t("common.loading")}</p>
      ) : vm.accounts.length === 0 ? (
        <p className={css({ color: "muted" })}>{t("accounts.empty")}</p>
      ) : (
        <ul className={css({ display: "grid", gap: "2", listStyle: "none" })}>
          {vm.accounts.map((account) => (
            <li key={account.id} className={`${card} ${css({ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "2" })}`}>
              <div>
                <p className={css({ fontWeight: "bold" })}>{account.name}</p>
                <p className={css({ color: "muted", fontSize: "sm" })}>{t(`accounts.types.${account.type}`)}</p>
              </div>
              <div className={css({ textAlign: "right" })}>
                <MoneyText cents={account.balanceCents} className={css({ fontWeight: "bold" })} />
                <div>
                  <button
                    type="button"
                    className={`${secondaryButton} ${css({ paddingBlock: "1", paddingInline: "2", fontSize: "xs", marginTop: "1" })}`}
                    aria-label={`${t("accounts.archive")} ${account.name}`}
                    onClick={() => vm.archiveAccount(account.id)}
                  >
                    {t("accounts.archive")}
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      <AccountDialog open={creating} onClose={() => setCreating(false)} />
    </section>
  );
}
