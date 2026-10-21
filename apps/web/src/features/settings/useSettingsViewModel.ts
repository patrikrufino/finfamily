import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useRepository } from "../../data/RepositoryContext";
import { SUPPORTED_LOCALES, setLocale, type Locale } from "../../i18n";
import type { CommandResult } from "../accounts/useAccountsViewModel";
import { useInstallPrompt } from "../pwa/useInstallPrompt";
import { usePwaStatus } from "../pwa/usePwaStatus";

export function useSettingsViewModel() {
  const repository = useRepository();
  const queryClient = useQueryClient();
  const { i18n } = useTranslation();
  const install = useInstallPrompt();
  const pwa = usePwaStatus();

  const status = useQuery({ queryKey: ["backups"], queryFn: () => repository.getBackupStatus() });
  const create = useMutation({
    mutationFn: () => repository.createBackup(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["backups"] }),
  });

  return {
    locale: i18n.language as Locale,
    locales: SUPPORTED_LOCALES,
    changeLocale: setLocale,

    /** Backup list, newest first; undefined while loading, null data means the server has backups turned off. */
    backups: status.data ?? undefined,
    backupsLoaded: status.isSuccess,
    backupsEnabled: status.data != null,
    async createBackup(): Promise<CommandResult> {
      try {
        await create.mutateAsync();
        return { ok: true };
      } catch {
        return { ok: false, error: "backup_failed" };
      }
    },
    isBackingUp: create.isPending,

    installState: install.state,
    pwa,
    install: install.install,
    version: __APP_VERSION__,
  };
}
