import { useState } from "react";
import { useTranslation } from "react-i18next";
import { css } from "../../styled-system/css";
import { useSettingsViewModel } from "../features/settings/useSettingsViewModel";
import { card, errorText, field, primaryButton, secondaryButton } from "../shared/ui";
import { useLocale } from "../shared/useLocale";
import type { Locale } from "../i18n";

const sectionTitle = css({ fontWeight: "bold", fontSize: "lg" });
const hint = css({ color: "muted", fontSize: "sm" });

export function SettingsPage() {
  const { t } = useTranslation();
  const locale = useLocale();
  const vm = useSettingsViewModel();
  const [backupMessage, setBackupMessage] = useState<{ ok: boolean } | null>(null);

  const formatDateTime = (iso: string) => new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(new Date(iso));
  const formatSize = (bytes: number) => `${Math.max(1, Math.round(bytes / 1024))} KB`;

  return (
    <div className={css({ display: "grid", gap: "4" })}>
      <h1 className={css({ fontSize: "xl", fontWeight: "bold" })}>{t("settings.title")}</h1>

      <section aria-labelledby="set-language" className={`${card} ${css({ display: "grid", gap: "2" })}`}>
        <h2 id="set-language" className={sectionTitle}>{t("settings.language")}</h2>
        <select id="language" aria-labelledby="set-language" className={field} value={vm.locale} onChange={(e) => void vm.changeLocale(e.target.value as Locale)}>
          {vm.locales.map((l) => <option key={l} value={l}>{t(`settings.languages.${l}`)}</option>)}
        </select>
      </section>

      <section aria-labelledby="set-install" className={`${card} ${css({ display: "grid", gap: "2" })}`}>
        <h2 id="set-install" className={sectionTitle}>{t("settings.install")}</h2>
        {vm.installState === "available" && (
          <>
            <p className={hint}>{t("settings.installAvailable")}</p>
            <button type="button" className={primaryButton} onClick={() => void vm.install()}>{t("settings.installButton")}</button>
          </>
        )}
        {vm.installState === "installed" && <p className={hint}>{t("settings.installed")}</p>}
        {vm.installState === "ios" && <p className={hint}>{t("settings.installIos")}</p>}
        {vm.installState === "insecure" && <p role="alert" className={css({ color: "red.500", fontSize: "sm" })}>{t("settings.installInsecure", { origin: vm.pwa.origin })}</p>}
        {vm.installState === "unavailable" && <p className={hint}>{t("settings.installUnavailable")}</p>}
        <dl aria-label={t("settings.diagnostics")} className={css({ display: "grid", gridTemplateColumns: "1fr auto", gap: "1", fontSize: "sm", marginTop: "2" })}>
          <dt className={css({ color: "muted" })}>{t("settings.addressLabel")}</dt>
          <dd>{vm.pwa.origin}</dd>
          <dt className={css({ color: "muted" })}>{t("settings.secureLabel")}</dt>
          <dd data-testid="diag-secure" className={css({ fontWeight: "bold", color: vm.pwa.secure ? "primary" : "red.500" })}>{vm.pwa.secure ? t("settings.yes") : t("settings.no")}</dd>
          <dt className={css({ color: "muted" })}>{t("settings.swLabel")}</dt>
          <dd data-testid="diag-sw">{t(`settings.swState.${vm.pwa.serviceWorker}`)}</dd>
          <dt className={css({ color: "muted" })}>{t("settings.displayLabel")}</dt>
          <dd>{vm.pwa.standalone ? t("settings.displayStandalone") : t("settings.displayBrowser")}</dd>
        </dl>
      </section>

      <section aria-labelledby="set-backups" className={`${card} ${css({ display: "grid", gap: "2" })}`}>
        <h2 id="set-backups" className={sectionTitle}>{t("settings.backups")}</h2>
        {!vm.backupsLoaded ? null : !vm.backupsEnabled ? (
          <p className={hint}>{t("settings.backupsDisabled")}</p>
        ) : (
          <>
            <p className={hint}>{t("settings.backupsHint")}</p>
            <p data-testid="backup-schedule" className={hint}>
              {vm.backups!.schedule.intervalHours > 0
                ? t("settings.schedule", { hours: vm.backups!.schedule.intervalHours, keep: vm.backups!.schedule.keep })
                : t("settings.scheduleOff", { keep: vm.backups!.schedule.keep })}
            </p>
            <p data-testid="last-backup" className={css({ fontWeight: "bold" })}>
              {vm.backups!.lastBackupAt ? t("settings.lastBackup", { date: formatDateTime(vm.backups!.lastBackupAt) }) : t("settings.noBackups")}
            </p>
            <button
              type="button"
              className={secondaryButton}
              disabled={vm.isBackingUp}
              onClick={async () => setBackupMessage(await vm.createBackup())}
            >
              {vm.isBackingUp ? t("settings.backingUp") : t("settings.backupNow")}
            </button>
            {backupMessage && (
              backupMessage.ok
                ? <p role="status" className={hint}>{t("settings.backupDone")}</p>
                : <p role="alert" className={errorText}>{t("errors.backup_failed")}</p>
            )}
            {vm.backups!.backups.length > 0 && (
              <ul aria-label={t("settings.backups")} className={css({ display: "grid", gap: "1", listStyle: "none", fontSize: "sm" })}>
                {vm.backups!.backups.slice(0, 5).map((b) => (
                  <li key={b.name} className={css({ display: "flex", justifyContent: "space-between", gap: "2" })}>
                    <span>{formatDateTime(b.createdAt)}</span>
                    <span className={css({ color: "muted" })}>{formatSize(b.sizeBytes)}</span>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </section>

      <section aria-labelledby="set-about" className={`${card} ${css({ display: "grid", gap: "1" })}`}>
        <h2 id="set-about" className={sectionTitle}>{t("settings.about")}</h2>
        <p className={hint}>FinFamily · {t("settings.version", { version: vm.version })}</p>
      </section>
    </div>
  );
}
