import { useTranslation } from "react-i18next";
import { css } from "../../styled-system/css";

export function PlaceholderPage({ titleKey }: { titleKey: string }) {
  const { t } = useTranslation();
  return (
    <section>
      <h1 className={css({ fontSize: "xl", fontWeight: "bold" })}>{t(titleKey)}</h1>
      <p className={css({ color: "muted", marginTop: "2" })}>{t("pages.comingSoon")}</p>
    </section>
  );
}
