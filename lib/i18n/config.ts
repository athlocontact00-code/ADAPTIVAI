/**
 * i18n configuration — supported locales and defaults
 */

export const SUPPORTED_LOCALES = [
  "en",
  "pl",
  "de",
  "es",
  "fr",
  "ru",
  "zh-CN",
  "ja",
] as const;

export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

export const DEFAULT_LOCALE: SupportedLocale = "en";

export const LOCALE_LABELS: Record<SupportedLocale, string> = {
  en: "English",
  pl: "Polski",
  de: "Deutsch",
  es: "Español",
  fr: "Français",
  ru: "Русский",
  "zh-CN": "中文",
  ja: "日本語",
};

export function isValidLocale(s: string): s is SupportedLocale {
  return SUPPORTED_LOCALES.includes(s as SupportedLocale);
}

export function normalizeLocale(s: string | null | undefined): SupportedLocale {
  if (!s) return DEFAULT_LOCALE;
  if (isValidLocale(s)) return s;
  const lower = s.toLowerCase();
  if (lower.startsWith("zh")) return "zh-CN";
  return DEFAULT_LOCALE;
}
