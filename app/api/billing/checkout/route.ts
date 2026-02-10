import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { createRequestId, logError, logInfo } from "@/lib/logger";
import { db } from "@/lib/db";
import { getStripeClient } from "@/lib/stripe";
import { ensureStripeCustomerForUser } from "@/lib/billing/stripe-customer";
import { getEntitlements } from "@/lib/billing/entitlements";
import {
  getProPriceIdForPlan,
  normalizePlan,
  type BillingPlan,
} from "@/lib/billing/checkout-prices";
import { getAppUrl, BILLING_SETTINGS_PATH } from "@/lib/app-url";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z
  .object({
    plan: z.string().max(32).optional(),
    idempotencyKey: z.string().max(128).optional(),
  })
  .optional();

function getCheckoutEnv(): {
  PRO_PRICE_ID_MONTHLY?: string;
  PRO_PRICE_ID_YEARLY?: string;
  STRIPE_PRICE_ID_PRO?: string;
  STRIPE_PRICE_ID_PRO_YEAR?: string;
} {
  return {
    PRO_PRICE_ID_MONTHLY: process.env.PRO_PRICE_ID_MONTHLY,
    PRO_PRICE_ID_YEARLY: process.env.PRO_PRICE_ID_YEARLY,
    STRIPE_PRICE_ID_PRO: process.env.STRIPE_PRICE_ID_PRO,
    STRIPE_PRICE_ID_PRO_YEAR: process.env.STRIPE_PRICE_ID_PRO_YEAR,
  };
}

/** Deterministic priceId from plan only (no client-supplied price). */
function getPriceIdForPlan(plan: BillingPlan): string {
  return getProPriceIdForPlan(plan, undefined, getCheckoutEnv());
}

function getStripeKeyMode(): "test" | "live" {
  const key = process.env.STRIPE_SECRET_KEY ?? "";
  return key.startsWith("sk_test_") ? "test" : "live";
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

  if (message.includes("Missing STRIPE_SECRET_KEY")) {
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

    const ent = await getEntitlements(user.id);
    if (ent.plan === "PRO") {
      const stripe = getStripeClient();
      try {
        const stripeCustomerId = user.stripeCustomerId ?? await ensureStripeCustomerForUser(user.id);
        const appUrl = getAppUrl();
        const portalSession = await stripe.billingPortal.sessions.create({
          customer: stripeCustomerId,
          return_url: `${appUrl}${BILLING_SETTINGS_PATH}`,
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
    const plan = normalizePlan(parsedBody?.plan);
    const normalizedPlan = plan === "year" ? "yearly" : "monthly";

    let priceId: string;
    try {
      priceId = getPriceIdForPlan(plan);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      logError("billing.checkout.price_config", { requestId: createRequestId(), plan, normalizedPlan }, e instanceof Error ? e : undefined);
      return NextResponse.json({ error: msg, plan, normalizedPlan }, { status: 400 });
    }

    if (!priceId || !priceId.startsWith("price_")) {
      const requestId = createRequestId();
      logError("billing.checkout.invalid_price_id", {
        requestId,
        plan,
        normalizedPlan,
        priceId: priceId ?? null,
        hint: "Stripe Checkout requires a Price ID (price_xxx). Set PRO_PRICE_ID_MONTHLY/STRIPE_PRICE_ID_PRO (monthly) or PRO_PRICE_ID_YEARLY/STRIPE_PRICE_ID_PRO_YEAR (yearly) in env.",
      });
      return NextResponse.json(
        {
          error: "Invalid or missing Stripe Price ID (price_xxx required).",
          plan,
          normalizedPlan,
          priceId: priceId ?? null,
        },
        { status: 500 }
      );
    }

    const keyMode = getStripeKeyMode();
    const host = (() => {
      try {
        if (req.url) return new URL(req.url).host;
      } catch {
        // ignore
      }
      try {
        const u = getAppUrl();
        if (u) return new URL(u).host;
      } catch {
        // ignore
      }
      return "";
    })();
    logInfo("billing.checkout.create", {
      plan,
      normalizedPlan,
      priceId,
      keyMode,
      host,
      requestId: createRequestId(),
    });

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
        success_url: `${appUrl}${BILLING_SETTINGS_PATH}&success=1&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${appUrl}${BILLING_SETTINGS_PATH}&canceled=1`,
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
