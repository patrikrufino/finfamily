import { expect, test } from "@playwright/test";

test("sets a category budget and sees it consumed by an expense", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Nova conta" }).click();
  let dialog = page.getByRole("dialog");
  await dialog.getByLabel("Nome").fill("Conta Budget");
  await dialog.getByRole("button", { name: "Salvar" }).click();
  await expect(page.getByText("Conta Budget")).toBeVisible();

  await page.getByRole("link", { name: "Orçamento" }).click();
  await page.getByRole("link", { name: "Gerenciar categorias" }).click();
  await page.getByRole("button", { name: "Nova categoria" }).click();
  dialog = page.getByRole("dialog");
  await dialog.getByLabel("Nome").fill("Estudos");
  await dialog.getByRole("radio", { name: "🎬" }).click();
  await dialog.getByRole("button", { name: "Salvar" }).click();
  await expect(page.getByRole("button", { name: /Editar categoria: Estudos/ })).toContainText("🎬");
  await page.getByRole("link", { name: /Voltar/ }).click();

  await page.getByRole("button", { name: /Estudos/ }).click();
  dialog = page.getByRole("dialog");
  await dialog.getByLabel("Valor mensal").fill("800,00");
  await dialog.getByRole("button", { name: "Salvar" }).click();

  await page.getByRole("button", { name: "Novo lançamento" }).click();
  dialog = page.getByRole("dialog");
  await dialog.getByLabel("Valor").fill("200,00");
  await dialog.getByLabel("Categoria").selectOption({ label: "🎬 Estudos" });
  await dialog.getByRole("button", { name: "Salvar" }).click();

  await expect(page.getByRole("progressbar", { name: "Estudos" })).toHaveAttribute("aria-valuenow", "25");
  await expect(page.getByRole("button", { name: /Estudos/ })).toContainText("25% usado");
});
