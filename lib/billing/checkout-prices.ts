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

function getAllowedPriceIds(env: CheckoutEnv): string[] {
  return [
    env.PRO_PRICE_ID_MONTHLY,
    env.PRO_PRICE_ID_YEARLY,
    env.STRIPE_PRICE_ID_PRO,
    env.STRIPE_PRICE_ID_PRO_YEAR,
  ].filter(Boolean) as string[];
}

/**
 * Resolves Pro price ID for monthly or yearly plan.
 * @throws Error when required env vars missing or priceId invalid
 */
export function getProPriceIdForPlan(
  plan: "month" | "year" = "month",
  explicitPriceId: string | undefined,
  env: CheckoutEnv
): string {
  const allowedIds = getAllowedPriceIds(env);

  if (explicitPriceId) {
    if (allowedIds.length > 0 && !allowedIds.includes(explicitPriceId)) {
      throw new Error("Invalid priceId");
    }
    return explicitPriceId;
  }

  const planId =
    plan === "year"
      ? env.STRIPE_PRICE_ID_PRO_YEAR ?? env.PRO_PRICE_ID_YEARLY
      : env.PRO_PRICE_ID_MONTHLY ?? env.STRIPE_PRICE_ID_PRO;

  if (!planId) {
    throw new Error(
      plan === "year"
        ? "Missing STRIPE_PRICE_ID_PRO_YEAR (or PRO_PRICE_ID_YEARLY) for yearly plan"
        : "Missing PRO_PRICE_ID_MONTHLY or STRIPE_PRICE_ID_PRO for monthly plan"
    );
  }
  return planId;
}
