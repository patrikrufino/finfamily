import { useEffect, useState } from "react";

export type ServiceWorkerState = "unsupported" | "inactive" | "active";

/**
 * What the browser lets this page do as a PWA. Installing and working offline need a secure context
 * (HTTPS or localhost) and a registered service worker.
 */
export function usePwaStatus() {
  const supported = typeof navigator !== "undefined" && "serviceWorker" in navigator;
  const [serviceWorker, setServiceWorker] = useState<ServiceWorkerState>(supported ? "inactive" : "unsupported");

  useEffect(() => {
    if (!supported) return;
    let cancelled = false;
    navigator.serviceWorker
      .getRegistration()
      .then((registration) => {
        if (!cancelled) setServiceWorker(registration?.active ? "active" : "inactive");
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [supported]);

  return {
    secure: typeof window !== "undefined" && window.isSecureContext,
    serviceWorker,
    standalone: typeof matchMedia === "function" && matchMedia("(display-mode: standalone)").matches,
    origin: typeof window !== "undefined" ? window.location.origin : "",
  };
}
