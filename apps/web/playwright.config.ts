import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  // The specs share one SQLite database, so they must not run concurrently.
  workers: 1,
  fullyParallel: false,
  use: {
    baseURL: "http://localhost:3152",
    ...devices["Pixel 7"],
    locale: "pt-BR",
    launchOptions: process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {},
  },
  // Same as at home: one process serves the API (3132) and the built web app (3152).
  webServer: {
    command:
      "pnpm build && rm -rf /tmp/finfamily-e2e.db* /tmp/finfamily-e2e-backups && " +
      "DATABASE_PATH=/tmp/finfamily-e2e.db BACKUP_DIR=/tmp/finfamily-e2e-backups API_PORT=3132 WEB_PORT=3152 WEB_DIST=$PWD/dist pnpm --filter @finfamily/api start",
    url: "http://localhost:3152/api/health",
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
