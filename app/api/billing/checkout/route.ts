import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { createRequestId, logError } from "@/lib/logger";
import { db } from "@/lib/db";
import { getStripeClient } from "@/lib/stripe";
import { ensureStripeCustomerForUser } from "@/lib/billing/stripe-customer";
import { getProPriceIdForPlan } from "@/lib/billing/checkout-prices";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z
  .object({
    priceId: z.string().min(1).optional(),
    plan: z.enum(["month", "year"]).optional(),
    idempotencyKey: z.string().max(128).optional(),
  })
  .optional();

function getAppUrl(): string {
  const url = process.env.APP_URL;
  if (!url) throw new Error("Missing APP_URL");
  return url.replace(/\/$/, "");
}

function getPriceId(plan: "month" | "year", explicitPriceId?: string): string {
  return getProPriceIdForPlan(plan, explicitPriceId, {
    PRO_PRICE_ID_MONTHLY: process.env.PRO_PRICE_ID_MONTHLY,
    PRO_PRICE_ID_YEARLY: process.env.PRO_PRICE_ID_YEARLY,
    STRIPE_PRICE_ID_PRO: process.env.STRIPE_PRICE_ID_PRO,
    STRIPE_PRICE_ID_PRO_YEAR: process.env.STRIPE_PRICE_ID_PRO_YEAR,
  });
}

function errorToResponse(error: unknown): NextResponse {
  const message = error instanceof Error ? error.message : String(error);

  if (
    message.includes("Missing PRO_PRICE_ID_MONTHLY") ||
    message.includes("Missing STRIPE_PRICE_ID_PRO") ||
    message.includes("Missing STRIPE_PRICE_ID_PRO_YEAR") ||
    message.includes("Invalid priceId")
  ) {
    return NextResponse.json({ error: message }, { status: 400 });
  }

  if (
    message.includes("Missing APP_URL") ||
    message.includes("Missing STRIPE_SECRET_KEY")
  ) {
    return NextResponse.json({ error: message }, { status: 500 });
  }

  return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
}

export async function POST(req: Request) {
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

    const existingActive = await db.subscription.findFirst({
      where: {
        userId: user.id,
        status: { in: ["trialing", "active", "past_due"] },
      },
      select: { id: true },
    });
    if (existingActive) {
      const stripe = getStripeClient();
      try {
        const stripeCustomerId = user.stripeCustomerId ?? await ensureStripeCustomerForUser(user.id);
        const appUrl = getAppUrl();
        const portalSession = await stripe.billingPortal.sessions.create({
          customer: stripeCustomerId,
          return_url: `${appUrl}/settings`,
        });
        return NextResponse.json(
          {
            error: "You already have an active subscription. Open billing portal to manage it.",
            code: "ALREADY_SUBSCRIBED",
            portalUrl: portalSession.url,
          },
          { status: 409 }
        );
      } catch (portalErr) {
        logError("billing.checkout.portal_error", { requestId: createRequestId() }, portalErr instanceof Error ? portalErr : undefined);
        return NextResponse.json(
          {
            error: "You already have an active subscription. Open billing portal from Settings to manage it.",
            code: "ALREADY_SUBSCRIBED",
          },
          { status: 409 }
        );
      }
    }

    const parsedBody = bodySchema.parse(await req.json().catch(() => undefined));
    const plan = parsedBody?.plan ?? "month";
    const priceId = getPriceId(plan, parsedBody?.priceId);

    const stripe = getStripeClient();
    const stripeCustomerId = await ensureStripeCustomerForUser(user.id);

    const appUrl = getAppUrl();

    const idempotencyKey =
      typeof parsedBody?.idempotencyKey === "string" && parsedBody.idempotencyKey.length > 0
        ? parsedBody.idempotencyKey
        : `${user.id}:${priceId}:${new Date().toISOString().slice(0, 10)}`;

    const checkout = await stripe.checkout.sessions.create(
      {
        mode: "subscription",
        customer: stripeCustomerId,
        client_reference_id: user.id,
        line_items: [{ price: priceId, quantity: 1 }],
        success_url: `${appUrl}/settings?checkout=success`,
        cancel_url: `${appUrl}/settings?checkout=cancel`,
        allow_promotion_codes: true,
        subscription_data: {
          metadata: {
            userId: user.id,
            plan: "pro",
          },
        },
        metadata: {
          userId: user.id,
          plan: "pro",
        },
      },
      { idempotencyKey: idempotencyKey.slice(0, 255) }
    );

    return NextResponse.json({ url: checkout.url });
  } catch (error) {
    logError("billing.checkout.error", { requestId: createRequestId() }, error instanceof Error ? error : undefined);
    return errorToResponse(error);
  }
}
