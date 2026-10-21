import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  // The specs share one SQLite database, so they must not run concurrently.
  workers: 1,
  fullyParallel: false,
  use: {
    baseURL: "http://localhost:4173",
    ...devices["Pixel 7"],
    locale: "pt-BR",
    launchOptions: process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {},
  },
  webServer: [
    {
      command: "rm -f /tmp/finfamily-e2e.db* && DATABASE_PATH=/tmp/finfamily-e2e.db PORT=3333 pnpm --filter @finfamily/api start",
      url: "http://localhost:3333/api/health",
      reuseExistingServer: false,
      timeout: 60_000,
    },
    {
      command: "pnpm build && pnpm preview --port 4173 --strictPort",
      url: "http://localhost:4173",
      reuseExistingServer: true,
      timeout: 120_000,
    },
  ],
});
