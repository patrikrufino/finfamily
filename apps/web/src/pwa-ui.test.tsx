import { onlineManager } from "@tanstack/react-query";
import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useLocation } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "./App";
import { ConnectionBanner } from "./features/pwa/ConnectionBanner";
import { i18n } from "./i18n";
import { ErrorBoundary } from "./shared/ErrorBoundary";
import { createFakeRepository } from "./test/fakeRepository";
import { renderWithProviders } from "./test/render";

const nbsp = (s: string) => s.replace(/ /g, " ");
function Search() {
  return <output data-testid="search">{useLocation().search}</output>;
}

beforeEach(async () => {
  await i18n.changeLanguage("pt-BR");
});
afterEach(() => {
  vi.unstubAllGlobals();
  // React Query listens to the window's online/offline events and pauses queries while "offline"; undo what the tests simulate.
  onlineManager.setOnline(true);
});

describe("app shortcut", () => {
  const repo = () => createFakeRepository({ accounts: [{ name: "Conta Itaú", type: "checking", initialBalanceCents: 0 }] });

  it("opens the new transaction form for /?new=1 and removes the parameter", async () => {
    renderWithProviders(<><App /><Search /></>, repo(), "/?new=1");
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByTestId("search")).toHaveTextContent(/^$/));
  });

  it("keeps other parameters and does not open the form without the shortcut", async () => {
    renderWithProviders(<><App /><Search /></>, repo(), "/?month=2026-10");
    await screen.findByRole("heading", { name: "Visão geral" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByTestId("search")).toHaveTextContent("?month=2026-10");
  });
});

describe("header", () => {
  it("links to the settings from any screen", async () => {
    const user = userEvent.setup();
    renderWithProviders(<App />, createFakeRepository(), "/cards");
    await user.click(screen.getByRole("link", { name: "Ajustes" }));
    expect(await screen.findByRole("heading", { level: 1, name: "Ajustes" })).toBeInTheDocument();
  });
});

describe("not found and crashes", () => {
  it("shows a not found page with a way back", async () => {
    const user = userEvent.setup();
    renderWithProviders(<App />, createFakeRepository(), "/nao-existe");
    expect(await screen.findByRole("heading", { name: "Página não encontrada" })).toBeInTheDocument();
    await user.click(screen.getByRole("link", { name: /Voltar ao início/ }));
    expect(await screen.findByRole("heading", { name: "Visão geral" })).toBeInTheDocument();
  });

  it("shows a friendly screen instead of a blank page when rendering fails", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const Boom = () => {
      throw new Error("boom");
    };
    renderWithProviders(<ErrorBoundary><Boom /></ErrorBoundary>);
    expect(screen.getByRole("alert")).toHaveTextContent("Algo deu errado");
    expect(screen.getByRole("button", { name: "Recarregar" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Ir para o início" })).toBeInTheDocument();
    error.mockRestore();
  });

  it("renders its children when nothing fails", () => {
    renderWithProviders(<ErrorBoundary><p>all good</p></ErrorBoundary>);
    expect(screen.getByText("all good")).toBeInTheDocument();
  });
});

describe("connection banner", () => {
  it("appears when the browser goes offline and disappears when the server is back", async () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve(new Response('{"status":"ok"}'))));
    renderWithProviders(<ConnectionBanner />);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    act(() => { window.dispatchEvent(new Event("offline")); });
    expect(screen.getByRole("status")).toHaveTextContent("Sem conexão com o servidor");
    await act(async () => { window.dispatchEvent(new Event("online")); });
    await waitFor(() => expect(screen.queryByRole("status")).not.toBeInTheDocument());
  });

  it("lets the user retry", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn(() => Promise.reject(new TypeError("down")));
    vi.stubGlobal("fetch", fetchMock);
    renderWithProviders(<ConnectionBanner />);
    act(() => { window.dispatchEvent(new Event("offline")); });
    fetchMock.mockImplementation(() => Promise.resolve(new Response('{"status":"ok"}')) as never);
    await user.click(screen.getByRole("button", { name: "Tentar de novo" }));
    await waitFor(() => expect(screen.queryByRole("status")).not.toBeInTheDocument());
  });
});

