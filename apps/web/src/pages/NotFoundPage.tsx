import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { css } from "../../styled-system/css";

export function NotFoundPage() {
  const { t } = useTranslation();
  return (
    <section className={css({ display: "grid", gap: "3" })}>
      <h1 className={css({ fontSize: "xl", fontWeight: "bold" })}>{t("notFound.title")}</h1>
      <Link to="/" className={css({ color: "primary" })}>‹ {t("notFound.back")}</Link>
    </section>
  );
}
