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

describe("credit card flow", () => {
  const cardSeed = () =>
    createFakeRepository({
      today: "2026-10-20",
      accounts: [{ name: "Conta Itaú", type: "checking", initialBalanceCents: 500000 }],
      cards: [{ name: "Visa", limitCents: 500000, closingDay: 25, dueDay: 5 }],
    });

  it("shows the card with its available limit and charges a purchase to the card, not to the account", async () => {
    const user = userEvent.setup();
    renderWithProviders(<App />, cardSeed(), "/cards");
    expect(await screen.findByText("Visa")).toBeInTheDocument();
    expect(nbsp(screen.getByRole("link", { name: /Visa/ }).textContent!)).toContain("Disponível: R$ 5.000,00");

    await user.click(screen.getByRole("button", { name: "Novo lançamento" }));
    const dialog = await screen.findByRole("dialog");
    await within(dialog).findByRole("option", { name: "Visa" });
    await user.type(within(dialog).getByLabelText("Valor"), "200,00");
    await user.selectOptions(within(dialog).getByLabelText("Conta ou cartão"), "Visa");
    await user.click(within(dialog).getByRole("button", { name: "Salvar" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());

    await waitFor(() => expect(nbsp(screen.getByRole("link", { name: /Visa/ }).textContent!)).toContain("Disponível: R$ 4.800,00"));
    await user.click(screen.getByRole("link", { name: "Início" }));
    await waitFor(() => expect(nbsp(screen.getByTestId("total-balance").textContent!)).toBe("R$ 5.000,00"));
  });

  it("creates a card from the cards screen and rejects an invalid closing day", async () => {
    const user = userEvent.setup();
    renderWithProviders(<App />, createFakeRepository(), "/cards");
    await user.click(await screen.findByRole("button", { name: "Novo cartão" }));
    const dialog = await screen.findByRole("dialog");
    await user.type(within(dialog).getByLabelText("Nome"), "Master");
    await user.type(within(dialog).getByLabelText("Limite"), "3.000,00");
    await user.type(within(dialog).getByLabelText("Dia de fechamento"), "40");
    await user.type(within(dialog).getByLabelText("Dia de vencimento"), "10");
    await user.click(within(dialog).getByRole("button", { name: "Salvar" }));
    expect(await within(dialog).findByText("Informe um dia de 1 a 31.")).toBeInTheDocument();
    await user.clear(within(dialog).getByLabelText("Dia de fechamento"));
    await user.type(within(dialog).getByLabelText("Dia de fechamento"), "25");
    await user.click(within(dialog).getByRole("button", { name: "Salvar" }));
    expect(await screen.findByText("Master")).toBeInTheDocument();
  });

  it("pays a closed statement with interest and updates the account balance", async () => {
    const user = userEvent.setup();
    const repo = cardSeed();
    await repo.createTransaction({
      kind: "expense", amountCents: 100000, date: "2026-09-10", accountId: null, cardId: 1, toAccountId: null,
      categoryId: null, description: "Notebook", status: "settled", personId: 1,
    });
    renderWithProviders(<App />, repo, "/cards/1");
    await user.click(await screen.findByRole("button", { name: "Mês anterior" }));
    await waitFor(() => expect(screen.getByTestId("month-label")).toHaveTextContent("Setembro de 2026"));
    expect(screen.getByTestId("statement-status")).toHaveTextContent("Fechada");
    expect(nbsp(screen.getByTestId("statement-total").textContent!)).toBe("R$ 1.000,00");
    expect(screen.getByText("Notebook")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Pagar fatura" }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByLabelText("Valor pago")).toHaveValue("1.000,00");
    await user.type(within(dialog).getByLabelText("Juros"), "20,00");
    await user.click(within(dialog).getByRole("button", { name: "Salvar" }));
    await waitFor(() => expect(screen.getByTestId("statement-status")).toHaveTextContent("Paga"));
    expect(screen.queryByRole("button", { name: "Pagar fatura" })).not.toBeInTheDocument();
    expect(screen.getByText("Juros e multas")).toBeInTheDocument();

    await user.click(screen.getByRole("link", { name: "Início" }));
    await waitFor(() => expect(nbsp(screen.getByTestId("total-balance").textContent!)).toBe("R$ 3.980,00"));
  });

  it("lists statement payments in the transactions screen without letting them be edited", async () => {
    const repo = cardSeed();
    await repo.createTransaction({
      kind: "expense", amountCents: 100000, date: "2026-09-10", accountId: null, cardId: 1, toAccountId: null,
      categoryId: null, description: "Notebook", status: "settled", personId: 1,
    });
    const paidOn = today;
    await repo.payStatement(1, "2026-09", { accountId: 1, amountCents: 100000, interestCents: 0, fineCents: 0, date: paidOn, personId: 1 });
    renderWithProviders(<App />, repo, "/transactions");
    expect(await screen.findByText("Pagamento da fatura · Visa")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Pagamento da fatura/ })).not.toBeInTheDocument();
  });

  it("changes the closing rule and shows validation errors", async () => {
    const user = userEvent.setup();
    renderWithProviders(<App />, cardSeed(), "/cards/1");
    await user.click(await screen.findByRole("button", { name: "Alterar fechamento" }));
    const dialog = await screen.findByRole("dialog");
    await user.clear(within(dialog).getByLabelText("Dia de fechamento"));
    await user.type(within(dialog).getByLabelText("Dia de fechamento"), "0");
    await user.click(within(dialog).getByRole("button", { name: "Salvar" }));
    expect(await within(dialog).findByText("Informe um dia de 1 a 31.")).toBeInTheDocument();
    await user.clear(within(dialog).getByLabelText("Dia de fechamento"));
    await user.type(within(dialog).getByLabelText("Dia de fechamento"), "10");
    await user.click(within(dialog).getByRole("button", { name: "Salvar" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });
});

describe("account initial balance and adjustments", () => {
  it("edits the initial balance and the balance follows", async () => {
    const user = userEvent.setup();
    renderWithProviders(<App />, seeded());
    await waitFor(() => expect(nbsp(screen.getByTestId("total-balance").textContent!)).toBe("R$ 1.000,00"));
    await user.click(screen.getByRole("button", { name: "Editar Conta Itaú" }));
    const dialog = await screen.findByRole("dialog");
    const initial = within(dialog).getByLabelText("Saldo inicial");
    await user.clear(initial);
    await user.type(initial, "1.500,00");
    await user.click(within(dialog).getByRole("button", { name: "Salvar" }));
    await waitFor(() => expect(nbsp(screen.getByTestId("total-balance").textContent!)).toBe("R$ 1.500,00"));
  });

  it("previews and records a balance adjustment that is not counted as spending", async () => {
    const user = userEvent.setup();
    renderWithProviders(<App />, seeded());
    await user.click(await screen.findByRole("button", { name: "Editar Conta Itaú" }));
    const dialog = await screen.findByRole("dialog");
    const adjust = within(dialog).getByRole("button", { name: "Ajustar saldo" });
    expect(adjust).toBeDisabled();
    await user.type(within(dialog).getByLabelText("Saldo real hoje"), "920,00");
    expect(nbsp(within(dialog).getByTestId("adjust-preview").textContent!)).toBe("Será lançada uma despesa de ajuste de R$ 80,00.");
    await user.click(adjust);
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    await waitFor(() => expect(nbsp(screen.getByTestId("total-balance").textContent!)).toBe("R$ 920,00"));

    await user.click(screen.getByRole("link", { name: "Lançamentos" }));
    expect(await screen.findByRole("button", { name: /Ajuste de saldo/ })).toBeInTheDocument();
    expect(nbsp(screen.getByText("Despesas").parentElement!.textContent!)).toContain("R$ 0,00");
  });

  it("says when the balance already matches", async () => {
    const user = userEvent.setup();
    renderWithProviders(<App />, seeded());
    await user.click(await screen.findByRole("button", { name: "Editar Conta Itaú" }));
    const dialog = await screen.findByRole("dialog");
    await user.type(within(dialog).getByLabelText("Saldo real hoje"), "1.000,00");
    expect(within(dialog).getByTestId("adjust-preview")).toHaveTextContent("O saldo já confere.");
    expect(within(dialog).getByRole("button", { name: "Ajustar saldo" })).toBeDisabled();
  });
});

describe("installments flow", () => {
  const planSeed = () =>
    createFakeRepository({
      accounts: [{ name: "Conta Itaú", type: "checking", initialBalanceCents: 500000 }],
      cards: [{ name: "Visa", limitCents: 500000, closingDay: 25, dueDay: 5 }],
    });

  async function createSofa(user: ReturnType<typeof userEvent.setup>, source?: string) {
    await user.click(screen.getByRole("button", { name: "Novo lançamento" }));
    const dialog = await screen.findByRole("dialog");
    await within(dialog).findByRole("option", { name: "Conta Itaú" });
    await user.type(within(dialog).getByLabelText("Valor"), "300,00");
    await user.type(within(dialog).getByLabelText("Descrição"), "Sofá");
    if (source) await user.selectOptions(within(dialog).getByLabelText("Conta ou cartão"), source);
    await user.type(within(dialog).getByLabelText("Nº de parcelas"), "3");
    expect(within(dialog).getByTestId("installment-preview")).toHaveTextContent(/3x de R\$\s100,00/);
    expect(within(dialog).getByLabelText("Valor total")).toBeInTheDocument();
    expect(within(dialog).queryByLabelText("Já efetivado")).not.toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "Salvar" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  }

  it("splits a purchase in installments from the quick form; only the first one hits the balance", async () => {
    const user = userEvent.setup();
    renderWithProviders(<App />, planSeed());
    await createSofa(user);
    await waitFor(() => expect(nbsp(screen.getByTestId("total-balance").textContent!)).toBe("R$ 4.900,00"));
    await user.click(screen.getByRole("link", { name: "Lançamentos" }));
    const item = await screen.findByRole("link", { name: /Sofá \(1\/3\)/ });
    expect(item).toHaveAttribute("href", "/installments/1");
  });

  it("lists plans with progress and opens the detail", async () => {
    const user = userEvent.setup();
    renderWithProviders(<App />, planSeed());
    await createSofa(user);
    await user.click(screen.getByRole("link", { name: "Lançamentos" }));
    await user.click(await screen.findByRole("link", { name: "Parcelamentos" }));
    const plan = await screen.findByRole("link", { name: /Sofá/ });
    expect(plan).toHaveTextContent("1 de 3 pagas");
    await user.click(plan);
    expect(await screen.findByTestId("plan-progress")).toHaveTextContent("1 de 3 pagas");
    expect(screen.getAllByRole("listitem").filter((li) => /\d\/3/.test(li.textContent ?? ""))).toHaveLength(3);
  });

  it("edits a single installment", async () => {
    const user = userEvent.setup();
    renderWithProviders(<App />, planSeed(), "/");
    await createSofa(user);
    await user.click(screen.getByRole("link", { name: "Lançamentos" }));
    await user.click(await screen.findByRole("link", { name: "Parcelamentos" }));
    await user.click(await screen.findByRole("link", { name: /Sofá/ }));
    await user.click(await screen.findByRole("button", { name: "Editar parcela 2/3" }));
    const dialog = await screen.findByRole("dialog");
    const amount = within(dialog).getByLabelText("Valor");
    await user.clear(amount);
    await user.type(amount, "120,00");
    await user.click(within(dialog).getByRole("button", { name: "Salvar" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    await waitFor(() => expect(nbsp(screen.getByText(/Restante:/).parentElement!.textContent!)).toContain("Restante: R$ 220,00"));
  });

  it("anticipates an installment with a discount and shows the saving", async () => {
    const user = userEvent.setup();
    renderWithProviders(<App />, planSeed());
    await createSofa(user);
    await user.click(screen.getByRole("link", { name: "Lançamentos" }));
    await user.click(await screen.findByRole("link", { name: "Parcelamentos" }));
    await user.click(await screen.findByRole("link", { name: /Sofá/ }));
    await user.click(await screen.findByRole("button", { name: "Antecipar" }));
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("checkbox", { name: /Parcela 3/ }));
    expect(within(dialog).getByLabelText("Valor pago")).toHaveValue("100,00");
    const paid = within(dialog).getByLabelText("Valor pago");
    await user.clear(paid);
    await user.type(paid, "90,00");
    expect(nbsp(within(dialog).getByTestId("anticipation-summary").textContent!)).toContain("Economia: R$ 10,00");
    await user.click(within(dialog).getByRole("button", { name: "Antecipar" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(await screen.findByText("Antecipação")).toBeInTheDocument();
    await user.click(screen.getByRole("link", { name: "Início" }));
    await waitFor(() => expect(nbsp(screen.getByTestId("total-balance").textContent!)).toBe("R$ 4.810,00"));
  });

  it("settles everything at once with 'Quitar tudo'", async () => {
    const user = userEvent.setup();
    renderWithProviders(<App />, planSeed());
    await createSofa(user);
    await user.click(screen.getByRole("link", { name: "Lançamentos" }));
    await user.click(await screen.findByRole("link", { name: "Parcelamentos" }));
    await user.click(await screen.findByRole("link", { name: /Sofá/ }));
    await user.click(await screen.findByRole("button", { name: "Antecipar" }));
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "Quitar tudo" }));
    expect(within(dialog).getByLabelText("Valor pago")).toHaveValue("200,00");
    await user.click(within(dialog).getByRole("button", { name: "Antecipar" }));
    await waitFor(() => expect(screen.queryByRole("button", { name: "Antecipar" })).not.toBeInTheDocument());
    expect(screen.queryByRole("button", { name: "Cancelar parcelas futuras" })).not.toBeInTheDocument();
  });

  it("cancels the future installments after confirming", async () => {
    const user = userEvent.setup();
    renderWithProviders(<App />, planSeed());
    await createSofa(user);
    await user.click(screen.getByRole("link", { name: "Lançamentos" }));
    await user.click(await screen.findByRole("link", { name: "Parcelamentos" }));
    await user.click(await screen.findByRole("link", { name: /Sofá/ }));
    await user.click(await screen.findByRole("button", { name: "Cancelar parcelas futuras" }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText(/As já pagas continuam no histórico/)).toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "Confirmar" }));
    await waitFor(() => expect(screen.getByTestId("plan-progress")).toHaveTextContent("1 de 3 pagas"));
    expect(screen.queryByRole("button", { name: "Antecipar" })).not.toBeInTheDocument();
  });

  it("charges the installments to a card and keeps the account untouched", async () => {
    const user = userEvent.setup();
    renderWithProviders(<App />, planSeed());
    await createSofa(user, "Visa");
    await waitFor(() => expect(nbsp(screen.getByTestId("total-balance").textContent!)).toBe("R$ 5.000,00"));
    await user.click(screen.getByRole("link", { name: "Cartões" }));
    await waitFor(() => expect(nbsp(screen.getByRole("link", { name: /Visa/ }).textContent!)).toContain("Disponível: R$ 4.700,00"));
  });

  it("shows validation errors for installments", async () => {
    const user = userEvent.setup();
    renderWithProviders(<App />, planSeed());
    await user.click(screen.getByRole("button", { name: "Novo lançamento" }));
    const dialog = await screen.findByRole("dialog");
    await within(dialog).findByRole("option", { name: "Conta Itaú" });
    await user.type(within(dialog).getByLabelText("Valor"), "300,00");
    await user.type(within(dialog).getByLabelText("Nº de parcelas"), "1");
    await user.click(within(dialog).getByRole("button", { name: "Salvar" }));
    expect(await within(dialog).findByText("Informe uma descrição para o parcelamento.")).toBeInTheDocument();
    expect(within(dialog).getByText("Informe de 2 a 120 parcelas.")).toBeInTheDocument();
  });
});
