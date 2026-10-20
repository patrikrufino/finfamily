import { Switch } from "@ark-ui/react/switch";
import { useTranslation } from "react-i18next";
import { css } from "../../../styled-system/css";
import { useThemeViewModel } from "./useThemeViewModel";

export function ThemeToggle() {
  const { t } = useTranslation();
  const { isDark, setDark } = useThemeViewModel();

  return (
    <Switch.Root
      checked={isDark}
      onCheckedChange={(e) => setDark(e.checked)}
      className={css({ display: "inline-flex", alignItems: "center", gap: "2" })}
    >
      <Switch.Label className={css({ fontSize: "sm", color: "muted" })}>{t("theme.dark")}</Switch.Label>
      <Switch.Control
        className={css({
          width: "10",
          height: "6",
          borderRadius: "full",
          background: "border",
          padding: "0.5",
          display: "flex",
          "&[data-state=checked]": { background: "primary" },
        })}
      >
        <Switch.Thumb
          className={css({
            width: "5",
            height: "5",
            borderRadius: "full",
            background: "surface",
            transition: "transform 0.15s",
            "&[data-state=checked]": { transform: "translateX(16px)" },
          })}
        />
      </Switch.Control>
      <Switch.HiddenInput role="switch" />
    </Switch.Root>
  );
}
