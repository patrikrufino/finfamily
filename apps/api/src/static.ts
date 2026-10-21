import { existsSync, readFileSync, statSync } from "node:fs";
import { extname, join, normalize, sep } from "node:path";
import type { Context } from "hono";

const TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".txt": "text/plain; charset=utf-8",
  ".map": "application/json; charset=utf-8",
};

/** Files that must be revalidated on every load so updates reach the phones. */
const ALWAYS_REVALIDATE = new Set(["/index.html", "/sw.js", "/manifest.webmanifest", "/registerSW.js"]);

function cacheControl(urlPath: string): string {
  if (ALWAYS_REVALIDATE.has(urlPath) || urlPath.startsWith("/workbox-")) return "no-cache";
  if (urlPath.startsWith("/assets/")) return "public, max-age=31536000, immutable";
  return "public, max-age=3600";
}

function respond(file: string, urlPath: string): Response {
  const type = TYPES[extname(file)] ?? "application/octet-stream";
  return new Response(new Uint8Array(readFileSync(file)), { headers: { "content-type": type, "cache-control": cacheControl(urlPath) } });
}

/**
 * Serves the built web app from `dist`. Client-side routes (paths without a file extension) fall back to index.html;
 * a missing file with an extension is a real 404. Paths can never leave `dist`.
 */
export function serveWeb(dist: string) {
  const root = normalize(dist);
  return (c: Context) => {
    let urlPath: string;
    try {
      urlPath = decodeURIComponent(new URL(c.req.url).pathname);
    } catch {
      return c.notFound();
    }
    if (urlPath.includes("\0")) return c.notFound();

    const requested = urlPath === "/" ? "/index.html" : urlPath;
    const file = normalize(join(root, requested));
    if (file !== root && !file.startsWith(root + sep)) return c.notFound();

    if (existsSync(file) && statSync(file).isFile()) return respond(file, requested);
    if (extname(requested) === "") return respond(join(root, "index.html"), "/index.html");
    return c.notFound();
  };
}
