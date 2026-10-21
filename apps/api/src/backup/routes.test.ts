import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../app";
import { createDatabase } from "../db/client";

let dir: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "finfamily-routes-"));
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

const makeApp = (keep = 2) =>
  createApp(createDatabase(join(dir, "app.db")), { backup: { dir: join(dir, "backups"), keep, intervalHours: 24 } });
const get = async (app: ReturnType<typeof makeApp>, path: string, method = "GET") => {
  const res = await app.request(path, { method });
  return { status: res.status, body: await res.json() };
};

describe("backup API", () => {
  it("starts with no backups and reports the schedule", async () => {
    const { status, body } = await get(makeApp(), "/api/backup");
    expect(status).toBe(200);
    expect(body).toEqual({ backups: [], lastBackupAt: null, schedule: { intervalHours: 24, keep: 2 } });
  });

  it("makes a backup on demand and lists it", async () => {
    const app = makeApp();
    const created = await get(app, "/api/backup", "POST");
    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({ name: expect.stringMatching(/^finfamily-\d{8}-\d{6}\.db$/), sizeBytes: expect.any(Number) });
    const list = (await get(app, "/api/backup")).body;
    expect(list.backups).toHaveLength(1);
    expect(list.lastBackupAt).toBe(list.backups[0].createdAt);
  });

  it("never exposes server paths", async () => {
    const app = makeApp();
    await get(app, "/api/backup", "POST");
    const text = JSON.stringify((await get(app, "/api/backup")).body);
    expect(text).not.toContain(dir);
  });

  it("is not available when backups are not configured", async () => {
    const app = createApp(createDatabase(":memory:"));
    expect((await get(app, "/api/backup")).status).toBe(404);
  });
});
