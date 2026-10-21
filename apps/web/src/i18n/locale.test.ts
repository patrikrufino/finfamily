import { beforeEach, describe, expect, it } from "vitest";
import { DEFAULT_LOCALE, i18n, setLocale, storedLocale } from "./index";

describe("locale persistence", () => {
  beforeEach(async () => {
    localStorage.clear();
    await i18n.changeLanguage(DEFAULT_LOCALE);
  });

  it("defaults to pt-BR and nothing is stored", () => {
    expect(i18n.language).toBe("pt-BR");
    expect(storedLocale()).toBeNull();
  });

  it("changes the language, remembers it and updates <html lang>", async () => {
    await setLocale("en");
    expect(i18n.language).toBe("en");
    expect(storedLocale()).toBe("en");
    expect(document.documentElement.lang).toBe("en");
    expect(i18n.t("nav.debts")).toBe("Debts");
  });

  it("keeps <html lang> in sync with any language change", async () => {
    await i18n.changeLanguage("en");
    expect(document.documentElement.lang).toBe("en");
    await i18n.changeLanguage("pt-BR");
    expect(document.documentElement.lang).toBe("pt-BR");
  });

  it("ignores unknown values stored on the device", () => {
    localStorage.setItem("finfamily.locale", "klingon");
    expect(storedLocale()).toBeNull();
  });
});
