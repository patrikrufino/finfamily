import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { App } from "./App";
import { createFakeRepository } from "./test/fakeRepository";
import { renderWithProviders } from "./test/render";

const today = new Date().toLocaleDateString("sv-SE");
const seeded = () =>
  createFakeRepository({
    accounts: [
      { name: "Conta Itaú", type: "checking", initialBalanceCents: 100000 },
      { name: "Reserva", type: "savings", initialBalanceCents: 0 },
    ],
  });

const nbsp = (s: string) => s.replace(/ /g, " ");

describe("main flows", () => {
  it("creates an account from the home screen", async () => {
    const user = userEvent.setup();
    renderWithProviders(<App />, createFakeRepository());
    await user.click(await screen.findByRole("button", { name: "Nova conta" }));
    const dialog = await screen.findByRole("dialog");
    await user.type(within(dialog).getByLabelText("Nome"), "Dinheiro");
    await user.selectOptions(within(dialog).getByLabelText("Tipo"), "wallet");
    await user.type(within(dialog).getByLabelText("Saldo inicial"), "150,50");
    await user.click(within(dialog).getByRole("button", { name: "Salvar" }));
    expect(await screen.findByText("Dinheiro")).toBeInTheDocument();
    await waitFor(() => expect(nbsp(screen.getByTestId("total-balance").textContent!)).toBe("R$ 150,50"));
  });

  it("registers an expense with the FAB, lists it and updates the balance", async () => {
    const user = userEvent.setup();
    renderWithProviders(<App />, seeded());
    await waitFor(() => expect(nbsp(screen.getByTestId("total-balance").textContent!)).toBe("R$ 1.000,00"));

    await user.click(screen.getByRole("button", { name: "Novo lançamento" }));
    const dialog = await screen.findByRole("dialog");
    await within(dialog).findByRole("option", { name: "Conta Itaú" });
    await user.type(within(dialog).getByLabelText("Valor"), "250,00");
    await user.type(within(dialog).getByLabelText("Descrição"), "Mercado");
    await user.click(within(dialog).getByRole("button", { name: "Salvar" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    await waitFor(() => expect(nbsp(screen.getByTestId("total-balance").textContent!)).toBe("R$ 750,00"));

    await user.click(screen.getByRole("link", { name: "Lançamentos" }));
    const item = await screen.findByRole("button", { name: /Mercado/ });
    expect(nbsp(item.textContent!)).toContain("-R$ 250,00");
    expect(item.textContent).toContain("Patrik");
  });

  it("shows validation errors without closing the dialog", async () => {
    const user = userEvent.setup();
    renderWithProviders(<App />, seeded());
    await user.click(screen.getByRole("button", { name: "Novo lançamento" }));
    const dialog = await screen.findByRole("dialog");
    await within(dialog).findByRole("option", { name: "Conta Itaú" });
    await user.click(within(dialog).getByRole("radio", { name: "Transferência" }));
    await user.type(within(dialog).getByLabelText("Valor"), "10");
    await user.click(within(dialog).getByRole("button", { name: "Salvar" }));
    expect(await within(dialog).findByText("Escolha a conta de destino.")).toBeInTheDocument();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("edits and deletes a transaction from the list", async () => {
    const user = userEvent.setup();
    const repo = seeded();
    await repo.createTransaction({
      kind: "expense", amountCents: 5000, date: today, accountId: 1, toAccountId: null,
      description: "Padaria", status: "settled", personId: 1,
    });
    renderWithProviders(<App />, repo, "/transactions");
    await user.click(await screen.findByRole("button", { name: /Padaria/ }));
    const dialog = await screen.findByRole("dialog");
    const description = within(dialog).getByLabelText("Descrição");
    await user.clear(description);
    await user.type(description, "Padaria do João");
    await user.click(within(dialog).getByRole("button", { name: "Salvar" }));
    await user.click(await screen.findByRole("button", { name: /Padaria do João/ }));
    await user.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Excluir" }));
    await waitFor(() => expect(screen.getByText("Nenhum lançamento neste mês.")).toBeInTheDocument());
  });
});
