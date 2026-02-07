import type Stripe from "stripe";
import { db } from "@/lib/db";
import { mapSubscriptionToUpsertData } from "./subscription-mapper";

const PRO_PRICE_IDS = [
  process.env.PRO_PRICE_ID_MONTHLY,
  process.env.PRO_PRICE_ID_YEARLY,
  process.env.STRIPE_PRICE_ID_PRO,
  process.env.STRIPE_PRICE_ID_PRO_YEAR,
].filter(Boolean) as string[];

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

export async function syncSubscriptionFromStripe(subscription: Stripe.Subscription): Promise<string | null> {
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
    return null;
  }

  const mapped = mapSubscriptionToUpsertData(
    subscription,
    PRO_PRICE_IDS,
    process.env.STRIPE_PRODUCT_ID_PRO ?? undefined
  );

  await prisma.user.update({
    where: { id: userId },
    data: { stripeCustomerId },
  });

  await prisma.subscription.upsert({
    where: { stripeSubscriptionId },
    create: {
      userId,
      plan: mapped.plan,
      status: mapped.status,
      stripeCustomerId,
      stripeSubscriptionId,
      stripePriceId: mapped.stripePriceId,
      stripeProductId: mapped.stripeProductId,
      currentPeriodStart: mapped.currentPeriodStart,
      currentPeriodEnd: mapped.currentPeriodEnd,
      cancelAtPeriodEnd: mapped.cancelAtPeriodEnd,
      canceledAt: mapped.canceledAt,
      endedAt: mapped.endedAt,
      trialEnd: mapped.trialEnd,
    },
    update: {
      plan: mapped.plan,
      status: mapped.status,
      stripeCustomerId,
      stripePriceId: mapped.stripePriceId,
      stripeProductId: mapped.stripeProductId,
      currentPeriodStart: mapped.currentPeriodStart,
      currentPeriodEnd: mapped.currentPeriodEnd,
      cancelAtPeriodEnd: mapped.cancelAtPeriodEnd,
      canceledAt: mapped.canceledAt,
      endedAt: mapped.endedAt,
      trialEnd: mapped.trialEnd,
    },
  });
  return userId;
}
