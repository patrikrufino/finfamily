import { expect, test } from "@playwright/test";

test("shows the mobile shell in pt-BR and navigates", async ({ page }) => {
  await page.goto("/");
  const nav = page.getByRole("navigation", { name: "Navegação principal" });
  await expect(nav).toBeVisible();
  await nav.getByRole("link", { name: "Dívidas" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Dívidas" })).toBeVisible();
});

test("exposes a PWA manifest", async ({ page }) => {
  await page.goto("/");
  const href = await page.locator('link[rel="manifest"]').getAttribute("href");
  const manifest = await (await page.request.get(href!)).json();
  expect(manifest.name).toBe("FinFamily");
  expect(manifest.display).toBe("standalone");
});
