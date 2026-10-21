import { useCallback, useEffect, useRef, useState } from "react";

interface Options {
  /** Time between health checks. */
  intervalMs?: number;
}

/** Whether the FinFamily server can be reached. The app shell works offline, but data needs the server at home. */
export function useConnection({ intervalMs = 20_000 }: Options = {}) {
  // If the page is opened while the device is already offline, no "offline" event will ever fire, so start from the browser's own flag.
  const [online, setOnline] = useState(() => typeof navigator === "undefined" || navigator.onLine !== false);
  const mounted = useRef(true);

  const check = useCallback(async () => {
    let reachable = false;
    try {
      const res = await fetch("/api/health", { cache: "no-store" });
      reachable = res.ok;
    } catch {
      reachable = false;
    }
    if (mounted.current) setOnline(reachable);
    return reachable;
  }, []);

  useEffect(() => {
    mounted.current = true;
    const timer = setInterval(() => void check(), intervalMs);
    const goOffline = () => setOnline(false);
    const comeBack = () => void check();
    window.addEventListener("offline", goOffline);
    window.addEventListener("online", comeBack);
    return () => {
      mounted.current = false;
      clearInterval(timer);
      window.removeEventListener("offline", goOffline);
      window.removeEventListener("online", comeBack);
    };
  }, [check, intervalMs]);

  return { online, retry: check };
}
