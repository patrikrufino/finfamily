import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { usePersonViewModel } from "./usePersonViewModel";

describe("usePersonViewModel", () => {
  it("defaults to Patrik", () => {
    const { result } = renderHook(() => usePersonViewModel());
    expect(result.current.person).toBe("patrik");
  });

  it("lists both household members", () => {
    const { result } = renderHook(() => usePersonViewModel());
    expect(result.current.people).toEqual(["patrik", "heloisa"]);
  });

  it("remembers the selected person on this device", () => {
    const first = renderHook(() => usePersonViewModel());
    act(() => first.result.current.setPerson("heloisa"));
    const second = renderHook(() => usePersonViewModel());
    expect(second.result.current.person).toBe("heloisa");
  });

  it("ignores unknown values stored on the device", () => {
    localStorage.setItem("finfamily.person", "someone-else");
    const { result } = renderHook(() => usePersonViewModel());
    expect(result.current.person).toBe("patrik");
  });
});
