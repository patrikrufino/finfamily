// Renders the PWA icons (PNG) from the SVG masters. Run with `pnpm --filter @finfamily/web icons`.
// Set CHROMIUM_PATH if Playwright's browser is not installed.
import { chromium } from "@playwright/test";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const targets = [
  { svg: "public/icon.svg", out: "public/pwa-192.png", size: 192, transparent: true },
  { svg: "public/icon.svg", out: "public/pwa-512.png", size: 512, transparent: true },
  { svg: "scripts/icons/maskable.svg", out: "public/pwa-maskable-512.png", size: 512 },
  // iOS draws its own rounded corners, so the icon must be full-bleed and opaque.
  { svg: "scripts/icons/maskable.svg", out: "public/apple-touch-icon.png", size: 180 },
];

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || undefined,
  args: ["--no-sandbox"],
});
const page = await browser.newPage();
for (const { svg, out, size, transparent } of targets) {
  const markup = readFileSync(join(root, svg), "utf8").replace("<svg ", `<svg width="${size}" height="${size}" `);
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<!doctype html><html style="background:transparent"><body style="margin:0;background:transparent">${markup}</body></html>`);
  writeFileSync(join(root, out), await page.screenshot({ omitBackground: Boolean(transparent), clip: { x: 0, y: 0, width: size, height: size } }));
  console.log(`wrote ${out} (${size}x${size})`);
}
await browser.close();
