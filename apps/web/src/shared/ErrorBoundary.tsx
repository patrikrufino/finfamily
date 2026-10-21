import { Component, type ErrorInfo, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { css } from "../../styled-system/css";
import { primaryButton, secondaryButton } from "./ui";

function CrashScreen({ onHome }: { onHome: () => void }) {
  const { t } = useTranslation();
  return (
    <div role="alert" className={css({ display: "grid", gap: "3", padding: "4", maxWidth: "md", marginInline: "auto" })}>
      <h1 className={css({ fontSize: "xl", fontWeight: "bold" })}>{t("crash.title")}</h1>
      <p className={css({ color: "muted" })}>{t("crash.message")}</p>
      <button type="button" className={primaryButton} onClick={() => window.location.reload()}>{t("crash.reload")}</button>
      <button type="button" className={secondaryButton} onClick={onHome}>{t("crash.home")}</button>
    </div>
  );
}

interface State {
  failed: boolean;
}

/** Shows a friendly screen instead of a blank page when a render error escapes. */
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Unexpected error:", error, info.componentStack);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return <CrashScreen onHome={() => { window.location.assign("/"); }} />;
  }
}
