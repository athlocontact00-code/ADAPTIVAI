/**
 * Pure checkout price resolution. Extracted for unit tests.
 * Used by /api/billing/checkout.
 */

export type CheckoutEnv = {
  PRO_PRICE_ID_MONTHLY?: string;
  PRO_PRICE_ID_YEARLY?: string;
  STRIPE_PRICE_ID_PRO?: string;
  STRIPE_PRICE_ID_PRO_YEAR?: string;
};

export type BillingPlan = "month" | "year";

/**
 * Normalize plan input: trim, lowercase, map only allowed values to month/year.
 * Allowed: "month", "monthly" -> month; "year", "yearly" -> year. Invalid/empty -> "month".
 */
export function normalizePlan(input: string | undefined): BillingPlan {
  const s = (input ?? "").trim().toLowerCase();
  if (s === "yearly" || s === "year") return "year";
  return "month";
}

function toPriceId(s: string | undefined): string | undefined {
  const t = typeof s === "string" ? s.trim() : undefined;
  return t && t.startsWith("price_") ? t : undefined;
}

function getAllowedPriceIds(env: CheckoutEnv): string[] {
  return [
    toPriceId(env.PRO_PRICE_ID_MONTHLY),
    toPriceId(env.PRO_PRICE_ID_YEARLY),
    toPriceId(env.STRIPE_PRICE_ID_PRO),
    toPriceId(env.STRIPE_PRICE_ID_PRO_YEAR),
  ].filter(Boolean) as string[];
}

/**
 * Resolves Pro price ID for monthly or yearly plan. Deterministic: only env keys (no dynamic key access).
 * @throws Error when required env vars missing or priceId invalid
 */
export function getProPriceIdForPlan(
  plan: BillingPlan = "month",
  explicitPriceId: string | undefined,
  env: CheckoutEnv
): string {
  const allowedIds = getAllowedPriceIds(env);

  if (explicitPriceId) {
    if (!explicitPriceId.startsWith("price_")) {
      throw new Error(
        "Stripe Price ID must start with price_ (use a Price ID from Stripe Dashboard, not a Product ID prod_xxx)."
      );
    }
    if (allowedIds.length > 0 && !allowedIds.includes(explicitPriceId)) {
      throw new Error("Invalid priceId");
    }
    return explicitPriceId;
  }

  // Same precedence for both: Stripe vars first, then PRO_* (so STRIPE_PRICE_ID_PRO / STRIPE_PRICE_ID_PRO_YEAR are the main ones)
  const monthlyId = toPriceId(env.STRIPE_PRICE_ID_PRO) ?? toPriceId(env.PRO_PRICE_ID_MONTHLY);
  const yearlyId = toPriceId(env.STRIPE_PRICE_ID_PRO_YEAR) ?? toPriceId(env.PRO_PRICE_ID_YEARLY);

  const planId = plan === "year" ? yearlyId : monthlyId;

  if (!planId) {
    throw new Error(
      plan === "year"
        ? "Missing STRIPE_PRICE_ID_PRO_YEAR (or PRO_PRICE_ID_YEARLY) for yearly plan"
        : "Missing STRIPE_PRICE_ID_PRO or PRO_PRICE_ID_MONTHLY for monthly plan"
    );
  }

  // Avoid using the same price for both plans (common misconfiguration)
  if (plan === "month" && yearlyId && planId === yearlyId) {
    throw new Error(
      "Monthly plan is using the yearly price ID. Set STRIPE_PRICE_ID_PRO or PRO_PRICE_ID_MONTHLY to a monthly Stripe Price (price_xxx)."
    );
  }

  return planId;
}
