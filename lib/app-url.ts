/**
 * Canonical base URL for the app. Use for Stripe redirects, Auth, and any server-side links.
 * Prefer APP_URL, then NEXTAUTH_URL, then localhost in dev. No hardcoded preview URLs.
 */
export function getAppUrl(): string {
  const url =
    process.env.APP_URL ||
    process.env.NEXTAUTH_URL ||
    "http://localhost:3000";
  return url.replace(/\/$/, "");
}

/** Settings > Billing tab path (query-based). Use for all billing redirects. */
export const BILLING_SETTINGS_PATH = "/settings?tab=billing";
