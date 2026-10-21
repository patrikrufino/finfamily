import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import { readStored, writeStored } from "../shared/storage";
import en from "./locales/en.json";
import ptBR from "./locales/pt-BR.json";

export const SUPPORTED_LOCALES = ["pt-BR", "en"] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "pt-BR";

const STORAGE_KEY = "finfamily.locale";

/** The language chosen on this device, if any (unknown values are ignored). */
export function storedLocale(): Locale | null {
  const stored = readStored(STORAGE_KEY);
  return SUPPORTED_LOCALES.find((l) => l === stored) ?? null;
}

export async function initI18n(locale?: Locale) {
  if (i18n.isInitialized) return i18n;
  await i18n.use(initReactI18next).init({
    lng: locale ?? storedLocale() ?? DEFAULT_LOCALE,
    fallbackLng: DEFAULT_LOCALE,
    resources: { "pt-BR": { translation: ptBR }, en: { translation: en } },
    interpolation: { escapeValue: false },
  });
  // Screen readers and browsers pick the language (hyphenation, voices, translation prompts) from <html lang>.
  i18n.on("languageChanged", (lng) => {
    document.documentElement.lang = lng;
  });
  document.documentElement.lang = i18n.language;
  return i18n;
}

/** Switches the language and remembers the choice on this device. */
export async function setLocale(locale: Locale) {
  await i18n.changeLanguage(locale);
  writeStored(STORAGE_KEY, locale);
}

export { i18n };
