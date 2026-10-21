import { expect, test } from "@playwright/test";

test("registers a debt, posts interest and pays part of it from an account", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Nova conta" }).click();
  let dialog = page.getByRole("dialog");
  await dialog.getByLabel("Nome").fill("Conta Dividas");
  await dialog.getByLabel("Saldo inicial").fill("1.000,00");
  await dialog.getByRole("button", { name: "Salvar" }).click();
  const row = page.getByRole("listitem").filter({ hasText: "Conta Dividas" });
  await expect(row).toContainText("1.000,00");

  await page.getByRole("navigation", { name: "Navegação principal" }).getByRole("link", { name: "Dívidas" }).click();
  await page.getByRole("button", { name: "Nova dívida" }).click();
  dialog = page.getByRole("dialog");
  await dialog.getByLabel("Credor").fill("Financiamento");
  await dialog.getByLabel("Valor original").fill("500,00");
  await dialog.getByRole("button", { name: "Salvar" }).click();
  await expect(page.getByTestId("total-owed")).toContainText("500,00");

  await page.getByRole("link", { name: /Financiamento/ }).click();
  await page.getByRole("button", { name: "Lançar juros" }).click();
  dialog = page.getByRole("dialog");
  await dialog.getByLabel("Valor").fill("50,00");
  await dialog.getByRole("button", { name: "Salvar" }).click();
  await expect(page.getByTestId("debt-balance")).toContainText("550,00");

  await page.getByRole("button", { name: "Pagar", exact: true }).click();
  dialog = page.getByRole("dialog");
  await dialog.getByLabel("Pagar com a conta").selectOption({ label: "Conta Dividas" });
  await dialog.getByLabel("Valor", { exact: true }).fill("200,00");
  await dialog.getByRole("button", { name: "Salvar" }).click();
  await expect(page.getByTestId("debt-balance")).toContainText("350,00");

  await page.getByRole("link", { name: "Início" }).click();
  await expect(row).toContainText("800,00");
});
