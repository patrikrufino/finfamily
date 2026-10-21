import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { usePwaStatus } from "./usePwaStatus";

afterEach(() => vi.unstubAllGlobals());

describe("usePwaStatus", () => {
  it("reports a secure context, the service worker and the display mode", async () => {
    vi.stubGlobal("isSecureContext", true);
    const registration = { active: {} };
    vi.stubGlobal("navigator", { ...navigator, serviceWorker: { getRegistration: vi.fn(async () => registration) } });
    vi.stubGlobal("matchMedia", (q: string) => ({ matches: q.includes("standalone"), addEventListener() {}, removeEventListener() {} }));
    const { result } = renderHook(() => usePwaStatus());
    await waitFor(() => expect(result.current.serviceWorker).toBe("active"));
    expect(result.current).toMatchObject({ secure: true, standalone: true });
  });

  it("flags an insecure context, where service workers do not exist", async () => {
    vi.stubGlobal("isSecureContext", false);
    const nav = { ...navigator } as Record<string, unknown>;
    delete nav.serviceWorker;
    vi.stubGlobal("navigator", nav);
    const { result } = renderHook(() => usePwaStatus());
    expect(result.current).toMatchObject({ secure: false, serviceWorker: "unsupported", standalone: false });
  });

  it("tells when the service worker is supported but not registered yet", async () => {
    vi.stubGlobal("isSecureContext", true);
    vi.stubGlobal("navigator", { ...navigator, serviceWorker: { getRegistration: vi.fn(async () => undefined) } });
    const { result } = renderHook(() => usePwaStatus());
    await waitFor(() => expect(result.current.serviceWorker).toBe("inactive"));
  });
});
