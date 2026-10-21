import { useCallback, useEffect, useState } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

/**
 * - `installed`: already running as an installed app (or just installed)
 * - `available`: the browser can show its install prompt (Chrome/Android/desktop)
 * - `ios`: Safari on iPhone/iPad has no prompt; the user adds it from the Share menu
 * - `insecure`: the page was opened over plain HTTP; browsers only allow installing from HTTPS or localhost
 * - `unavailable`: nothing to offer (unsupported browser, or the install prompt was already used)
 */
export type InstallState = "installed" | "available" | "ios" | "insecure" | "unavailable";

const isStandalone = () =>
  (typeof matchMedia === "function" && matchMedia("(display-mode: standalone)").matches) ||
  (navigator as Navigator & { standalone?: boolean }).standalone === true;

const isSecure = () => typeof window === "undefined" || window.isSecureContext !== false;

const isIos = () => /iphone|ipad|ipod/i.test(navigator.userAgent);

export function useInstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(isStandalone);

  useEffect(() => {
    const onPrompt = (event: Event) => {
      event.preventDefault(); // keep the event so installation can be offered from Settings
      setDeferred(event as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setDeferred(null);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const install = useCallback(async () => {
    if (!deferred) return undefined;
    await deferred.prompt();
    const { outcome } = await deferred.userChoice;
    setDeferred(null); // a prompt event can only be used once
    return outcome;
  }, [deferred]);

  // iOS can add a web clip even over HTTP, so its manual steps come first; elsewhere HTTP is the reason nothing can be offered.
  const state: InstallState = installed
    ? "installed"
    : deferred
      ? "available"
      : isIos()
        ? "ios"
        : !isSecure()
          ? "insecure"
          : "unavailable";
  return { state, install };
}
