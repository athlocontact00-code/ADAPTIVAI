import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getStripeClient } from "@/lib/stripe";
import { syncSubscriptionFromStripe } from "@/lib/billing/stripe-sync";
import { getEntitlements } from "@/lib/billing/entitlements";
import { resyncUserBilling } from "@/lib/billing/resync-user";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const url = new URL(req.url);
    const refresh = url.searchParams.get("refresh") === "1";
    const sessionId = url.searchParams.get("session_id")?.trim();

    if (sessionId && sessionId.startsWith("cs_")) {
      const stripe = getStripeClient();
      try {
        const checkoutSession = await stripe.checkout.sessions.retrieve(sessionId, {
          expand: ["subscription"],
        });
        if (checkoutSession.client_reference_id !== session.user.id) {
          return NextResponse.json({ error: "Session does not belong to this user" }, { status: 403 });
        }
        const customerId =
          typeof checkoutSession.customer === "string"
            ? checkoutSession.customer
            : checkoutSession.customer?.id ?? null;
        const subId =
          typeof checkoutSession.subscription === "object" && checkoutSession.subscription?.id
            ? checkoutSession.subscription.id
            : typeof checkoutSession.subscription === "string"
              ? checkoutSession.subscription
              : null;
        if (customerId) {
          await db.user.update({
            where: { id: session.user.id },
            data: { stripeCustomerId: customerId },
          });
        }
        if (subId) {
          const sub = await stripe.subscriptions.retrieve(subId);
          await syncSubscriptionFromStripe(sub);
        }
        revalidatePath("/settings");
        revalidatePath("/simulator");
        revalidatePath("/dashboard");
        revalidatePath("/");
      } catch (e) {
        console.error("Billing status: checkout session sync failed", e);
      }
    } else if (refresh) {
      const result = await resyncUserBilling(session.user.id);
      if (!result.ok) {
        return NextResponse.json(
          { error: result.error ?? "Resync failed" },
          { status: 502 }
        );
      }
      revalidatePath("/settings");
      revalidatePath("/simulator");
      revalidatePath("/dashboard");
      revalidatePath("/");
    }

    const ent = await getEntitlements(session.user.id);
    const canUsePro = ent.plan === "PRO";

    const json = {
      plan: ent.plan,
      isPro: ent.isPro,
      canUsePro,
      status: ent.status,
      subscriptionStatus: ent.status,
      isTrialActive: ent.isTrialActive,
      trialEndsAt: ent.trialEndsAt?.toISOString() ?? null,
      trialDaysRemaining: ent.trialDaysRemaining,
      currentPeriodEnd: ent.currentPeriodEnd?.toISOString() ?? null,
      cancelAtPeriodEnd: ent.cancelAtPeriodEnd,
      canUseAICoach: ent.canUseAICoach,
      canUseSimulator: ent.canUseSimulator,
      canUseReports: ent.canUseReports,
      timestamp: new Date().toISOString(),
    };

    return NextResponse.json(json, {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
        Pragma: "no-cache",
      },
    });
  } catch (error) {
    console.error("Billing status error:", error);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
