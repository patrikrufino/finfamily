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

test("bottom navigation is thumb friendly and the quick-add button does not cover it", async ({ page }) => {
  await page.goto("/");
  const nav = page.getByRole("navigation", { name: "Navegação principal" });
  const links = nav.getByRole("link");
  await expect(links).toHaveCount(5);

  for (const link of await links.all()) {
    const box = (await link.boundingBox())!;
    expect(box.height).toBeGreaterThanOrEqual(48); // minimum comfortable touch target
    expect(box.width).toBeGreaterThanOrEqual(48);
    await expect(link.locator("svg")).toBeVisible();
  }

  const navBox = (await nav.boundingBox())!;
  const fabBox = (await page.getByRole("button", { name: "Novo lançamento" }).boundingBox())!;
  expect(fabBox.y + fabBox.height).toBeLessThanOrEqual(navBox.y); // FAB sits above the bar
  expect(navBox.y + navBox.height).toBeLessThanOrEqual(page.viewportSize()!.height + 1);
});

test("the last item of a long page stays reachable above the quick-add button", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => {
    const filler = document.createElement("div");
    filler.style.height = "1500px";
    filler.id = "filler";
    document.querySelector("main")!.appendChild(filler);
  });
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  const filler = (await page.locator("#filler").boundingBox())!;
  const fab = (await page.getByRole("button", { name: "Novo lançamento" }).boundingBox())!;
  expect(filler.y + filler.height).toBeLessThanOrEqual(fab.y);
});
