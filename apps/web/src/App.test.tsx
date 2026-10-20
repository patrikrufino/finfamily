import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { App } from "./App";
import { renderWithProviders } from "./test/render";
import { i18n } from "./i18n";

const renderApp = (path = "/") => renderWithProviders(<App />, undefined, path);

describe("App shell", () => {
  it("renders the pt-BR navigation by default", () => {
    renderApp();
    const nav = screen.getByRole("navigation", { name: "Navegação principal" });
    for (const label of ["Início", "Lançamentos", "Orçamento", "Cartões", "Dívidas"]) {
      expect(nav).toHaveTextContent(label);
    }
  });

  it("navigates between pages", async () => {
    renderApp();
    await userEvent.click(screen.getByRole("link", { name: "Cartões" }));
    expect(screen.getByRole("heading", { level: 1, name: "Cartões" })).toBeInTheDocument();
  });

  it("offers the quick new-transaction action", () => {
    renderApp();
    expect(screen.getByRole("button", { name: "Novo lançamento" })).toBeInTheDocument();
  });

  it("switches language through locales", async () => {
    renderApp();
    await i18n.changeLanguage("en");
    expect(await screen.findByRole("link", { name: "Debts" })).toBeInTheDocument();
  });

  it("toggles the dark theme", async () => {
    renderApp();
    await userEvent.click(screen.getByRole("switch", { name: "Tema escuro" }));
    expect(document.documentElement).toHaveAttribute("data-theme", "dark");
  });

  it("lets the user pick who is using the app", async () => {
    renderApp();
    await userEvent.click(screen.getByRole("radio", { name: "Heloisa" }));
    expect(localStorage.getItem("finfamily.person")).toBe("heloisa");
  });
});
