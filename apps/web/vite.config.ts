/// <reference types="vitest/config" />
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { readFileSync } from "node:fs";
import { VitePWA } from "vite-plugin-pwa";

const { version } = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8")) as { version: string };

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["icon.svg", "apple-touch-icon.png"],
      manifest: {
        id: "/",
        name: "FinFamily",
        short_name: "FinFamily",
        description: "Controle financeiro da família: contas, orçamento, cartões, parcelas e dívidas.",
        lang: "pt-BR",
        dir: "ltr",
        start_url: "/",
        scope: "/",
        display: "standalone",
        orientation: "portrait",
        background_color: "#0f1115",
        theme_color: "#0f766e",
        categories: ["finance", "productivity"],
        icons: [
          { src: "pwa-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
          { src: "pwa-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
          { src: "pwa-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
          { src: "icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
        ],
        shortcuts: [
          { name: "Novo lançamento", short_name: "Lançar", url: "/?new=1", icons: [{ src: "pwa-192.png", sizes: "192x192", type: "image/png" }] },
          { name: "Orçamento", url: "/budget", icons: [{ src: "pwa-192.png", sizes: "192x192", type: "image/png" }] },
          { name: "Cartões", url: "/cards", icons: [{ src: "pwa-192.png", sizes: "192x192", type: "image/png" }] },
        ],
      },
      workbox: {
        // The shell is cached; data always comes from the server, so API calls are never cached.
        navigateFallback: "/index.html",
        navigateFallbackDenylist: [/^\/api\//],
        globPatterns: ["**/*.{js,css,html,svg,png,webmanifest}"],
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: true,
      },
    }),
  ],
  define: { __APP_VERSION__: JSON.stringify(version) },
  // Dev: the app on 3152 (same port as in production) proxies /api to the API on 3132.
  server: { host: true, port: 3152, strictPort: true, proxy: { "/api": "http://localhost:3132" } },
  preview: { host: true, port: 3152, strictPort: true, proxy: { "/api": "http://localhost:3132" } },
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    css: false,
    exclude: ["e2e/**", "node_modules/**"],
  },
});
