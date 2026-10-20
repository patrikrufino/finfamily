import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "./app";
import { createDatabase, type AppDatabase } from "./db/client";

describe("API", () => {
  let db: AppDatabase;

  beforeEach(() => {
    db = createDatabase(":memory:");
  });

  it("reports health", async () => {
    const res = await createApp(db).request("/api/health");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "ok" });
  });

  it("seeds the two household members", async () => {
    const res = await createApp(db).request("/api/people");
    expect(res.status).toBe(200);
    const body = (await res.json()) as { name: string }[];
    expect(body.map((p) => p.name)).toEqual(["Patrik", "Heloisa"]);
  });

  it("does not duplicate members when the database is opened twice", () => {
    const dir = mkdtempSync(join(tmpdir(), "finfamily-"));
    const path = join(dir, "test.db");
    createDatabase(path).$client.close();
    const reopened = createDatabase(path);
    const row = reopened.$client.prepare("select count(*) as n from people").get() as { n: number };
    reopened.$client.close();
    rmSync(dir, { recursive: true });
    expect(row.n).toBe(2);
  });
});
