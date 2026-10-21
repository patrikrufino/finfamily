import { fireEvent, screen, waitFor, within } from "@testing-library/react";
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
  it("creates an expense category with an icon, sets its budget, records an expense and shows progress", async () => {
    const user = userEvent.setup();
    renderWithProviders(<App />, seeded());
    await user.click(screen.getByRole("link", { name: "Orçamento" }));
    await user.click(await screen.findByRole("link", { name: "Gerenciar categorias" }));

    await user.click(await screen.findByRole("button", { name: "Nova categoria" }));
    let dialog = await screen.findByRole("dialog");
    await user.type(within(dialog).getByLabelText("Nome"), "Mercado");
    await user.click(within(dialog).getByRole("radio", { name: "🛒" }));
    await user.click(within(dialog).getByRole("button", { name: "Salvar" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());

    await user.click(screen.getByRole("link", { name: /Voltar/ }));
    await user.click(await screen.findByRole("button", { name: /Mercado/ }));
    dialog = await screen.findByRole("dialog");
    await user.type(within(dialog).getByLabelText("Valor mensal"), "800,00");
    await user.click(within(dialog).getByRole("button", { name: "Salvar" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());

    await user.click(screen.getByRole("button", { name: "Novo lançamento" }));
    dialog = await screen.findByRole("dialog");
    await within(dialog).findByRole("option", { name: "🛒 Mercado" });
    await user.type(within(dialog).getByLabelText("Valor"), "200,00");
    await user.selectOptions(within(dialog).getByLabelText("Categoria"), "🛒 Mercado");
    await user.click(within(dialog).getByRole("button", { name: "Salvar" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());

    const bar = await screen.findByRole("progressbar", { name: "Mercado" });
    await waitFor(() => expect(bar).toHaveAttribute("aria-valuenow", "25"));
    const row = screen.getByRole("button", { name: /Mercado/ });
    expect(nbsp(row.textContent!)).toContain("Restante: R$ 600,00");
    expect(row.textContent).toContain("25% usado");
    expect(row.textContent).toContain("🛒");
  });

  it("offers only categories of the matching kind and hides the field for transfers", async () => {
    const user = userEvent.setup();
    const repo = createFakeRepository({
      accounts: [{ name: "Conta Itaú", type: "checking", initialBalanceCents: 0 }],
      categories: [{ name: "Mercado", kind: "expense", icon: "🛒" }, { name: "Salário", kind: "income", icon: "💼" }],
    });
    renderWithProviders(<App />, repo);
    await user.click(screen.getByRole("button", { name: "Novo lançamento" }));
    const dialog = await screen.findByRole("dialog");
    const select = await within(dialog).findByLabelText("Categoria");
    expect(within(select).getAllByRole("option").map((o) => o.textContent)).toEqual(["Sem categoria", "🛒 Mercado"]);
    await user.click(within(dialog).getByRole("radio", { name: "Receita" }));
    expect(within(within(dialog).getByLabelText("Categoria")).getAllByRole("option").map((o) => o.textContent)).toEqual(["Sem categoria", "💼 Salário"]);
    await user.click(within(dialog).getByRole("radio", { name: "Transferência" }));
    expect(within(dialog).queryByLabelText("Categoria")).not.toBeInTheDocument();
  });

  it("does not list income categories in the budget", async () => {
    const repo = createFakeRepository({ categories: [{ name: "Mercado", kind: "expense" }, { name: "Salário", kind: "income" }] });
    renderWithProviders(<App />, repo, "/budget");
    await screen.findByRole("button", { name: /Mercado/ });
    expect(screen.queryByRole("button", { name: /Salário/ })).not.toBeInTheDocument();
  });
});

describe("categories screen", () => {
  const catSeed = () =>
    createFakeRepository({
      categories: [
        { name: "Mercado", kind: "expense", icon: "🛒" },
        { name: "Carro", kind: "expense", icon: "🚗" },
        { name: "Salário", kind: "income", icon: "💼" },
      ],
    });

  it("separates expenses and income in tabs", async () => {
    const user = userEvent.setup();
    renderWithProviders(<App />, catSeed(), "/categories");
    expect(await screen.findByRole("tab", { name: "Despesas", selected: true })).toBeInTheDocument();
    expect(await screen.findByRole("button", { name: /Editar categoria: Mercado/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Salário/ })).not.toBeInTheDocument();
    await user.click(screen.getByRole("tab", { name: "Receitas" }));
    expect(screen.getByRole("button", { name: /Editar categoria: Salário/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Mercado/ })).not.toBeInTheDocument();
  });

  it("creates an income category with an icon picked from the list", async () => {
    const user = userEvent.setup();
    renderWithProviders(<App />, catSeed(), "/categories");
    await user.click(await screen.findByRole("tab", { name: "Receitas" }));
    await user.click(screen.getByRole("button", { name: "Nova categoria" }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText(/Categoria de receita/)).toBeInTheDocument();
    await user.type(within(dialog).getByLabelText("Nome"), "Projetos");
    expect(within(dialog).getByRole("radio", { name: "Sem ícone", checked: true })).toBeInTheDocument();
    await user.click(within(dialog).getByRole("radio", { name: "💻" }));
    expect(within(dialog).getByRole("radio", { name: "💻", checked: true })).toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "Salvar" }));
    const item = await screen.findByRole("button", { name: /Editar categoria: Projetos/ });
    expect(item).toHaveTextContent("💻");
  });

  it("groups the icons by theme", async () => {
    const user = userEvent.setup();
    renderWithProviders(<App />, catSeed(), "/categories");
    await user.click(await screen.findByRole("button", { name: "Nova categoria" }));
    const dialog = await screen.findByRole("dialog");
    for (const group of ["Dinheiro", "Casa", "Contas e assinaturas", "Comida", "Saúde", "Dívidas"]) {
      expect(within(dialog).getByText(group)).toBeInTheDocument();
    }
  });

  it("edits the name and icon, and archives", async () => {
    const user = userEvent.setup();
    renderWithProviders(<App />, catSeed(), "/categories");
    await user.click(await screen.findByRole("button", { name: /Editar categoria: Mercado/ }));
    let dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText(/O tipo não muda depois de criada/)).toBeInTheDocument();
    const name = within(dialog).getByLabelText("Nome");
    await user.clear(name);
    await user.type(name, "Supermercado");
    await user.click(within(dialog).getByRole("radio", { name: "🍎" }));
    await user.click(within(dialog).getByRole("button", { name: "Salvar" }));
    const item = await screen.findByRole("button", { name: /Editar categoria: Supermercado/ });
    expect(item).toHaveTextContent("🍎");

    await user.click(item);
    dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "Arquivar categoria" }));
    await waitFor(() => expect(screen.queryByRole("button", { name: /Supermercado/ })).not.toBeInTheDocument());
  });

  it("explains duplicate names within the same kind, but allows the same name in the other kind", async () => {
    const user = userEvent.setup();
    renderWithProviders(<App />, catSeed(), "/categories");
    await user.click(await screen.findByRole("button", { name: "Nova categoria" }));
    let dialog = await screen.findByRole("dialog");
    await user.type(within(dialog).getByLabelText("Nome"), "mercado");
    await user.click(within(dialog).getByRole("button", { name: "Salvar" }));
    expect(await within(dialog).findByText("Já existe uma categoria ativa com esse nome.")).toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "Fechar" }));

    await user.click(screen.getByRole("tab", { name: "Receitas" }));
    await user.click(screen.getByRole("button", { name: "Nova categoria" }));
    dialog = await screen.findByRole("dialog");
    await user.type(within(dialog).getByLabelText("Nome"), "Mercado");
    await user.click(within(dialog).getByRole("button", { name: "Salvar" }));
    expect(await screen.findByRole("button", { name: /Editar categoria: Mercado/ })).toBeInTheDocument();
  });

  it("adds the default categories once, keeping the ones that exist", async () => {
    const user = userEvent.setup();
    renderWithProviders(<App />, catSeed(), "/categories");
    await user.click(await screen.findByRole("button", { name: "Adicionar categorias padrão" }));
    expect(await screen.findByRole("status")).toHaveTextContent("12 categorias adicionadas.");
    expect(screen.getByRole("button", { name: /Editar categoria: Moradia/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Editar categoria: Comida fora/ })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /Editar categoria: Mercado/ })).toHaveLength(1);
    await user.click(screen.getByRole("button", { name: "Adicionar categorias padrão" }));
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Todas as categorias padrão já existem."));
    await user.click(screen.getByRole("tab", { name: "Receitas" }));
    expect(screen.getByRole("button", { name: /Editar categoria: Projetos/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Editar categoria: Outras receitas/ })).toBeInTheDocument();
  });

  it("is reachable from the budget screen", async () => {
    const user = userEvent.setup();
    renderWithProviders(<App />, catSeed(), "/budget");
    await user.click(await screen.findByRole("link", { name: "Gerenciar categorias" }));
    expect(await screen.findByRole("heading", { level: 1, name: "Categorias" })).toBeInTheDocument();
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

describe("debts flow", () => {
  const debtSeed = () =>
    createFakeRepository({
      accounts: [{ name: "Conta Itaú", type: "checking", initialBalanceCents: 500000 }],
      categories: [{ name: "Dívidas", kind: "expense" }],
    });

  async function createDebt(user: ReturnType<typeof userEvent.setup>) {
    await user.click(await screen.findByRole("button", { name: "Nova dívida" }));
    const dialog = await screen.findByRole("dialog");
    await user.type(within(dialog).getByLabelText("Credor"), "Banco");
    await user.type(within(dialog).getByLabelText("Valor original"), "1.000,00");
    await user.click(within(dialog).getByRole("button", { name: "Salvar" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    await user.click(await screen.findByRole("link", { name: /Banco/ }));
    await screen.findByTestId("debt-balance");
  }

  it("registers a debt without moving any money and shows the total owed", async () => {
    const user = userEvent.setup();
    renderWithProviders(<App />, debtSeed(), "/debts");
    await user.click(await screen.findByRole("button", { name: "Nova dívida" }));
    const dialog = await screen.findByRole("dialog");
    await user.type(within(dialog).getByLabelText("Credor"), "Banco");
    await user.type(within(dialog).getByLabelText("Valor original"), "1.000,00");
    await user.click(within(dialog).getByRole("button", { name: "Salvar" }));
    expect(await screen.findByRole("link", { name: /Banco/ })).toBeInTheDocument();
    expect(nbsp(screen.getByTestId("total-owed").textContent!)).toBe("R$ 1.000,00");
    await user.click(screen.getByRole("link", { name: "Início" }));
    await waitFor(() => expect(nbsp(screen.getByTestId("total-balance").textContent!)).toBe("R$ 5.000,00"));
  });

  it("posts interest and a discount, then pays partially; the payment is an expense on the account", async () => {
    const user = userEvent.setup();
    renderWithProviders(<App />, debtSeed(), "/debts");
    await createDebt(user);

    await user.click(screen.getByRole("button", { name: "Lançar juros" }));
    let dialog = await screen.findByRole("dialog");
    await user.type(within(dialog).getByLabelText("Valor"), "80,00");
    await user.click(within(dialog).getByRole("button", { name: "Salvar" }));
    await waitFor(() => expect(nbsp(screen.getByTestId("debt-balance").textContent!)).toBe("R$ 1.080,00"));

    await user.click(screen.getByRole("button", { name: "Dar desconto" }));
    dialog = await screen.findByRole("dialog");
    await user.type(within(dialog).getByLabelText("Valor"), "30,00");
    await user.click(within(dialog).getByRole("button", { name: "Salvar" }));
    await waitFor(() => expect(nbsp(screen.getByTestId("debt-balance").textContent!)).toBe("R$ 1.050,00"));

    await user.click(screen.getByRole("button", { name: "Pagar" }));
    dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByLabelText("Valor")).toHaveValue("1.050,00");
    const amount = within(dialog).getByLabelText("Valor");
    await user.clear(amount);
    await user.type(amount, "300,00");
    await user.click(within(dialog).getByRole("button", { name: "Salvar" }));
    await waitFor(() => expect(nbsp(screen.getByTestId("debt-balance").textContent!)).toBe("R$ 750,00"));

    const items = screen.getAllByRole("listitem").map((li) => nbsp(li.textContent ?? ""));
    expect(items.some((t) => t.includes("Pagamento") && t.includes("R$ 300,00") && t.includes("Saldo após R$ 750,00"))).toBe(true);

    await user.click(screen.getByRole("link", { name: "Início" }));
    await waitFor(() => expect(nbsp(screen.getByTestId("total-balance").textContent!)).toBe("R$ 4.700,00"));
  });

  it("settles the debt by paying the whole balance and moves it to the settled list", async () => {
    const user = userEvent.setup();
    renderWithProviders(<App />, debtSeed(), "/debts");
    await createDebt(user);
    await user.click(screen.getByRole("button", { name: "Pagar" }));
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "Pagar o saldo todo" }));
    await user.click(within(dialog).getByRole("button", { name: "Salvar" }));
    await waitFor(() => expect(screen.getAllByText(/Quitada/).length).toBeGreaterThan(0));
    expect(screen.queryByRole("button", { name: "Pagar" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("link", { name: "Dívidas" }));
    expect(await screen.findByRole("heading", { name: "Quitadas" })).toBeInTheDocument();
  });

  it("explains payments above the balance and in the future", async () => {
    const user = userEvent.setup();
    renderWithProviders(<App />, debtSeed(), "/debts");
    await createDebt(user);
    await user.click(screen.getByRole("button", { name: "Pagar" }));
    const dialog = await screen.findByRole("dialog");
    const amount = within(dialog).getByLabelText("Valor");
    await user.clear(amount);
    await user.type(amount, "1.000,01");
    await user.click(within(dialog).getByRole("button", { name: "Salvar" }));
    expect(await within(dialog).findByText("O pagamento não pode passar do saldo devedor.")).toBeInTheDocument();
    await user.clear(amount);
    await user.type(amount, "10,00");
    fireEvent.change(within(dialog).getByLabelText("Data"), { target: { value: "2099-01-01" } });
    await user.click(within(dialog).getByRole("button", { name: "Salvar" }));
    expect(await within(dialog).findByText("A data do pagamento não pode ser futura.")).toBeInTheDocument();
  });

  it("refuses to remove interest that payments depend on and removes a payment to undo it", async () => {
    const user = userEvent.setup();
    renderWithProviders(<App />, debtSeed(), "/debts");
    await createDebt(user);
    await user.click(screen.getByRole("button", { name: "Lançar juros" }));
    let dialog = await screen.findByRole("dialog");
    await user.type(within(dialog).getByLabelText("Valor"), "80,00");
    await user.click(within(dialog).getByRole("button", { name: "Salvar" }));
    await waitFor(() => expect(nbsp(screen.getByTestId("debt-balance").textContent!)).toBe("R$ 1.080,00"));
    await user.click(screen.getByRole("button", { name: "Pagar" }));
    dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "Salvar" }));
    await waitFor(() => expect(screen.getAllByText(/Quitada/).length).toBeGreaterThan(0));

    await user.click(screen.getByRole("button", { name: /Remover Juros/ }));
    expect(await screen.findByText(/Remover isso deixaria o saldo negativo/)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Remover Pagamento/ }));
    await waitFor(() => expect(nbsp(screen.getByTestId("debt-balance").textContent!)).toBe("R$ 1.080,00"));
  });

  it("lists the payment in the transactions screen, linked to the debt", async () => {
    const user = userEvent.setup();
    const repo = debtSeed();
    await repo.createDebt({ creditor: "Banco", originalCents: 100000, categoryId: 1, personId: 1 });
    await repo.payDebt(1, { accountId: 1, amountCents: 30000, date: new Date().toLocaleDateString("sv-SE"), personId: 1, categoryId: null });
    renderWithProviders(<App />, repo, "/transactions");
    const link = await screen.findByRole("link", { name: /Pagamento · Banco/ });
    expect(link).toHaveAttribute("href", "/debts/1");
    await user.click(link);
    expect(await screen.findByTestId("debt-balance")).toBeInTheDocument();
  });

  it("deletes a debt without payments after confirming", async () => {
    const user = userEvent.setup();
    renderWithProviders(<App />, debtSeed(), "/debts");
    await createDebt(user);
    await user.click(screen.getByRole("button", { name: "Excluir dívida" }));
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "Excluir" }));
    expect(await screen.findByText("Nenhuma dívida cadastrada.")).toBeInTheDocument();
  });
});

