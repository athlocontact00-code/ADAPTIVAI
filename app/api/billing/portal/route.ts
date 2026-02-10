import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { createRequestId, logError } from "@/lib/logger";
import { getStripeClient } from "@/lib/stripe";
import { ensureStripeCustomerForUser } from "@/lib/billing/stripe-customer";
import { getAppUrl, BILLING_SETTINGS_PATH } from "@/lib/app-url";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await db.user.findUnique({
      where: { id: session.user.id },
      select: { id: true, email: true, stripeCustomerId: true },
    });

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const stripe = getStripeClient();

    const stripeCustomerId = await ensureStripeCustomerForUser(user.id);

    const appUrl = getAppUrl();

    const portal = await stripe.billingPortal.sessions.create({
      customer: stripeCustomerId,
      return_url: `${appUrl}${BILLING_SETTINGS_PATH}`,
    });

    return NextResponse.json({ url: portal.url });
  } catch (error) {
    logError("billing.portal.error", { requestId: createRequestId() }, error instanceof Error ? error : undefined);
    const message =
      error instanceof Error ? error.message : "Failed to create billing portal session";
    const isConfigError =
      message.includes("STRIPE") || message.includes("Missing");
    return NextResponse.json(
      { error: isConfigError ? message : "Billing portal temporarily unavailable. Please try again." },
      { status: 500 }
    );
  }
}
