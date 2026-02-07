import type Stripe from "stripe";

/**
 * Pure mapping from Stripe subscription to upsert data shape.
 * Extracted for unit testing; used by stripe-sync.
 */
function unixSecondsToDate(value: number | null | undefined): Date | null {
  if (!value) return null;
  return new Date(value * 1000);
}

function getNumberField(obj: unknown, keys: string[]): number | null {
  if (!obj || typeof obj !== "object") return null;
  const rec = obj as Record<string, unknown>;
  for (const k of keys) {
    const v = rec[k];
    if (typeof v === "number") return v;
  }
  return null;
}

function getBooleanField(obj: unknown, keys: string[]): boolean | null {
  if (!obj || typeof obj !== "object") return null;
  const rec = obj as Record<string, unknown>;
  for (const k of keys) {
    const v = rec[k];
    if (typeof v === "boolean") return v;
  }
  return null;
}

export type SubscriptionUpsertData = {
  plan: string;
  status: string;
  stripePriceId: string | null;
  stripeProductId: string | null;
  currentPeriodStart: Date | null;
  currentPeriodEnd: Date | null;
  cancelAtPeriodEnd: boolean;
  canceledAt: Date | null;
  endedAt: Date | null;
  trialEnd: Date | null;
};

const PRO_PRICE_IDS: string[] = [];

function resolvePlanFromSubscription(
  sub: Stripe.Subscription,
  proPriceIds: string[],
  productIdPro?: string
): string {
  const price = sub.items.data[0]?.price;
  const productId = typeof price?.product === "string" ? price.product : price?.product?.id ?? null;
  const priceId = price?.id ?? null;

  if (priceId && proPriceIds.includes(priceId)) return "pro";
  if (productIdPro && productId === productIdPro) return "pro";
  return "pro";
}

/**
 * Maps a Stripe subscription to the upsert data shape.
 * Pure function; no DB or env access (proPriceIds passed in for testability).
 */
export function mapSubscriptionToUpsertData(
  subscription: Stripe.Subscription,
  proPriceIds: string[] = PRO_PRICE_IDS,
  productIdPro?: string
): SubscriptionUpsertData {
  const price = subscription.items.data[0]?.price;
  const stripePriceId = price?.id ?? null;
  const stripeProductId =
    typeof price?.product === "string" ? price.product : price?.product?.id ?? null;

  const plan = resolvePlanFromSubscription(subscription, proPriceIds, productIdPro);
  const currentPeriodStartUnix = getNumberField(subscription, [
    "current_period_start",
    "currentPeriodStart",
  ]);
  const currentPeriodEndUnix = getNumberField(subscription, [
    "current_period_end",
    "currentPeriodEnd",
  ]);
  const canceledAtUnix = getNumberField(subscription, [
    "canceled_at",
    "canceledAt",
  ]);
  const endedAtUnix = getNumberField(subscription, ["ended_at", "endedAt"]);
  const trialEndUnix = getNumberField(subscription, ["trial_end", "trialEnd"]);
  const cancelAtPeriodEnd =
    getBooleanField(subscription, [
      "cancel_at_period_end",
      "cancelAtPeriodEnd",
    ]) ?? false;

  return {
    plan,
    status: subscription.status,
    stripePriceId,
    stripeProductId,
    currentPeriodStart: unixSecondsToDate(currentPeriodStartUnix),
    currentPeriodEnd: unixSecondsToDate(currentPeriodEndUnix),
    cancelAtPeriodEnd,
    canceledAt: unixSecondsToDate(canceledAtUnix),
    endedAt: unixSecondsToDate(endedAtUnix),
    trialEnd: unixSecondsToDate(trialEndUnix),
  };
}
