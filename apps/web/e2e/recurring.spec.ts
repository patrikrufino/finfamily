import { expect, test } from "@playwright/test";

test("creates a monthly recurring expense, sees it posted and in the forecast, then pauses it", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Nova conta" }).click();
  let dialog = page.getByRole("dialog");
  await dialog.getByLabel("Nome").fill("Conta Recorrente");
  await dialog.getByLabel("Saldo inicial").fill("1.000,00");
  await dialog.getByRole("button", { name: "Salvar" }).click();
  const row = page.getByRole("listitem").filter({ hasText: "Conta Recorrente" });
  await expect(row).toContainText("1.000,00");

  await page.getByRole("button", { name: "Novo lançamento" }).click();
  dialog = page.getByRole("dialog");
  await dialog.getByLabel("Valor").fill("100,00");
  await dialog.getByLabel("Descrição").fill("Assinatura");
  await dialog.locator("#tx-account").selectOption({ label: "Conta Recorrente" });
  await dialog.getByLabel("Repetir").selectOption({ label: "Todo mês" });
  await dialog.getByRole("button", { name: "Salvar" }).click();
  await expect(row).toContainText("900,00");

  await expect(page.getByRole("heading", { name: "Previsão" })).toBeVisible();
  await expect(page.getByTestId(/^forecast-/)).toHaveCount(6);
  await expect(page.getByTestId("month-result")).toBeVisible();

  await page.getByRole("link", { name: "Lançamentos" }).click();
  await expect(page.getByRole("button", { name: /Assinatura/ })).toContainText("Recorrente");
  await page.getByRole("link", { name: "Recorrentes" }).click();
  const rule = page.getByRole("listitem").filter({ hasText: "Assinatura" });
  await expect(rule).toContainText("Ativa");
  await rule.getByRole("button", { name: /Pausar Assinatura/ }).click();
  await expect(rule).toContainText("Pausada");
});
