import { useState } from "react";
import { useTranslation } from "react-i18next";
import { css } from "../../../styled-system/css";
import { MoneyText } from "../../shared/MoneyText";
import { card, primaryButton, secondaryButton } from "../../shared/ui";
import type { AccountDto } from "../../data/types";
import { AccountDialog } from "./AccountDialog";
import { AccountEditDialog } from "./AccountEditDialog";
import { useAccountsViewModel } from "./useAccountsViewModel";

/** Total settled balance and the projection that includes scheduled items. */
export function TotalBalanceCard({ vm }: { vm: ReturnType<typeof useAccountsViewModel> }) {
  const { t } = useTranslation();
  return (
    <div className={card}>
      <p className={css({ color: "muted", fontSize: "sm" })}>{t("accounts.total")}</p>
      <p data-testid="total-balance" className={css({ fontSize: "3xl", fontWeight: "bold" })}>
          <MoneyText cents={vm.totalBalanceCents} />
        </p>
    </div>
  );
}

export function AccountsSection({ showTotal = true }: { showTotal?: boolean }) {
  const { t } = useTranslation();
  const vm = useAccountsViewModel();
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<AccountDto | null>(null);

  return (
    <section aria-labelledby="accounts-title" className={css({ display: "grid", gap: "4" })}>
      {showTotal && <TotalBalanceCard vm={vm} />}

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
                <div className={css({ display: "flex", gap: "1", justifyContent: "flex-end", marginTop: "1" })}>
                  <button
                    type="button"
                    className={`${secondaryButton} ${css({ paddingBlock: "1", paddingInline: "2", fontSize: "xs" })}`}
                    aria-label={`${t("accounts.edit")} ${account.name}`}
                    onClick={() => setEditing(account)}
                  >
                    {t("accounts.edit")}
                  </button>
                  <button
                    type="button"
                    className={`${secondaryButton} ${css({ paddingBlock: "1", paddingInline: "2", fontSize: "xs" })}`}
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
      {editing && <AccountEditDialog account={editing} vm={vm} onClose={() => setEditing(null)} />}
    </section>
  );
}
