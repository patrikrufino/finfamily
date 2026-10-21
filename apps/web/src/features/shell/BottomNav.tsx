import type { ReactElement } from "react";
import { useTranslation } from "react-i18next";
import { NavLink } from "react-router";
import { css } from "../../../styled-system/css";
import { BankIcon, CardIcon, HomeIcon, PieIcon, ReceiptIcon } from "../../shared/icons";


const ITEMS: { path: string; key: string; icon: ReactElement }[] = [
  { path: "/", key: "home", icon: <HomeIcon /> },
  { path: "/transactions", key: "transactions", icon: <ReceiptIcon /> },
  { path: "/budget", key: "budget", icon: <PieIcon /> },
  { path: "/cards", key: "cards", icon: <CardIcon /> },
  { path: "/debts", key: "debts", icon: <BankIcon /> },
];

// Panda only generates CSS for literal values, so both states are written out.
const bar = css({
  position: "fixed",
  bottom: 0,
  left: 0,
  right: 0,
  zIndex: 5,
  display: "grid",
  gridTemplateColumns: "repeat(5, 1fr)",
  background: "surface",
  borderTopWidth: "1px",
  borderTopStyle: "solid",
  borderTopColor: "border",
  paddingBottom: "env(safe-area-inset-bottom)",
});

const itemBase = css({
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  gap: "1",
  minHeight: "64px",
  minWidth: 0,
  fontSize: "11px",
  lineHeight: "1",
  textDecoration: "none",
  touchAction: "manipulation",
  WebkitTapHighlightColor: "transparent",
  "&:active": { background: "bg" },
  "&:focus-visible": { outline: "2px solid", outlineColor: "primary", outlineOffset: "-4px" },
});
const itemIdle = css({ color: "muted", fontWeight: "500" });
const itemActive = css({ color: "primary", fontWeight: "700" });

const pillBase = css({
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  width: "14",
  height: "8",
  borderRadius: "full",
});
const pillIdle = css({ background: "transparent" });
const pillActive = css({ background: "primary/15" });

const label = css({ maxWidth: "100%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" });

export function BottomNav() {
  const { t } = useTranslation();
  return (
    <nav aria-label={t("nav.label")} className={bar}>
      {ITEMS.map(({ path, key, icon }) => (
        <NavLink
          key={key}
          to={path}
          end={path === "/"}
          className={({ isActive }) => `${itemBase} ${isActive ? itemActive : itemIdle}`}
        >
          {({ isActive }) => (
            <>
              <span className={`${pillBase} ${isActive ? pillActive : pillIdle}`}>{icon}</span>
              <span className={label}>{t(`nav.${key}`)}</span>
            </>
          )}
        </NavLink>
      ))}
    </nav>
  );
}
