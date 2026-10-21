import { act, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { i18n } from "../../i18n";
import { createFakeRepository } from "../../test/fakeRepository";
import { renderHookWithProviders } from "../../test/render";
import { useSettingsViewModel } from "./useSettingsViewModel";

beforeEach(async () => {
  await i18n.changeLanguage("pt-BR");
});

describe("useSettingsViewModel", () => {
  it("exposes the current language and switches it, remembering the choice", async () => {
    const { result } = renderHookWithProviders(() => useSettingsViewModel(), createFakeRepository());
    expect(result.current.locale).toBe("pt-BR");
    expect(result.current.locales).toEqual(["pt-BR", "en"]);
    await act(async () => { await result.current.changeLocale("en"); });
    await waitFor(() => expect(result.current.locale).toBe("en"));
    expect(localStorage.getItem("finfamily.locale")).toBe("en");
  });

  it("lists the backups, newest first, with the last one and the schedule", async () => {
    const repo = createFakeRepository({
      backups: [
        { name: "finfamily-20261019-100000.db", sizeBytes: 1000, createdAt: "2026-10-19T10:00:00.000Z" },
        { name: "finfamily-20261020-100000.db", sizeBytes: 2000, createdAt: "2026-10-20T10:00:00.000Z" },
      ],
    });
    const { result } = renderHookWithProviders(() => useSettingsViewModel(), repo);
    await waitFor(() => expect(result.current.backups).toBeDefined());
    expect(result.current.backups?.backups.map((b) => b.name)).toEqual(["finfamily-20261020-100000.db", "finfamily-20261019-100000.db"]);
    expect(result.current.backups?.lastBackupAt).toBe("2026-10-20T10:00:00.000Z");
    expect(result.current.backups?.schedule).toEqual({ intervalHours: 24, keep: 14 });
    expect(result.current.backupsEnabled).toBe(true);
  });

  it("knows when the server has no backups configured", async () => {
    const { result } = renderHookWithProviders(() => useSettingsViewModel(), createFakeRepository({ backups: false }));
    await waitFor(() => expect(result.current.backupsLoaded).toBe(true));
    expect(result.current.backupsEnabled).toBe(false);
  });

  it("makes a backup on demand and refreshes the list", async () => {
    const repo = createFakeRepository();
    const { result } = renderHookWithProviders(() => useSettingsViewModel(), repo);
    await waitFor(() => expect(result.current.backupsLoaded).toBe(true));
    expect(result.current.backups?.backups).toHaveLength(0);
    let outcome: unknown;
    await act(async () => { outcome = await result.current.createBackup(); });
    expect(outcome).toEqual({ ok: true });
    await waitFor(() => expect(result.current.backups?.backups).toHaveLength(1));
  });

  it("reports a failed backup", async () => {
    const repo = createFakeRepository();
    repo.createBackup = async () => { throw new Error("disk full"); };
    const { result } = renderHookWithProviders(() => useSettingsViewModel(), repo);
    let outcome: unknown;
    await act(async () => { outcome = await result.current.createBackup(); });
    expect(outcome).toEqual({ ok: false, error: "backup_failed" });
  });

  it("exposes the install state and the app version", () => {
    const { result } = renderHookWithProviders(() => useSettingsViewModel(), createFakeRepository());
    expect(result.current.installState).toBe("unavailable");
    expect(typeof result.current.version).toBe("string");
  });
});
