import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useInstallPrompt } from "./useInstallPrompt";

const promptEvent = (outcome: "accepted" | "dismissed" = "accepted") => {
  const event = new Event("beforeinstallprompt", { cancelable: true }) as Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };
  event.prompt = vi.fn(async () => undefined);
  event.userChoice = Promise.resolve({ outcome });
  return event;
};

afterEach(() => vi.unstubAllGlobals());

describe("useInstallPrompt", () => {
  it("is unavailable by default", () => {
    const { result } = renderHook(() => useInstallPrompt());
    expect(result.current.state).toBe("unavailable");
  });

  it("becomes available when the browser offers installation, and holds back the mini-infobar", () => {
    const { result } = renderHook(() => useInstallPrompt());
    const event = promptEvent();
    act(() => { window.dispatchEvent(event); });
    expect(result.current.state).toBe("available");
    expect(event.defaultPrevented).toBe(true);
  });

  it("shows the browser prompt on install and then hides the option", async () => {
    const { result } = renderHook(() => useInstallPrompt());
    const event = promptEvent("accepted");
    act(() => { window.dispatchEvent(event); });
    let outcome: string | undefined;
    await act(async () => { outcome = await result.current.install(); });
    expect(event.prompt).toHaveBeenCalledOnce();
    expect(outcome).toBe("accepted");
    expect(result.current.state).toBe("unavailable");
  });

  it("does nothing when installation is not available", async () => {
    const { result } = renderHook(() => useInstallPrompt());
    let outcome: string | undefined = "x";
    await act(async () => { outcome = await result.current.install(); });
    expect(outcome).toBeUndefined();
  });

  it("is installed once the app was installed", () => {
    const { result } = renderHook(() => useInstallPrompt());
    act(() => { window.dispatchEvent(promptEvent()); });
    act(() => { window.dispatchEvent(new Event("appinstalled")); });
    expect(result.current.state).toBe("installed");
  });

  it("is installed when running as a standalone app", () => {
    vi.stubGlobal("matchMedia", (query: string) => ({ matches: query.includes("standalone"), addEventListener() {}, removeEventListener() {} }));
    const { result } = renderHook(() => useInstallPrompt());
    expect(result.current.state).toBe("installed");
  });

  it("explains the manual steps on iOS, where there is no install prompt", () => {
    vi.stubGlobal("navigator", { ...navigator, userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Safari" });
    const { result } = renderHook(() => useInstallPrompt());
    expect(result.current.state).toBe("ios");
  });
});
