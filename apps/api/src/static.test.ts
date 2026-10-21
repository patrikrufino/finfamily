import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "./app";
import { createDatabase } from "./db/client";

let dist: string;
beforeEach(() => {
  dist = mkdtempSync(join(tmpdir(), "finfamily-dist-"));
  mkdirSync(join(dist, "assets"));
  writeFileSync(join(dist, "index.html"), "<!doctype html><title>FinFamily</title>");
  writeFileSync(join(dist, "assets", "app-abc123.js"), "console.log(1)");
  writeFileSync(join(dist, "sw.js"), "// sw");
  writeFileSync(join(dist, "manifest.webmanifest"), "{}");
  writeFileSync(join(dist, "icon.svg"), "<svg/>");
  writeFileSync(join(dist, "pwa-192.png"), "png");
});
afterEach(() => rmSync(dist, { recursive: true, force: true }));

const app = () => createApp(createDatabase(":memory:"), { webDist: dist });

describe("serving the web app", () => {
  it("serves index.html at the root without caching it", async () => {
    const res = await app().request("/");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/html");
    expect(res.headers.get("cache-control")).toBe("no-cache");
    expect(await res.text()).toContain("FinFamily");
  });

  it("serves hashed assets as immutable, with the right type", async () => {
    const res = await app().request("/assets/app-abc123.js");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("javascript");
    expect(res.headers.get("cache-control")).toContain("immutable");
  });

  it("serves the service worker and manifest so they are always revalidated", async () => {
    const sw = await app().request("/sw.js");
    expect(sw.headers.get("cache-control")).toBe("no-cache");
    expect(sw.headers.get("content-type")).toContain("javascript");
    const manifest = await app().request("/manifest.webmanifest");
    expect(manifest.headers.get("content-type")).toContain("manifest+json");
    expect((await app().request("/icon.svg")).headers.get("content-type")).toContain("image/svg+xml");
    expect((await app().request("/pwa-192.png")).headers.get("content-type")).toBe("image/png");
  });

  it("falls back to the app for client-side routes", async () => {
    for (const path of ["/cards/3", "/installments", "/debts/9"]) {
      const res = await app().request(path);
      expect(res.status).toBe(200);
      expect(await res.text()).toContain("FinFamily");
    }
  });

  it("returns 404 for missing files and unknown API paths instead of the app", async () => {
    expect((await app().request("/assets/missing.js")).status).toBe(404);
    const api = await app().request("/api/nope");
    expect(api.status).toBe(404);
    expect(await api.json()).toEqual({ errors: ["not_found"] });
  });

  it("does not let paths escape the web folder", async () => {
    writeFileSync(join(dist, "..", "secret.txt"), "secret");
    for (const path of ["/../secret.txt", "/%2e%2e/secret.txt", "/assets/../../secret.txt"]) {
      const res = await app().request(path);
      expect(await res.text()).not.toBe("secret");
    }
    rmSync(join(dist, "..", "secret.txt"), { force: true });
  });

  it("does not serve anything when no web folder is configured", async () => {
    const bare = createApp(createDatabase(":memory:"));
    expect((await bare.request("/")).status).toBe(404);
  });

  it("keeps the API working next to the web app", async () => {
    const res = await app().request("/api/health");
    expect(await res.json()).toEqual({ status: "ok" });
  });
});
