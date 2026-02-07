import * as Sentry from "@sentry/nextjs";

/**
 * Set Sentry user context when a request has an authenticated user.
 * Only id and email are set; no other PII.
 */
export function setSentryUser(user: { id: string; email?: string | null }) {
  Sentry.setUser({
    id: user.id,
    email: user.email ?? undefined,
  });
}

/**
 * Clear Sentry user context (e.g. on logout).
 */
export function clearSentryUser() {
  Sentry.setUser(null);
}
