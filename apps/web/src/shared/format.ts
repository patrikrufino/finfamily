/** Long month name plus year (e.g. "Outubro de 2026") for a `YYYY-MM` month, first letter capitalized. */
export function formatMonth(month: string, locale: string): string {
  const text = new Intl.DateTimeFormat(locale, { month: "long", year: "numeric", timeZone: "UTC" }).format(
    new Date(`${month}-01T00:00:00Z`),
  );
  return text.charAt(0).toLocaleUpperCase(locale) + text.slice(1);
}

/** Short day and month for a `YYYY-MM-DD` date (e.g. "05 de nov."). */
export function formatShortDate(date: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, { day: "2-digit", month: "short", timeZone: "UTC" }).format(new Date(`${date}T00:00:00Z`));
}
