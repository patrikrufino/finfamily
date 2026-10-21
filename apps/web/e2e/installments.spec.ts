import { expect, test } from "@playwright/test";

test("splits a purchase in installments, anticipates one with a discount and adjusts the balance", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Nova conta" }).click();
  let dialog = page.getByRole("dialog");
  await dialog.getByLabel("Nome").fill("Conta Parcelas");
  await dialog.getByLabel("Saldo inicial").fill("1.000,00");
  await dialog.getByRole("button", { name: "Salvar" }).click();
  const row = page.getByRole("listitem").filter({ hasText: "Conta Parcelas" });
  await expect(row).toContainText("1.000,00");

  await page.getByRole("button", { name: "Novo lançamento" }).click();
  dialog = page.getByRole("dialog");
  await dialog.getByLabel("Valor").fill("300,00");
  await dialog.getByLabel("Descrição").fill("Geladeira");
  await dialog.locator("#tx-account").selectOption({ label: "Conta Parcelas" });
  await dialog.getByLabel("Nº de parcelas").fill("3");
  await expect(dialog.getByTestId("installment-preview")).toContainText("3x de");
  await dialog.getByRole("button", { name: "Salvar" }).click();
  await expect(row).toContainText("900,00");

  await page.getByRole("link", { name: "Lançamentos" }).click();
  await page.getByRole("link", { name: "Parcelamentos" }).click();
  await page.getByRole("link", { name: /Geladeira/ }).click();
  await expect(page.getByTestId("plan-progress")).toContainText("1 de 3 pagas");

  await page.getByRole("button", { name: "Antecipar" }).click();
  dialog = page.getByRole("dialog");
  await dialog.getByRole("checkbox", { name: /Parcela 3/ }).check();
  await dialog.getByLabel("Valor pago").fill("90,00");
  await expect(dialog.getByTestId("anticipation-summary")).toContainText("Economia");
  await dialog.getByRole("button", { name: "Antecipar" }).click();
  await expect(page.getByText("Antecipação", { exact: true })).toBeVisible();

  await page.getByRole("link", { name: "Início" }).click();
  await expect(row).toContainText("810,00");

  await row.getByRole("button", { name: /Editar Conta Parcelas/ }).click();
  dialog = page.getByRole("dialog");
  await dialog.getByLabel("Saldo real hoje").fill("800,00");
  await expect(dialog.getByTestId("adjust-preview")).toContainText("despesa de ajuste");
  await dialog.getByRole("button", { name: "Ajustar saldo" }).click();
  await expect(row).toContainText("800,00");
});
