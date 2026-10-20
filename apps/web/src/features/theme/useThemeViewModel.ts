import { useCallback, useEffect, useState } from "react";
import { readStored, writeStored } from "../../shared/storage";

type Theme = "system" | "light" | "dark";
const STORAGE_KEY = "finfamily.theme";

function readTheme(): Theme {
  const stored = readStored(STORAGE_KEY);
  return stored === "light" || stored === "dark" ? stored : "system";
}

function systemPrefersDark(): boolean {
  return typeof matchMedia === "function" && matchMedia("(prefers-color-scheme: dark)").matches;
}

export function useThemeViewModel() {
  const [theme, setTheme] = useState<Theme>(readTheme);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === "system") root.removeAttribute("data-theme");
    else root.setAttribute("data-theme", theme);
  }, [theme]);

  const setDark = useCallback((dark: boolean) => {
    const next: Theme = dark ? "dark" : "light";
    writeStored(STORAGE_KEY, next);
    setTheme(next);
  }, []);

  const isDark = theme === "dark" || (theme === "system" && systemPrefersDark());
  return { isDark, setDark };
}
