/** Long month name plus year (e.g. "Outubro de 2026") for a `YYYY-MM` month, first letter capitalized. */
export function formatMonth(month: string, locale: string): string {
  const text = new Intl.DateTimeFormat(locale, { month: "long", year: "numeric", timeZone: "UTC" }).format(
    new Date(`${month}-01T00:00:00Z`),
  );
  return text.charAt(0).toLocaleUpperCase(locale) + text.slice(1);
}
