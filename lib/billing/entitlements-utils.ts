/**
 * Pure entitlement helpers. No DB or auth deps.
 * Exported for unit tests.
 */

/** Subscription is Pro-eligible when active, trialing, or past_due (grace). Cancel-at-period-end still has status "active" until period ends. */
export function isProSubscriptionStatus(status: string | null): boolean {
  if (!status) return false;
  return status === "active" || status === "trialing" || status === "past_due";
}
