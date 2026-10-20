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
      kind: "expense", amountCents: 5000, date: today, accountId: 1, toAccountId: null, categoryId: null,
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

describe("budget flow", () => {
  it("creates a category with a budget, records an expense and shows progress", async () => {
    const user = userEvent.setup();
    renderWithProviders(<App />, seeded());
    await user.click(screen.getByRole("link", { name: "Orçamento" }));

    await user.click(await screen.findByRole("button", { name: "Nova categoria" }));
    let dialog = await screen.findByRole("dialog");
    await user.type(within(dialog).getByLabelText("Nome"), "Mercado");
    await user.click(within(dialog).getByRole("button", { name: "Salvar" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());

    await user.click(await screen.findByRole("button", { name: /Mercado/ }));
    dialog = await screen.findByRole("dialog");
    await user.type(within(dialog).getByLabelText("Valor mensal"), "800,00");
    await user.click(within(dialog).getByRole("button", { name: "Salvar" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());

    await user.click(screen.getByRole("button", { name: "Novo lançamento" }));
    dialog = await screen.findByRole("dialog");
    await within(dialog).findByRole("option", { name: "Mercado" });
    await user.type(within(dialog).getByLabelText("Valor"), "200,00");
    await user.selectOptions(within(dialog).getByLabelText("Categoria"), "Mercado");
    await user.click(within(dialog).getByRole("button", { name: "Salvar" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());

    const bar = await screen.findByRole("progressbar", { name: "Mercado" });
    await waitFor(() => expect(bar).toHaveAttribute("aria-valuenow", "25"));
    const row = screen.getByRole("button", { name: /Mercado/ });
    expect(nbsp(row.textContent!)).toContain("Restante: R$ 600,00");
    expect(row.textContent).toContain("25% usado");
  });

  it("offers income categories only for income and hides the field for transfers", async () => {
    const user = userEvent.setup();
    const repo = createFakeRepository({
      accounts: [{ name: "Conta Itaú", type: "checking", initialBalanceCents: 0 }],
      categories: [{ name: "Mercado", kind: "expense" }, { name: "Salário", kind: "both" }],
    });
    renderWithProviders(<App />, repo);
    await user.click(screen.getByRole("button", { name: "Novo lançamento" }));
    const dialog = await screen.findByRole("dialog");
    const select = await within(dialog).findByLabelText("Categoria");
    expect(within(select).getAllByRole("option").map((o) => o.textContent)).toEqual(["Sem categoria", "Mercado", "Salário"]);
    await user.click(within(dialog).getByRole("radio", { name: "Receita" }));
    expect(within(within(dialog).getByLabelText("Categoria")).getAllByRole("option").map((o) => o.textContent)).toEqual(["Sem categoria", "Salário"]);
    await user.click(within(dialog).getByRole("radio", { name: "Transferência" }));
    expect(within(dialog).queryByLabelText("Categoria")).not.toBeInTheDocument();
  });
});
