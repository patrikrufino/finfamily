import { expect, test } from "@playwright/test";

test("sets a category budget and sees it consumed by an expense", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Nova conta" }).click();
  let dialog = page.getByRole("dialog");
  await dialog.getByLabel("Nome").fill("Conta Budget");
  await dialog.getByRole("button", { name: "Salvar" }).click();
  await expect(page.getByText("Conta Budget")).toBeVisible();

  await page.getByRole("link", { name: "Orçamento" }).click();
  await page.getByRole("button", { name: "Nova categoria" }).click();
  dialog = page.getByRole("dialog");
  await dialog.getByLabel("Nome").fill("Lazer");
  await dialog.getByRole("button", { name: "Salvar" }).click();

  await page.getByRole("button", { name: /Lazer/ }).click();
  dialog = page.getByRole("dialog");
  await dialog.getByLabel("Valor mensal").fill("800,00");
  await dialog.getByRole("button", { name: "Salvar" }).click();

  await page.getByRole("button", { name: "Novo lançamento" }).click();
  dialog = page.getByRole("dialog");
  await dialog.getByLabel("Valor").fill("200,00");
  await dialog.getByLabel("Categoria").selectOption({ label: "Lazer" });
  await dialog.getByRole("button", { name: "Salvar" }).click();

  await expect(page.getByRole("progressbar", { name: "Lazer" })).toHaveAttribute("aria-valuenow", "25");
  await expect(page.getByRole("button", { name: /Lazer/ })).toContainText("25% usado");
});
