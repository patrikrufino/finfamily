import { useTranslation } from "react-i18next";
import { css } from "../../styled-system/css";
import { AccountsSection, TotalBalanceCard } from "../features/accounts/AccountsSection";
import { useAccountsViewModel } from "../features/accounts/useAccountsViewModel";
import { DashboardSection } from "../features/dashboard/DashboardSection";

export function HomePage() {
  const { t } = useTranslation();
  const accounts = useAccountsViewModel();
  return (
    <div className={css({ display: "grid", gap: "4" })}>
      <h1 className={css({ fontSize: "xl", fontWeight: "bold" })}>{t("pages.home")}</h1>
      <TotalBalanceCard vm={accounts} />
      <DashboardSection />
      <AccountsSection showTotal={false} />
    </div>
  );
}
