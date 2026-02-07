/**
 * Pure entitlement helpers. No DB or auth deps.
 * Exported for unit tests.
 */

/** Subscription is Pro-eligible only when active or trialing (not past_due/canceled). */
export function isProSubscriptionStatus(status: string | null): boolean {
  if (!status) return false;
  return status === "active" || status === "trialing";
}
