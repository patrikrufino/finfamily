import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { css } from "../../styled-system/css";
import type { CategoryDto } from "../data/types";
import { CategoryDialog } from "../features/categories/CategoryDialog";
import { CategoryIcon } from "../features/categories/CategoryIcon";
import { useCategoriesViewModel } from "../features/categories/useCategoriesViewModel";
import { card, primaryButton, secondaryButton } from "../shared/ui";

type Editing = { category?: CategoryDto } | null;

export function CategoriesPage() {
  const { t } = useTranslation();
  const vm = useCategoriesViewModel();
  const [kind, setKind] = useState<CategoryDto["kind"]>("expense");
  const [editing, setEditing] = useState<Editing>(null);
  const [message, setMessage] = useState<string | null>(null);
  const list = kind === "expense" ? vm.expense : vm.income;

  const tab = (value: CategoryDto["kind"], text: string) => (
    <button
      type="button"
      role="tab"
      aria-selected={kind === value}
      onClick={() => setKind(value)}
      className={css({
        flex: 1,
        padding: "3",
        borderRadius: "md",
        fontWeight: "bold",
        cursor: "pointer",
        color: "muted",
        touchAction: "manipulation",
        "&[aria-selected=true]": { background: "primary", color: "onPrimary" },
      })}
    >
      {text}
    </button>
  );

  async function addDefaults() {
    const result = await vm.addDefaults();
    if (!result.ok) return setMessage(t(`errors.${result.error}`, { defaultValue: t("errors.unknown") }));
    setMessage(result.created === 0 ? t("categories.defaultsNone") : result.created === 1 ? t("categories.defaultsAddedOne") : t("categories.defaultsAdded", { count: result.created }));
  }

  return (
    <div className={css({ display: "grid", gap: "4" })}>
      <Link to="/budget" className={css({ color: "primary", fontSize: "sm" })}>‹ {t("categories.back")}</Link>
      <div className={css({ display: "flex", justifyContent: "space-between", alignItems: "center" })}>
        <h1 className={css({ fontSize: "xl", fontWeight: "bold" })}>{t("categories.title")}</h1>
        <button type="button" className={primaryButton} onClick={() => setEditing({})}>{t("categories.new")}</button>
      </div>

      <div role="tablist" aria-label={t("categories.kindTabs")} className={css({ display: "flex", gap: "1", background: "border", borderRadius: "lg", padding: "1" })}>
        {tab("expense", t("categories.expenses"))}
        {tab("income", t("categories.income"))}
      </div>

      {vm.isLoading ? (
        <p>{t("common.loading")}</p>
      ) : list.length === 0 ? (
        <p className={css({ color: "muted" })}>{kind === "expense" ? t("categories.emptyExpense") : t("categories.emptyIncome")}</p>
      ) : (
        <ul role="tabpanel" className={css({ display: "grid", gap: "2", listStyle: "none" })}>
          {list.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                aria-label={`${t("categories.edit")}: ${c.name}`}
                onClick={() => setEditing({ category: c })}
                className={`${card} ${css({ width: "100%", display: "flex", alignItems: "center", gap: "3", textAlign: "left", cursor: "pointer" })}`}
              >
                <CategoryIcon icon={c.icon} />
                <strong>{c.name}</strong>
              </button>
            </li>
          ))}
        </ul>
      )}

      <button type="button" className={secondaryButton} onClick={addDefaults}>{t("categories.defaults")}</button>
      {message && <p role="status" className={css({ color: "muted", fontSize: "sm" })}>{message}</p>}

      {editing && <CategoryDialog category={editing.category} kind={kind} vm={vm} onClose={() => setEditing(null)} />}
    </div>
  );
}
