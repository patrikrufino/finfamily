import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { loadConfig, loadTlsOptions } from "./config";

describe("loadConfig", () => {
  it("has sensible defaults for running at home", () => {
    const c = loadConfig({}, "/srv/app");
    expect(c).toMatchObject({
      port: 3333,
      databasePath: "finfamily.db",
      backup: { dir: "backups", keep: 14, intervalHours: 24 },
    });
  });

  it("keeps backups next to the database by default", () => {
    expect(loadConfig({ DATABASE_PATH: "/data/fin/finfamily.db" }, "/srv/app").backup.dir).toBe("/data/fin/backups");
  });

  it("reads overrides from the environment", () => {
    const c = loadConfig({ PORT: "8080", DATABASE_PATH: "x.db", BACKUP_DIR: "/b", BACKUP_KEEP: "3", BACKUP_INTERVAL_HOURS: "6", WEB_DIST: "/www" }, "/srv/app");
    expect(c).toMatchObject({ port: 8080, databasePath: "x.db", webDist: "/www", backup: { dir: "/b", keep: 3, intervalHours: 6 } });
  });

  it("allows turning the schedule off", () => {
    expect(loadConfig({ BACKUP_INTERVAL_HOURS: "0" }, "/srv/app").backup.intervalHours).toBe(0);
  });

  it("rejects invalid numbers instead of silently using defaults", () => {
    expect(() => loadConfig({ PORT: "abc" }, "/srv/app")).toThrow(/PORT/);
    expect(() => loadConfig({ BACKUP_KEEP: "0" }, "/srv/app")).toThrow(/BACKUP_KEEP/);
    expect(() => loadConfig({ BACKUP_INTERVAL_HOURS: "-1" }, "/srv/app")).toThrow(/BACKUP_INTERVAL_HOURS/);
  });
});

describe("loadTlsOptions", () => {
  it("is null without TLS settings", () => {
    expect(loadTlsOptions({})).toBeNull();
  });

  it("reads the certificate and key files", () => {
    const dir = mkdtempSync(join(tmpdir(), "finfamily-tls-"));
    writeFileSync(join(dir, "cert.pem"), "CERT");
    writeFileSync(join(dir, "key.pem"), "KEY");
    const tls = loadTlsOptions({ TLS_CERT: join(dir, "cert.pem"), TLS_KEY: join(dir, "key.pem") });
    expect(tls?.cert.toString()).toBe("CERT");
    expect(tls?.key.toString()).toBe("KEY");
    rmSync(dir, { recursive: true });
  });

  it("requires both files, and that they exist", () => {
    expect(() => loadTlsOptions({ TLS_CERT: "/c.pem" })).toThrow(/TLS_KEY/);
    expect(() => loadTlsOptions({ TLS_KEY: "/k.pem" })).toThrow(/TLS_CERT/);
    expect(() => loadTlsOptions({ TLS_CERT: "/nope/c.pem", TLS_KEY: "/nope/k.pem" })).toThrow(/not found|ENOENT/i);
  });
});
