import { useTranslation } from "react-i18next";
import { css } from "../../styled-system/css";
import { AccountsSection } from "../features/accounts/AccountsSection";

export function HomePage() {
  const { t } = useTranslation();
  return (
    <div className={css({ display: "grid", gap: "4" })}>
      <h1 className={css({ fontSize: "xl", fontWeight: "bold" })}>{t("pages.home")}</h1>
      <AccountsSection />
    </div>
  );
}
