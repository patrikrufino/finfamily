import { NavLink, Route, Routes } from "react-router";
import { useTranslation } from "react-i18next";
import { css } from "../styled-system/css";
import { PersonPicker } from "./features/people/PersonPicker";
import { ThemeToggle } from "./features/theme/ThemeToggle";
import { PlaceholderPage } from "./pages/PlaceholderPage";

const NAV_ITEMS = [
  { path: "/", key: "home" },
  { path: "/transactions", key: "transactions" },
  { path: "/budget", key: "budget" },
  { path: "/cards", key: "cards" },
  { path: "/debts", key: "debts" },
] as const;

const navLink = css({
  flex: 1,
  textAlign: "center",
  paddingBlock: "3",
  fontSize: "xs",
  color: "muted",
  "&[aria-current=page]": { color: "primary", fontWeight: "bold" },
});

export function App() {
  const { t } = useTranslation();

  return (
    <div className={css({ minHeight: "100dvh", background: "bg", color: "text", paddingBottom: "20" })}>
      <header
        className={css({
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: "2",
          padding: "4",
          flexWrap: "wrap",
        })}
      >
        <PersonPicker />
        <ThemeToggle />
      </header>

      <main className={css({ padding: "4" })}>
        <Routes>
          {NAV_ITEMS.map(({ path, key }) => (
            <Route key={key} path={path} element={<PlaceholderPage titleKey={`pages.${key}`} />} />
          ))}
        </Routes>
      </main>

      <NavLink
        to="/transactions"
        aria-label={t("actions.newTransaction")}
        className={css({
          position: "fixed",
          right: "4",
          bottom: "20",
          width: "14",
          height: "14",
          borderRadius: "full",
          background: "primary",
          color: "onPrimary",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: "2xl",
          boxShadow: "lg",
        })}
      >
        +
      </NavLink>

      <nav
        aria-label={t("nav.label")}
        className={css({
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          display: "flex",
          background: "surface",
          borderTop: "1px solid",
          borderColor: "border",
          paddingBottom: "env(safe-area-inset-bottom)",
        })}
      >
        {NAV_ITEMS.map(({ path, key }) => (
          <NavLink key={key} to={path} end={path === "/"} className={navLink}>
            {t(`nav.${key}`)}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
