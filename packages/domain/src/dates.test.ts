import { describe, expect, it } from "vitest";
import { addDays, addMonths, addMonthsToDate, clampDay, daysInMonth, isoDate, monthOf } from "./dates";

describe("dates", () => {
  it("knows the length of months, including leap years", () => {
    expect(daysInMonth("2026-02")).toBe(28);
    expect(daysInMonth("2028-02")).toBe(29);
    expect(daysInMonth("2026-10")).toBe(31);
  });

  it("adds months across years", () => {
    expect(addMonths("2026-12", 1)).toBe("2027-01");
    expect(addMonths("2026-01", -1)).toBe("2025-12");
    expect(addMonths("2026-10", 14)).toBe("2027-12");
  });

  it("adds days across months", () => {
    expect(addDays("2026-02-28", 1)).toBe("2026-03-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  });

  it("clamps a day to the month length and builds ISO dates", () => {
    expect(clampDay("2026-02", 31)).toBe(28);
    expect(clampDay("2026-10", 31)).toBe(31);
    expect(isoDate("2026-02", 31)).toBe("2026-02-28");
    expect(isoDate("2026-10", 5)).toBe("2026-10-05");
  });

  it("extracts the month of a date", () => {
    expect(monthOf("2026-10-25")).toBe("2026-10");
  });

  it("adds months to a date keeping the day, clamped to the month length", () => {
    expect(addMonthsToDate("2026-01-31", 1)).toBe("2026-02-28");
    expect(addMonthsToDate("2026-01-31", 2)).toBe("2026-03-31");
    expect(addMonthsToDate("2026-01-31", 3)).toBe("2026-04-30");
    expect(addMonthsToDate("2026-11-15", 2)).toBe("2027-01-15");
  });
});
