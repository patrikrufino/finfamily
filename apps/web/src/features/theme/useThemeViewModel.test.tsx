import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useThemeViewModel } from "./useThemeViewModel";

describe("useThemeViewModel", () => {
  it("follows the system theme by default", () => {
    renderHook(() => useThemeViewModel());
    expect(document.documentElement).not.toHaveAttribute("data-theme");
  });

  it("applies and persists the dark theme", () => {
    const { result } = renderHook(() => useThemeViewModel());
    act(() => result.current.setDark(true));
    expect(result.current.isDark).toBe(true);
    expect(document.documentElement).toHaveAttribute("data-theme", "dark");
    expect(localStorage.getItem("finfamily.theme")).toBe("dark");
  });

  it("restores the persisted theme", () => {
    localStorage.setItem("finfamily.theme", "dark");
    const { result } = renderHook(() => useThemeViewModel());
    expect(result.current.isDark).toBe(true);
  });

  it("switches back to light", () => {
    const { result } = renderHook(() => useThemeViewModel());
    act(() => result.current.setDark(true));
    act(() => result.current.setDark(false));
    expect(document.documentElement).toHaveAttribute("data-theme", "light");
  });
});
