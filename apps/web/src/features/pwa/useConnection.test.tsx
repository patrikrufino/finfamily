import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useConnection } from "./useConnection";

const ok = () => Promise.resolve(new Response('{"status":"ok"}', { status: 200 }));

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("useConnection", () => {
  it("is online while the server answers the health check", async () => {
    const fetchMock = vi.fn(ok);
    vi.stubGlobal("fetch", fetchMock);
    const { result } = renderHook(() => useConnection({ intervalMs: 1000 }));
    await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
    expect(result.current.online).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith("/api/health", expect.objectContaining({ cache: "no-store" }));
  });

  it("goes offline when the server cannot be reached and recovers by itself", async () => {
    const fetchMock = vi.fn(ok);
    vi.stubGlobal("fetch", fetchMock);
    const { result } = renderHook(() => useConnection({ intervalMs: 1000 }));
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));
    await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
    expect(result.current.online).toBe(false);
    fetchMock.mockImplementation(ok);
    await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
    expect(result.current.online).toBe(true);
  });

  it("treats an error response from the server as offline", async () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve(new Response("bad gateway", { status: 502 }))));
    const { result } = renderHook(() => useConnection({ intervalMs: 1000 }));
    await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
    expect(result.current.online).toBe(false);
  });

  it("reacts right away to the browser going offline, then re-checks when it is back", async () => {
    const fetchMock = vi.fn(ok);
    vi.stubGlobal("fetch", fetchMock);
    const { result } = renderHook(() => useConnection({ intervalMs: 60_000 }));
    act(() => { window.dispatchEvent(new Event("offline")); });
    expect(result.current.online).toBe(false);
    await act(async () => { window.dispatchEvent(new Event("online")); await vi.advanceTimersByTimeAsync(0); });
    expect(result.current.online).toBe(true);
  });

  it("retries on demand", async () => {
    const fetchMock = vi.fn(() => Promise.reject(new TypeError("down")));
    vi.stubGlobal("fetch", fetchMock);
    const { result } = renderHook(() => useConnection({ intervalMs: 60_000 }));
    await act(async () => { await result.current.retry(); });
    expect(result.current.online).toBe(false);
    fetchMock.mockImplementation(ok as never);
    await act(async () => { await result.current.retry(); });
    expect(result.current.online).toBe(true);
  });

  it("starts offline when the browser already is, and recovers when it comes back", async () => {
    const online = vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
    vi.stubGlobal("fetch", vi.fn(ok));
    const { result } = renderHook(() => useConnection({ intervalMs: 60_000 }));
    expect(result.current.online).toBe(false);
    online.mockReturnValue(true);
    await act(async () => { window.dispatchEvent(new Event("online")); await vi.advanceTimersByTimeAsync(0); });
    expect(result.current.online).toBe(true);
    online.mockRestore();
  });

  it("stops polling when unmounted", async () => {
    const fetchMock = vi.fn(ok);
    vi.stubGlobal("fetch", fetchMock);
    const { unmount } = renderHook(() => useConnection({ intervalMs: 1000 }));
    unmount();
    await vi.advanceTimersByTimeAsync(5000);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
