import { CATEGORY_ICON_GROUPS } from "@finfamily/domain";
import { useTranslation } from "react-i18next";
import { css } from "../../../styled-system/css";
import { label } from "../../shared/ui";

interface Props {
  value: string | null;
  onChange: (icon: string | null) => void;
}

const choice = css({
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  width: "11",
  height: "11",
  borderRadius: "md",
  border: "1px solid",
  borderColor: "border",
  background: "surface",
  fontSize: "xl",
  lineHeight: "1",
  cursor: "pointer",
  touchAction: "manipulation",
});
const chosen = css({ borderColor: "primary", background: "primary/15", boxShadow: "0 0 0 2px {colors.primary}" });
const noIconButton = css({ paddingInline: "3", height: "11", borderRadius: "md", border: "1px solid", borderColor: "border", background: "surface", color: "text", cursor: "pointer" });

/** Grid of the available icons, grouped by theme. A single choice (or none). */
export function IconPicker({ value, onChange }: Props) {
  const { t } = useTranslation();
  return (
    <div role="radiogroup" aria-label={t("categories.icon")} className={css({ display: "grid", gap: "3" })}>
      <button type="button" role="radio" aria-checked={value === null} className={`${noIconButton} ${value === null ? chosen : ""}`} onClick={() => onChange(null)}>
        {t("categories.noIcon")}
      </button>
      {CATEGORY_ICON_GROUPS.map((group) => (
        <div key={group.id} className={css({ display: "grid", gap: "1" })}>
          <p className={label}>{t(`categories.iconGroups.${group.id}`)}</p>
          <div className={css({ display: "flex", flexWrap: "wrap", gap: "2" })}>
            {group.icons.map((icon) => (
              <button
                key={icon}
                type="button"
                role="radio"
                aria-checked={value === icon}
                aria-label={icon}
                className={`${choice} ${value === icon ? chosen : ""}`}
                onClick={() => onChange(icon)}
              >
                {icon}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