describe("settings", () => {
  it("switches the language, which sticks and relabels the app", async () => {
    const user = userEvent.setup();
    renderWithProviders(<App />, createFakeRepository(), "/settings");
    await user.selectOptions(await screen.findByLabelText("Idioma", { selector: "select" }), "English");
    expect(await screen.findByRole("heading", { level: 1, name: "Settings" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Debts" })).toBeInTheDocument();
    expect(localStorage.getItem("finfamily.locale")).toBe("en");
    expect(document.documentElement.lang).toBe("en");
  });

  it("lists backups, shows the schedule and makes one on demand", async () => {
    const user = userEvent.setup();
    const repo = createFakeRepository({
      backups: [{ name: "finfamily-20261020-100000.db", sizeBytes: 81920, createdAt: "2026-10-20T10:00:00.000Z" }],
    });
    renderWithProviders(<App />, repo, "/settings");
    expect(await screen.findByTestId("last-backup")).toHaveTextContent(/Último backup:/);
    expect(screen.getByTestId("backup-schedule")).toHaveTextContent("Automático a cada 24 h; guarda os 14 mais recentes.");
    expect(screen.getByRole("list", { name: "Backups" })).toHaveTextContent("80 KB");
    await user.click(screen.getByRole("button", { name: "Fazer backup agora" }));
    expect(await screen.findByText("Backup criado.")).toBeInTheDocument();
    await waitFor(() => expect(within(screen.getByRole("list", { name: "Backups" })).getAllByRole("listitem")).toHaveLength(2));
  });

  it("says so when there are no backups yet", async () => {
    renderWithProviders(<App />, createFakeRepository(), "/settings");
    expect(await screen.findByText("Nenhum backup ainda.")).toBeInTheDocument();
  });

  it("explains when the server has backups turned off", async () => {
    renderWithProviders(<App />, createFakeRepository({ backups: false }), "/settings");
    expect(await screen.findByText("Os backups não estão ativos neste servidor.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Fazer backup agora" })).not.toBeInTheDocument();
  });

  it("reports a failed backup", async () => {
    const user = userEvent.setup();
    const repo = createFakeRepository();
    repo.createBackup = async () => { throw new Error("disk full"); };
    renderWithProviders(<App />, repo, "/settings");
    await user.click(await screen.findByRole("button", { name: "Fazer backup agora" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Não foi possível criar o backup.");
  });

  it("offers installation when the browser allows it", async () => {
    const user = userEvent.setup();
    renderWithProviders(<App />, createFakeRepository(), "/settings");
    vi.stubGlobal("isSecureContext", true);
    expect(await screen.findByText(/A instalação não está disponível agora/)).toBeInTheDocument();
    const event = new Event("beforeinstallprompt", { cancelable: true }) as Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };
    event.prompt = vi.fn(async () => undefined);
    event.userChoice = Promise.resolve({ outcome: "accepted" });
    act(() => { window.dispatchEvent(event); });
    await user.click(await screen.findByRole("button", { name: "Instalar" }));
    expect(event.prompt).toHaveBeenCalled();
    await waitFor(() => expect(screen.queryByRole("button", { name: "Instalar" })).not.toBeInTheDocument());
  });

  it("says plainly that HTTP is why the app cannot be installed, and shows the diagnostics", async () => {
    vi.stubGlobal("isSecureContext", false);
    const nav = { ...navigator } as Record<string, unknown>;
    delete nav.serviceWorker;
    vi.stubGlobal("navigator", nav);
    renderWithProviders(<App />, createFakeRepository(), "/settings");
    expect(await screen.findByRole("alert")).toHaveTextContent(/Você abriu o app por HTTP/);
    expect(screen.getByRole("alert")).toHaveTextContent(/HTTPS/);
    expect(screen.getByTestId("diag-secure")).toHaveTextContent("Não");
    expect(screen.getByTestId("diag-sw")).toHaveTextContent("Indisponível neste endereço");
  });

  it("shows a secure context with the service worker active in the diagnostics", async () => {
    vi.stubGlobal("isSecureContext", true);
    vi.stubGlobal("navigator", { ...navigator, serviceWorker: { getRegistration: vi.fn(async () => ({ active: {} })) } });
    renderWithProviders(<App />, createFakeRepository(), "/settings");
    expect(await screen.findByTestId("diag-secure")).toHaveTextContent("Sim");
    await waitFor(() => expect(screen.getByTestId("diag-sw")).toHaveTextContent("Ativo"));
    expect(screen.queryByText(/Você abriu o app por HTTP/)).not.toBeInTheDocument();
  });

  it("shows the manual steps on iOS and the version", async () => {
    vi.stubGlobal("isSecureContext", true);
    vi.stubGlobal("navigator", { ...navigator, userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)" });
    renderWithProviders(<App />, createFakeRepository(), "/settings");
    expect(await screen.findByText(/Adicionar à Tela de Início/)).toBeInTheDocument();
    expect(nbsp(screen.getByText(/FinFamily · Versão/).textContent!)).toMatch(/Versão \d+\.\d+\.\d+/);
  });
});
