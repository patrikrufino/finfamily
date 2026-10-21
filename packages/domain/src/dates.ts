/** Date helpers over ISO strings: months are `YYYY-MM`, dates are `YYYY-MM-DD`. All UTC, no time zones. */

export function monthOf(date: string): string {
  return date.slice(0, 7);
}

export function daysInMonth(month: string): number {
  const [year, m] = month.split("-").map(Number) as [number, number];
  return new Date(Date.UTC(year, m, 0)).getUTCDate();
}

export function addMonths(month: string, delta: number): string {
  const [year, m] = month.split("-").map(Number) as [number, number];
  const index = year * 12 + (m - 1) + delta;
  return `${String(Math.floor(index / 12)).padStart(4, "0")}-${String((index % 12) + 1).padStart(2, "0")}`;
}

export function addDays(date: string, delta: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}

/** Clamps a day-of-month to the month's last day (31 -> 28 in February). */
export function clampDay(month: string, day: number): number {
  return Math.min(day, daysInMonth(month));
}

export function isoDate(month: string, day: number): string {
  return `${month}-${String(clampDay(month, day)).padStart(2, "0")}`;
}

/** Same day of the month `delta` months later, clamped to that month's last day (31 Jan + 1 -> 28 Feb). */
export function addMonthsToDate(date: string, delta: number): string {
  return isoDate(addMonths(monthOf(date), delta), Number(date.slice(8, 10)));
}
