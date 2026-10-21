import { expect, test } from "@playwright/test";

test("a new database starts with the basic income and expense categories, each with an icon", async ({ page }) => {
  await page.goto("/categories");
  for (const [name, icon] of [["Moradia", "🏠"], ["Assinaturas", "📺"], ["Mercado", "🛒"], ["Comida fora", "🍽️"], ["Vestuário", "👕"], ["Dívidas", "📉"], ["Outros", "📦"]]) {
    await expect(page.getByRole("button", { name: `Editar categoria: ${name}` })).toContainText(icon!);
  }
  await page.getByRole("tab", { name: "Receitas" }).click();
  for (const name of ["Salário", "Projetos", "Outras receitas"]) {
    await expect(page.getByRole("button", { name: `Editar categoria: ${name}` })).toBeVisible();
  }
  await expect(page.getByRole("button", { name: "Editar categoria: Mercado" })).toHaveCount(0);
});

test("income and expense categories are kept apart in the forms and in the budget", async ({ page }) => {
  await page.goto("/categories");
  await page.getByRole("tab", { name: "Receitas" }).click();
  await page.getByRole("button", { name: "Nova categoria" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Nome").fill("Freelas");
  await dialog.getByRole("radio", { name: "🤝" }).click();
  await dialog.getByRole("button", { name: "Salvar" }).click();
  await expect(page.getByRole("button", { name: "Editar categoria: Freelas" })).toContainText("🤝");

  // The budget lists expense categories only.
  await page.getByRole("link", { name: /Voltar/ }).click();
  await expect(page.getByRole("button", { name: /Mercado/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /Freelas/ })).toHaveCount(0);

  // The transaction form offers each kind its own categories.
  await page.getByRole("button", { name: "Novo lançamento" }).click();
  const form = page.getByRole("dialog");
  await expect(form.getByLabel("Categoria").locator("option", { hasText: "🛒 Mercado" })).toHaveCount(1);
  await expect(form.getByLabel("Categoria").locator("option", { hasText: "Freelas" })).toHaveCount(0);
  await form.getByRole("radio", { name: "Receita" }).check({ force: true });
  await expect(form.getByLabel("Categoria").locator("option", { hasText: "🤝 Freelas" })).toHaveCount(1);
  await expect(form.getByLabel("Categoria").locator("option", { hasText: "Mercado" })).toHaveCount(0);
});
