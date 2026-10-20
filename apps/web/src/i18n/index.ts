import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import en from "./locales/en.json";
import ptBR from "./locales/pt-BR.json";

export const SUPPORTED_LOCALES = ["pt-BR", "en"] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "pt-BR";

export async function initI18n(locale: Locale = DEFAULT_LOCALE) {
  if (i18n.isInitialized) return i18n;
  await i18n.use(initReactI18next).init({
    lng: locale,
    fallbackLng: DEFAULT_LOCALE,
    resources: { "pt-BR": { translation: ptBR }, en: { translation: en } },
    interpolation: { escapeValue: false },
  });
  return i18n;
}

export { i18n };
