/**
 * Cookie consent storage. GDPR-friendly: store choice in cookie and localStorage.
 * Key: cookie_consent. Value: "all" | "essential" | (future: JSON for granular prefs).
 */

const STORAGE_KEY = "cookie_consent";
const COOKIE_NAME = "cookie_consent";
const COOKIE_MAX_AGE_DAYS = 365;

export type ConsentLevel = "all" | "essential" | "pending";

export function getStoredConsent(): ConsentLevel {
  if (typeof window === "undefined") return "pending";
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === "all" || v === "essential") return v;
    const cookie = document.cookie
      .split("; ")
      .find((row) => row.startsWith(`${COOKIE_NAME}=`));
    const val = cookie?.split("=")[1];
    if (val === "all" || val === "essential") return val;
  } catch {
    // ignore
  }
  return "pending";
}

export function setStoredConsent(level: "all" | "essential"): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, level);
    document.cookie = `${COOKIE_NAME}=${level}; path=/; max-age=${COOKIE_MAX_AGE_DAYS * 24 * 60 * 60}; SameSite=Lax`;
  } catch {
    // ignore
  }
}

/** Whether analytics/tracking may be loaded (only when consent is "all"). */
export function mayLoadAnalytics(): boolean {
  return getStoredConsent() === "all";
}
