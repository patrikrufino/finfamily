import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, beforeEach } from "vitest";
import { i18n, initI18n } from "../i18n";

beforeEach(async () => {
  localStorage.clear();
  await initI18n("pt-BR");
  await i18n.changeLanguage("pt-BR");
});

afterEach(() => cleanup());

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver ??= ResizeObserverStub;
