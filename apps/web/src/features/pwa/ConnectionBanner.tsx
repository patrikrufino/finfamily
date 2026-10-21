import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { css } from "../../../styled-system/css";
import { secondaryButton } from "../../shared/ui";
import { useConnection } from "./useConnection";

/** Explains that the server at home cannot be reached; hides itself and refreshes the data when it is back. */
export function ConnectionBanner() {
  const { t } = useTranslation();
  const { online, retry } = useConnection();
  const queryClient = useQueryClient();
  const wasOffline = useRef(false);

  useEffect(() => {
    if (!online) wasOffline.current = true;
    else if (wasOffline.current) {
      wasOffline.current = false;
      void queryClient.invalidateQueries();
    }
  }, [online, queryClient]);

  if (online) return null;
  return (
    <div
      role="status"
      className={css({
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "3",
        marginInline: "4",
        padding: "3",
        borderRadius: "md",
        background: "red.500/15",
        border: "1px solid",
        borderColor: "red.500",
        fontSize: "sm",
      })}
    >
      <span className={css({ flex: "1 1 14rem" })}>{t("offline.banner")}</span>
      <button type="button" className={`${secondaryButton} ${css({ whiteSpace: "nowrap", flexShrink: 0 })}`} onClick={() => void retry()}>{t("offline.retry")}</button>
    </div>
  );
}