describe("dashboard", () => {
  const month = today.slice(0, 7);
  const dashSeed = async (extra: Parameters<typeof createFakeRepository>[0] = {}) => {
    const repo = createFakeRepository({
      accounts: [{ name: "Conta Itaú", type: "checking", initialBalanceCents: 100000 }],
      categories: [{ name: "Mercado", kind: "expense" }],
      ...extra,
    });
    await repo.createTransaction({ kind: "income", amountCents: 500000, date: today, accountId: 1, toAccountId: null, categoryId: null, description: "Salário", status: "settled", personId: 1 });
    await repo.createTransaction({ kind: "expense", amountCents: 52000, date: today, accountId: 1, toAccountId: null, categoryId: 1, description: "Feira", status: "settled", personId: 1 });
    return repo;
  };

  it("shows the month result", async () => {
    renderWithProviders(<App />, await dashSeed());
    const section = await screen.findByTestId("month-result");
    const text = nbsp(section.textContent!);
    expect(text).toContain("ReceitasR$ 5.000,00");
    expect(text).toContain("DespesasR$ 520,00");
    expect(text).toContain("ResultadoR$ 4.480,00");
  });

  it("compares the budget with spending and highlights what is over", async () => {
    const repo = await dashSeed();
    await repo.setBudget(1, month, 50000);
    renderWithProviders(<App />, repo);
    const bar = await screen.findByRole("progressbar", { name: "Orçamento do mês" });
    expect(bar).toHaveAttribute("aria-valuenow", "100");
    expect(nbsp(screen.getByText(/do orçamento usado/).textContent!)).toContain("104% do orçamento usado");
    const attention = screen.getByRole("list", { name: "Atenção" });
    expect(nbsp(attention.textContent!)).toContain("Mercado · Estourado");
    expect(nbsp(attention.textContent!)).toContain("Estourou em R$ 20,00");
  });

  it("invites the user to set budgets when there are none", async () => {
    renderWithProviders(<App />, await dashSeed());
    expect(await screen.findByText(/Defina orçamentos na aba Orçamento/)).toBeInTheDocument();
  });

  it("projects the next six months and warns when the balance turns negative", async () => {
    const repo = await dashSeed({
      recurring: [{ kind: "expense", amountCents: 900000, description: "Conta enorme", accountId: 1, cardId: null, categoryId: null, personId: 1, frequency: "monthly", startDate: `${month}-28`, endDate: null }],
    });
    renderWithProviders(<App />, repo);
    expect(await screen.findByRole("heading", { name: "Previsão" })).toBeInTheDocument();
    expect(screen.getAllByTestId(/^forecast-/)).toHaveLength(6);
    expect(await screen.findByRole("status")).toHaveTextContent(/O saldo previsto fica negativo em/);
  });

  it("does not warn when the projection stays positive", async () => {
    renderWithProviders(<App />, await dashSeed());
    await screen.findByRole("heading", { name: "Previsão" });
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("lists statements due, flags overdue ones and links to the card", async () => {
    const repo = await dashSeed({
      dashboard: {
        cardsDue: [
          { cardId: 1, name: "Nubank", month: "2026-09", dueDate: "2026-10-05", remainingCents: 60000, status: "closed", overdue: true },
          { cardId: 2, name: "Visa", month: "2026-10", dueDate: "2026-11-05", remainingCents: 80000, status: "open", overdue: false },
        ],
      },
    });
    renderWithProviders(<App />, repo);
    const nubank = await screen.findByRole("link", { name: /Nubank/ });
    expect(nubank).toHaveAttribute("href", "/cards/1");
    expect(nubank).toHaveTextContent("Vencida");
    expect(nbsp(nubank.textContent!)).toContain("R$ 600,00");
    expect(screen.getByRole("link", { name: /Visa/ })).not.toHaveTextContent("Vencida");
  });

  it("says when nothing is due", async () => {
    renderWithProviders(<App />, await dashSeed());
    expect(await screen.findByText("Nenhuma fatura a vencer nos próximos 30 dias.")).toBeInTheDocument();
  });

  it("summarizes debts and installments", async () => {
    const repo = await dashSeed({ dashboard: { installments: { committedThisMonthCents: 25000, activePlans: 2 } } });
    await repo.createDebt({ creditor: "Banco", originalCents: 100000, categoryId: null, personId: 1 });
    renderWithProviders(<App />, repo);
    const debts = await screen.findByRole("link", { name: /Dívidas em aberto/ });
    expect(nbsp(debts.textContent!)).toContain("R$ 1.000,00");
    expect(debts).toHaveTextContent("1 dívida");
    const installments = screen.getByRole("link", { name: /Parcelas ainda a pagar/ });
    expect(nbsp(installments.textContent!)).toContain("R$ 250,00");
    expect(installments).toHaveTextContent("2 parcelamentos ativos");
  });
});

describe("recurring flow", () => {
  const recSeed = () =>
    createFakeRepository({
      accounts: [{ name: "Conta Itaú", type: "checking", initialBalanceCents: 500000 }],
      cards: [{ name: "Visa", limitCents: 500000, closingDay: 25, dueDay: 5 }],
    });

  async function createRent(user: ReturnType<typeof userEvent.setup>) {
    await user.click(screen.getByRole("button", { name: "Novo lançamento" }));
    const dialog = await screen.findByRole("dialog");
    await within(dialog).findByRole("option", { name: "Conta Itaú" });
    await user.type(within(dialog).getByLabelText("Valor"), "1.200,00");
    await user.type(within(dialog).getByLabelText("Descrição"), "Aluguel");
    await user.selectOptions(within(dialog).getByLabelText("Repetir"), "Todo mês");
    expect(within(dialog).queryByLabelText("Nº de parcelas")).not.toBeInTheDocument();
    expect(within(dialog).queryByLabelText("Já efetivado")).not.toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "Salvar" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  }

  it("creates a monthly rule from the quick form; today's occurrence is posted", async () => {
    const user = userEvent.setup();
    renderWithProviders(<App />, recSeed());
    await createRent(user);
    await user.click(screen.getByRole("link", { name: "Lançamentos" }));
    const item = await screen.findByRole("button", { name: /Aluguel/ });
    expect(item).toHaveTextContent("Recorrente");
    await user.click(screen.getByRole("link", { name: "Recorrentes" }));
    const rule = (await screen.findByText("Aluguel")).closest("li")!;
    expect(rule).toHaveTextContent("Todo mês");
    expect(rule).toHaveTextContent("1 lançados");
    expect(rule).toHaveTextContent("Ativa");
  });

  it("hides repetition when installments are typed", async () => {
    const user = userEvent.setup();
    renderWithProviders(<App />, recSeed());
    await user.click(screen.getByRole("button", { name: "Novo lançamento" }));
    const dialog = await screen.findByRole("dialog");
    await within(dialog).findByRole("option", { name: "Conta Itaú" });
    await user.type(within(dialog).getByLabelText("Valor"), "300,00");
    await user.type(within(dialog).getByLabelText("Nº de parcelas"), "3");
    expect(within(dialog).queryByLabelText("Repetir")).not.toBeInTheDocument();
  });

  it("offers repetition for income but not for transfers", async () => {
    const user = userEvent.setup();
    renderWithProviders(<App />, recSeed());
    await user.click(screen.getByRole("button", { name: "Novo lançamento" }));
    const dialog = await screen.findByRole("dialog");
    await within(dialog).findByRole("option", { name: "Conta Itaú" });
    await user.click(within(dialog).getByRole("radio", { name: "Receita" }));
    expect(within(dialog).getByLabelText("Repetir")).toBeInTheDocument();
    await user.click(within(dialog).getByRole("radio", { name: "Transferência" }));
    expect(within(dialog).queryByLabelText("Repetir")).not.toBeInTheDocument();
  });

  it("pauses, resumes, edits and (when nothing was posted) deletes a rule", async () => {
    const user = userEvent.setup();
    const repo = recSeed();
    await repo.createRecurring({
      kind: "income", amountCents: 300000, description: "Salário", accountId: 1, cardId: null, categoryId: null, personId: 1,
      frequency: "monthly", startDate: "2099-01-05", endDate: null,
    });
    renderWithProviders(<App />, repo, "/recurring");
    const rule = () => screen.getByText("Salário").closest("li")!;
    await screen.findByText("Salário");
    await user.click(within(rule()).getByRole("button", { name: /Pausar Salário/ }));
    await waitFor(() => expect(rule()).toHaveTextContent("Pausada"));
    await user.click(within(rule()).getByRole("button", { name: /Retomar Salário/ }));
    await waitFor(() => expect(rule()).toHaveTextContent("Ativa"));

    await user.click(within(rule()).getByRole("button", { name: /Editar Salário/ }));
    const dialog = await screen.findByRole("dialog");
    const amount = within(dialog).getByLabelText("Valor");
    await user.clear(amount);
    await user.type(amount, "3.500,00");
    await user.click(within(dialog).getByRole("button", { name: "Salvar" }));
    await waitFor(() => expect(nbsp(rule().textContent!)).toContain("R$ 3.500,00"));

    await user.click(within(rule()).getByRole("button", { name: /Excluir Salário/ }));
    await waitFor(() => expect(screen.queryByText("Salário")).not.toBeInTheDocument());
  });

  it("does not offer deleting a rule that already posted", async () => {
    const repo = recSeed();
    await repo.createRecurring({
      kind: "expense", amountCents: 120000, description: "Aluguel", accountId: 1, cardId: null, categoryId: null, personId: 1,
      frequency: "monthly", startDate: today, endDate: null,
    });
    renderWithProviders(<App />, repo, "/recurring");
    const rule = (await screen.findByText("Aluguel")).closest("li")!;
    expect(within(rule).queryByRole("button", { name: /Excluir/ })).not.toBeInTheDocument();
    expect(within(rule).getByRole("button", { name: /Pausar Aluguel/ })).toBeInTheDocument();
  });

  it("explains that a rule needs a description-free amount and validates the edit", async () => {
    const user = userEvent.setup();
    const repo = recSeed();
    await repo.createRecurring({
      kind: "expense", amountCents: 10000, description: "Academia", accountId: 1, cardId: null, categoryId: null, personId: 1,
      frequency: "monthly", startDate: "2099-01-05", endDate: null,
    });
    renderWithProviders(<App />, repo, "/recurring");
    await user.click(await screen.findByRole("button", { name: /Editar Academia/ }));
    const dialog = await screen.findByRole("dialog");
    const amount = within(dialog).getByLabelText("Valor");
    await user.clear(amount);
    await user.type(amount, "abc");
    await user.click(within(dialog).getByRole("button", { name: "Salvar" }));
    expect(await within(dialog).findByText("Informe um valor válido.")).toBeInTheDocument();
  });
});
