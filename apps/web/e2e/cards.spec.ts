import { expect, test } from "@playwright/test";

test("charges a purchase to a card and pays the statement with interest", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Nova conta" }).click();
  let dialog = page.getByRole("dialog");
  await dialog.getByLabel("Nome").fill("Conta Cartao");
  await dialog.getByLabel("Saldo inicial").fill("1.000,00");
  await dialog.getByRole("button", { name: "Salvar" }).click();
  const accountRow = page.getByRole("listitem").filter({ hasText: "Conta Cartao" });
  await expect(accountRow).toContainText("1.000,00");

  await page.getByRole("link", { name: "Cartões" }).click();
  await page.getByRole("button", { name: "Novo cartão" }).click();
  dialog = page.getByRole("dialog");
  await dialog.getByLabel("Nome").fill("Nubank");
  await dialog.getByLabel("Limite").fill("5.000,00");
  await dialog.getByLabel("Dia de fechamento").fill("25");
  await dialog.getByLabel("Dia de vencimento").fill("5");
  await dialog.getByRole("button", { name: "Salvar" }).click();
  await expect(page.getByRole("link", { name: /Nubank/ })).toContainText("Disponível: R$ 5.000,00");

  await page.getByRole("button", { name: "Novo lançamento" }).click();
  dialog = page.getByRole("dialog");
  await dialog.getByLabel("Valor").fill("200,00");
  await dialog.getByLabel("Conta ou cartão").selectOption({ label: "Nubank" });
  await dialog.getByLabel("Descrição").fill("Tênis");
  await dialog.getByRole("button", { name: "Salvar" }).click();
  await expect(page.getByRole("link", { name: /Nubank/ })).toContainText("Disponível: R$ 4.800,00");

  await page.getByRole("link", { name: "Início" }).click();
  await expect(accountRow).toContainText("1.000,00");

  await page.getByRole("link", { name: "Cartões" }).click();
  await page.getByRole("link", { name: /Nubank/ }).click();
  await expect(page.getByTestId("statement-total")).toContainText("200,00");
  await expect(page.getByText("Tênis")).toBeVisible();

  await page.getByRole("button", { name: "Pagar fatura" }).click();
  dialog = page.getByRole("dialog");
  await dialog.getByLabel("Conta", { exact: false }).first().selectOption({ label: "Conta Cartao" });
  await dialog.getByLabel("Juros").fill("10,00");
  await dialog.getByRole("button", { name: "Salvar" }).click();
  await expect(page.getByText("Juros e multas")).toBeVisible();

  await page.getByRole("link", { name: "Início" }).click();
  await expect(accountRow).toContainText("790,00");
});
