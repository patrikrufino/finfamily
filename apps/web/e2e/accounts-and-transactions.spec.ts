import { expect, test } from "@playwright/test";

test("creates an account, records income and an expense, and sees the balance", async ({ page }) => {
  await page.goto("/");

  await page.getByRole("button", { name: "Nova conta" }).click();
  let dialog = page.getByRole("dialog");
  await dialog.getByLabel("Nome").fill("Conta Corrente");
  await dialog.getByLabel("Saldo inicial").fill("1.000,00");
  await dialog.getByRole("button", { name: "Salvar" }).click();
  await expect(page.getByTestId("total-balance")).toHaveText(/1\.000,00/);

  await page.getByRole("radio", { name: "Heloisa" }).check({ force: true });

  await page.getByRole("button", { name: "Novo lançamento" }).click();
  dialog = page.getByRole("dialog");
  await dialog.getByLabel("Valor").fill("2.500,00");
  await dialog.getByLabel("Descrição").fill("Salário");
  await dialog.getByRole("radio", { name: "Receita" }).check({ force: true });
  await dialog.getByRole("button", { name: "Salvar" }).click();
  await expect(page.getByTestId("total-balance")).toHaveText(/3\.500,00/);

  await page.getByRole("button", { name: "Novo lançamento" }).click();
  dialog = page.getByRole("dialog");
  await dialog.getByLabel("Valor").fill("320,40");
  await dialog.getByLabel("Descrição").fill("Mercado");
  await dialog.getByRole("button", { name: "Salvar" }).click();
  await expect(page.getByTestId("total-balance")).toHaveText(/3\.179,60/);

  await page.getByRole("link", { name: "Lançamentos" }).click();
  await expect(page.getByRole("button", { name: /Salário.*Heloisa/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /Mercado/ })).toContainText("-R$");
});
