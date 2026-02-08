/**
 * Resync a user's subscription from Stripe (list by customer, sync each).
 * Used by admin resync API and server action. No auth inside; caller must enforce.
 */
import { db } from "@/lib/db";
import { getStripeClient } from "@/lib/stripe";
import { syncSubscriptionFromStripe } from "@/lib/billing/stripe-sync";
import { getEntitlements } from "@/lib/billing/entitlements";
import { logInfo } from "@/lib/logger";

export type ResyncUserResult = {
  ok: true;
  resyncedUserId: string;
  subscriptionStatus: string | null;
  entitlements: Awaited<ReturnType<typeof getEntitlements>>;
} | {
  ok: false;
  error: string;
};

export async function resyncUserBilling(userId: string): Promise<ResyncUserResult> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, stripeCustomerId: true },
  });

  if (!user) {
    return { ok: false, error: "User not found" };
  }

  const stripeCustomerId = user.stripeCustomerId;
  if (!stripeCustomerId) {
    const ent = await getEntitlements(userId);
    logInfo("admin.resync.no_stripe_customer", { userId });
    return {
      ok: true,
      resyncedUserId: userId,
      subscriptionStatus: null,
      entitlements: ent,
    };
  }

  try {
    const stripe = getStripeClient();
    const list = await stripe.subscriptions.list({
      customer: stripeCustomerId,
      status: "all",
      limit: 20,
    });

    for (const sub of list.data) {
      const full = await stripe.subscriptions.retrieve(sub.id);
      await syncSubscriptionFromStripe(full);
    }

    const sub = await db.subscription.findFirst({
      where: { userId },
      orderBy: { updatedAt: "desc" },
      select: { status: true },
    });

    const entitlements = await getEntitlements(userId);
    logInfo("admin.resync.done", { userId, subscriptionStatus: sub?.status ?? null });
    return {
      ok: true,
      resyncedUserId: userId,
      subscriptionStatus: sub?.status ?? null,
      entitlements,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Stripe error";
    logInfo("admin.resync.failed", { userId, error: message });
    return { ok: false, error: message };
  }
}
