/**
 * Locale-aware formatting utilities.
 * Use with current locale from useLocale() or from document.documentElement.lang
 */

export function formatDate(
  date: Date | string | number,
  locale: string,
  options?: Intl.DateTimeFormatOptions
): string {
  const d = typeof date === "object" && date instanceof Date ? date : new Date(date);
  return d.toLocaleDateString(locale, options ?? { dateStyle: "medium" });
}

export function formatDateTime(
  date: Date | string | number,
  locale: string,
  options?: Intl.DateTimeFormatOptions
): string {
  const d = typeof date === "object" && date instanceof Date ? date : new Date(date);
  return d.toLocaleString(locale, options ?? { dateStyle: "short", timeStyle: "short" });
}

export function formatNumber(
  value: number,
  locale: string,
  options?: Intl.NumberFormatOptions
): string {
  return new Intl.NumberFormat(locale, options).format(value);
}
