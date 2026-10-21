import { expect, test } from "@playwright/test";

test("publishes a complete manifest with working icons and shortcuts", async ({ page }) => {
  await page.goto("/");
  const href = await page.locator('link[rel="manifest"]').getAttribute("href");
  const manifest = await (await page.request.get(href!)).json();

  expect(manifest).toMatchObject({ name: "FinFamily", lang: "pt-BR", display: "standalone", orientation: "portrait", start_url: "/", scope: "/" });
  const icons = manifest.icons as { src: string; sizes: string; purpose?: string }[];
  expect(icons.some((i) => i.sizes === "192x192")).toBe(true);
  expect(icons.some((i) => i.sizes === "512x512" && i.purpose === "any")).toBe(true);
  expect(icons.some((i) => i.sizes === "512x512" && i.purpose === "maskable")).toBe(true);
  for (const icon of icons) {
    const res = await page.request.get(`/${icon.src}`);
    expect(res.status(), icon.src).toBe(200);
  }
  expect((manifest.shortcuts as { url: string }[]).map((s) => s.url)).toEqual(["/?new=1", "/budget", "/cards"]);

  await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveAttribute("href", "/apple-touch-icon.png");
  expect((await page.request.get("/apple-touch-icon.png")).headers()["content-type"]).toBe("image/png");
  await expect(page.locator('meta[name="theme-color"]')).toHaveCount(2);
});

test("serves the shell with revalidation headers and the API next to it", async ({ page }) => {
  const index = await page.request.get("/");
  expect(index.headers()["cache-control"]).toBe("no-cache");
  expect((await page.request.get("/sw.js")).headers()["cache-control"]).toBe("no-cache");
  expect((await page.request.get("/cards/1")).status()).toBe(200); // client-side route falls back to the app
  expect((await page.request.get("/api/nope")).status()).toBe(404);
  expect(await (await page.request.get("/api/health")).json()).toEqual({ status: "ok" });
});

test("the app shell opens offline and explains that the server cannot be reached", async ({ page, context }) => {
  await page.goto("/");
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload(); // from here on the service worker controls the page
  await expect.poll(() => page.evaluate(() => navigator.serviceWorker.controller !== null)).toBe(true);

  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole("navigation", { name: "Navegação principal" })).toBeVisible();
  await expect(page.getByRole("status")).toContainText("Sem conexão com o servidor");

  await context.setOffline(false);
  await expect(page.getByRole("status")).toHaveCount(0);
});

test("the new transaction shortcut opens the form and cleans the address", async ({ page }) => {
  await page.goto("/?new=1");
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page).toHaveURL(/\/$/);
});

test("the chosen language is remembered after a reload", async ({ page }) => {
  await page.goto("/settings");
  await page.locator("#language").selectOption("en");
  await expect(page.getByRole("heading", { level: 1, name: "Settings" })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("heading", { level: 1, name: "Settings" })).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await page.locator("#language").selectOption("pt-BR"); // leave the shared database pages in pt-BR for the other specs
  await expect(page.getByRole("heading", { level: 1, name: "Ajustes" })).toBeVisible();
});

test("lists the automatic backup and makes another on demand", async ({ page }) => {
  await page.goto("/settings");
  await expect(page.getByTestId("last-backup")).toContainText("Último backup:");
  const list = page.getByRole("list", { name: "Backups" });
  const before = await list.getByRole("listitem").count();
  await page.getByRole("button", { name: "Fazer backup agora" }).click();
  await expect(page.getByText("Backup criado.")).toBeVisible();
  await expect(list.getByRole("listitem")).toHaveCount(before + 1);
});

test("Settings shows the PWA diagnostics: secure context and an active service worker on localhost", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.goto("/settings");
  await expect(page.getByTestId("diag-secure")).toHaveText("Sim");
  await expect(page.getByTestId("diag-sw")).toHaveText("Ativo");
  await expect(page.getByText(/Você abriu o app por HTTP/)).toHaveCount(0);
});

test("opening the app by its network address over plain HTTP explains why it cannot be installed", async ({ browser }) => {
  const { networkInterfaces } = await import("node:os");
  const ip = Object.values(networkInterfaces()).flat().find((a) => a?.family === "IPv4" && !a.internal)?.address;
  test.skip(!ip, "this machine has no network address");

  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  await page.goto(`http://${ip}:3333/settings`);
  await expect(page.getByTestId("diag-secure")).toHaveText("Não");
  await expect(page.getByTestId("diag-sw")).toHaveText("Indisponível neste endereço");
  await expect(page.getByRole("alert").filter({ hasText: "Você abriu o app por HTTP" })).toContainText(`http://${ip}:3333`);

  // This is what the browser itself reports for the same page.
  const cdp = await context.newCDPSession(page);
  const { installabilityErrors } = await cdp.send("Page.getInstallabilityErrors");
  expect(installabilityErrors.map((e) => e.errorId)).toContain("not-from-secure-origin");
  await context.close();
});
