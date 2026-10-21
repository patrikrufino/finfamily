import { describe, expect, it } from "vitest";
import { Money } from "./money";
import {
  dueOccurrences,
  firstIndexOnOrAfter,
  occurrenceDate,
  occurrencesBetween,
  validateRecurring,
  type RecurringRule,
} from "./recurring";

const rule = (over: Partial<RecurringRule> = {}): RecurringRule => ({
  id: 1, kind: "expense", amount: Money.fromCents(120000), description: "Rent", accountId: 1, cardId: null, categoryId: null,
  personId: 1, frequency: "monthly", startDate: "2026-01-31", endDate: null, nextIndex: 0, active: true, ...over,
});

describe("occurrenceDate", () => {
  it("keeps the day of the month for monthly rules, clamping short months", () => {
    const dates = [0, 1, 2, 3].map((i) => occurrenceDate("2026-01-31", "monthly", i));
    expect(dates).toEqual(["2026-01-31", "2026-02-28", "2026-03-31", "2026-04-30"]);
  });

  it("steps weekly rules by 7 days", () => {
    expect([0, 1, 2].map((i) => occurrenceDate("2026-10-28", "weekly", i))).toEqual(["2026-10-28", "2026-11-04", "2026-11-11"]);
  });

  it("steps yearly rules by 12 months, handling leap days", () => {
    expect([0, 1, 2, 3, 4].map((i) => occurrenceDate("2024-02-29", "yearly", i)))
      .toEqual(["2024-02-29", "2025-02-28", "2026-02-28", "2027-02-28", "2028-02-29"]);
  });
});

describe("firstIndexOnOrAfter", () => {
  it("is zero when the start is today or later", () => {
    expect(firstIndexOnOrAfter("2026-11-15", "monthly", "2026-10-20")).toBe(0);
    expect(firstIndexOnOrAfter("2026-10-20", "monthly", "2026-10-20")).toBe(0);
  });

  it("skips past occurrences without backfilling", () => {
    expect(firstIndexOnOrAfter("2026-01-15", "monthly", "2026-10-20")).toBe(10); // 2026-11-15
    expect(occurrenceDate("2026-01-15", "monthly", 10)).toBe("2026-11-15");
    expect(firstIndexOnOrAfter("2026-01-15", "monthly", "2026-10-15")).toBe(9); // today counts
  });

  it("works for weekly and yearly rules", () => {
    expect(occurrenceDate("2026-01-05", "weekly", firstIndexOnOrAfter("2026-01-05", "weekly", "2026-10-20"))).toBe("2026-10-26");
    expect(occurrenceDate("2020-03-10", "yearly", firstIndexOnOrAfter("2020-03-10", "yearly", "2026-10-20"))).toBe("2027-03-10");
  });
});

describe("dueOccurrences", () => {
  it("lists the occurrences from nextIndex up to today", () => {
    const r = rule({ startDate: "2026-08-10", nextIndex: 0 });
    expect(dueOccurrences(r, "2026-10-20")).toEqual([
      { index: 0, date: "2026-08-10" }, { index: 1, date: "2026-09-10" }, { index: 2, date: "2026-10-10" },
    ]);
  });

  it("is empty when nothing is due yet, when paused, or after the end date", () => {
    expect(dueOccurrences(rule({ startDate: "2026-11-10" }), "2026-10-20")).toEqual([]);
    expect(dueOccurrences(rule({ startDate: "2026-08-10", active: false }), "2026-10-20")).toEqual([]);
    expect(dueOccurrences(rule({ startDate: "2026-08-10", endDate: "2026-09-30" }), "2026-10-20").map((o) => o.index)).toEqual([0, 1]);
  });

  it("does not repeat what was already posted", () => {
    expect(dueOccurrences(rule({ startDate: "2026-08-10", nextIndex: 3 }), "2026-10-20")).toEqual([]);
  });
});

describe("occurrencesBetween", () => {
  it("lists the future occurrences of the window starting from nextIndex", () => {
    const r = rule({ startDate: "2026-01-05", nextIndex: 10 }); // next: 2026-11-05
    expect(occurrencesBetween(r, "2026-10-21", "2027-01-31")).toEqual(["2026-11-05", "2026-12-05", "2027-01-05"]);
  });

  it("respects the end date and the active flag", () => {
    const r = rule({ startDate: "2026-01-05", nextIndex: 10, endDate: "2026-12-10" });
    expect(occurrencesBetween(r, "2026-10-21", "2027-12-31")).toEqual(["2026-11-05", "2026-12-05"]);
    expect(occurrencesBetween({ ...r, active: false }, "2026-10-21", "2027-12-31")).toEqual([]);
  });
});

describe("validateRecurring", () => {
  const valid = {
    kind: "expense" as const, amount: Money.fromCents(1000), frequency: "monthly" as const, startDate: "2026-10-10",
    endDate: null, accountId: 1, cardId: null,
  };

  it("accepts a valid rule on an account or a card", () => {
    expect(validateRecurring(valid)).toEqual([]);
    expect(validateRecurring({ ...valid, accountId: null, cardId: 2 })).toEqual([]);
  });

  it("rejects bad amount, dates and end before start", () => {
    expect(validateRecurring({ ...valid, amount: Money.zero() })).toContain("amount_must_be_positive");
    expect(validateRecurring({ ...valid, startDate: "2026-02-30" })).toContain("invalid_date");
    expect(validateRecurring({ ...valid, endDate: "nope" })).toContain("invalid_date");
    expect(validateRecurring({ ...valid, endDate: "2026-10-09" })).toContain("end_before_start");
  });

  it("needs exactly one source, and income only on accounts", () => {
    expect(validateRecurring({ ...valid, accountId: null })).toContain("recurring_source_required");
    expect(validateRecurring({ ...valid, cardId: 2 })).toContain("recurring_single_source");
    expect(validateRecurring({ ...valid, kind: "income", accountId: null, cardId: 2 })).toContain("recurring_income_needs_account");
  });
});
