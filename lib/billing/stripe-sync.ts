import type Stripe from "stripe";
import { db } from "@/lib/db";

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

const prisma = db as unknown as {
  user: {
    findUnique: (args: {
      where: { id?: string; stripeCustomerId?: string };
      select: { id: true };
    }) => Promise<{ id: string } | null>;
    update: (args: { where: { id: string }; data: { stripeCustomerId: string } }) => Promise<unknown>;
  };
  subscription: {
    upsert: (args: {
      where: { stripeSubscriptionId: string };
      create: {
        userId: string;
        plan: string;
        status: string;
        stripeCustomerId: string;
        stripeSubscriptionId: string;
        stripePriceId: string | null;
        stripeProductId: string | null;
        currentPeriodStart: Date | null;
        currentPeriodEnd: Date | null;
        cancelAtPeriodEnd: boolean;
        canceledAt: Date | null;
        endedAt: Date | null;
        trialEnd: Date | null;
      };
      update: {
        plan: string;
        status: string;
        stripeCustomerId: string;
        stripePriceId: string | null;
        stripeProductId: string | null;
        currentPeriodStart: Date | null;
        currentPeriodEnd: Date | null;
        cancelAtPeriodEnd: boolean;
        canceledAt: Date | null;
        endedAt: Date | null;
        trialEnd: Date | null;
      };
    }) => Promise<unknown>;
  };
};

const PRO_PRICE_IDS = [
  process.env.PRO_PRICE_ID_MONTHLY,
  process.env.PRO_PRICE_ID_YEARLY,
  process.env.STRIPE_PRICE_ID_PRO,
].filter(Boolean) as string[];

function resolvePlanFromSubscription(sub: Stripe.Subscription): string {
  const price = sub.items.data[0]?.price;
  const productId = typeof price?.product === "string" ? price.product : null;
  const priceId = price?.id ?? null;

  if (priceId && PRO_PRICE_IDS.includes(priceId)) return "pro";
  if (process.env.STRIPE_PRODUCT_ID_PRO && productId === process.env.STRIPE_PRODUCT_ID_PRO) return "pro";

  return "pro";
}

async function resolveUserId(params: {
  stripeCustomerId: string;
  subscription: Stripe.Subscription;
}): Promise<string | null> {
  const metadataUserId = params.subscription.metadata?.userId;
  if (typeof metadataUserId === "string" && metadataUserId.length > 0) {
    return metadataUserId;
  }

  const user = await prisma.user.findUnique({
    where: { stripeCustomerId: params.stripeCustomerId },
    select: { id: true },
  });

  return user?.id ?? null;
}

export async function syncSubscriptionFromStripe(subscription: Stripe.Subscription): Promise<void> {
  const stripeSubscriptionId = subscription.id;
  const stripeCustomerId =
    typeof subscription.customer === "string" ? subscription.customer : subscription.customer.id;

  const userId = await resolveUserId({ stripeCustomerId, subscription });
  if (!userId) {
    console.warn(
      "[billing] Could not resolve userId for subscription",
      stripeSubscriptionId,
      stripeCustomerId
    );
    return;
  }

  const price = subscription.items.data[0]?.price;
  const stripePriceId = price?.id ?? null;
  const stripeProductId =
    typeof price?.product === "string" ? price.product : price?.product?.id ?? null;

  const plan = resolvePlanFromSubscription(subscription);

  const currentPeriodStartUnix = getNumberField(subscription, ["current_period_start", "currentPeriodStart"]);
  const currentPeriodEndUnix = getNumberField(subscription, ["current_period_end", "currentPeriodEnd"]);
  const canceledAtUnix = getNumberField(subscription, ["canceled_at", "canceledAt"]);
  const endedAtUnix = getNumberField(subscription, ["ended_at", "endedAt"]);
  const trialEndUnix = getNumberField(subscription, ["trial_end", "trialEnd"]);
  const cancelAtPeriodEnd =
    getBooleanField(subscription, ["cancel_at_period_end", "cancelAtPeriodEnd"]) ?? false;

  await prisma.user.update({
    where: { id: userId },
    data: { stripeCustomerId },
  });

  await prisma.subscription.upsert({
    where: { stripeSubscriptionId },
    create: {
      userId,
      plan,
      status: subscription.status,
      stripeCustomerId,
      stripeSubscriptionId,
      stripePriceId,
      stripeProductId,
      currentPeriodStart: unixSecondsToDate(currentPeriodStartUnix),
      currentPeriodEnd: unixSecondsToDate(currentPeriodEndUnix),
      cancelAtPeriodEnd,
      canceledAt: unixSecondsToDate(canceledAtUnix),
      endedAt: unixSecondsToDate(endedAtUnix),
      trialEnd: unixSecondsToDate(trialEndUnix),
    },
    update: {
      plan,
      status: subscription.status,
      stripeCustomerId,
      stripePriceId,
      stripeProductId,
      currentPeriodStart: unixSecondsToDate(currentPeriodStartUnix),
      currentPeriodEnd: unixSecondsToDate(currentPeriodEndUnix),
      cancelAtPeriodEnd,
      canceledAt: unixSecondsToDate(canceledAtUnix),
      endedAt: unixSecondsToDate(endedAtUnix),
      trialEnd: unixSecondsToDate(trialEndUnix),
    },
  });
}
