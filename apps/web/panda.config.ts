import { defineConfig } from "@pandacss/dev";

export default defineConfig({
  preflight: true,
  include: ["./src/**/*.{ts,tsx}"],
  exclude: [],
  outdir: "styled-system",
  jsxFramework: "react",
  conditions: {
    extend: {
      dark: {
        "[data-theme=dark] &": "@slot",
        "@media (prefers-color-scheme: dark)": { ":root:not([data-theme=light]) &": "@slot" },
      },
    },
  },
  theme: {
    extend: {
      semanticTokens: {
        colors: {
          bg: { value: { base: "#f6f7f9", _dark: "#0f1115" } },
          surface: { value: { base: "#ffffff", _dark: "#181b21" } },
          border: { value: { base: "#e3e6eb", _dark: "#2a2f38" } },
          text: { value: { base: "#14171c", _dark: "#eceff4" } },
          muted: { value: { base: "#5b6573", _dark: "#9aa4b2" } },
          primary: { value: { base: "#0f766e", _dark: "#2dd4bf" } },
          onPrimary: { value: { base: "#ffffff", _dark: "#062a27" } },
        },
      },
    },
  },
});
