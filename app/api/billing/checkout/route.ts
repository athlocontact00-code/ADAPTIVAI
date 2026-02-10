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

type StripeErrorLike = {
  message: string;
  type?: string;
  code?: string;
  statusCode?: number;
  requestId?: string;
};

function toStripeErrorLike(error: unknown): StripeErrorLike | null {
  if (!error || typeof error !== "object") return null;
  const e = error as Record<string, unknown>;
  if (typeof e.message !== "string") return null;
  return {
    message: e.message,
    type: typeof e.type === "string" ? e.type : undefined,
    code: typeof e.code === "string" ? e.code : undefined,
    statusCode: typeof e.statusCode === "number" ? e.statusCode : undefined,
    requestId: typeof e.requestId === "string" ? e.requestId : undefined,
  };
}

function getCheckoutEnv(): {
  PRO_PRICE_ID_MONTHLY?: string;
  PRO_PRICE_ID_YEARLY?: string;
  STRIPE_PRICE_ID_PRO?: string;
  STRIPE_PRICE_ID_PRO_YEAR?: string;
} {
  const trim = (s: string | undefined) => (typeof s === "string" ? s.trim() || undefined : undefined);
  return {
    PRO_PRICE_ID_MONTHLY: trim(process.env.PRO_PRICE_ID_MONTHLY),
    PRO_PRICE_ID_YEARLY: trim(process.env.PRO_PRICE_ID_YEARLY),
    STRIPE_PRICE_ID_PRO: trim(process.env.STRIPE_PRICE_ID_PRO),
    STRIPE_PRICE_ID_PRO_YEAR: trim(process.env.STRIPE_PRICE_ID_PRO_YEAR),
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

function errorToResponse(error: unknown, requestId: string): NextResponse {
  const message = error instanceof Error ? error.message : String(error);

  if (
    message.includes("Missing PRO_PRICE_ID_MONTHLY") ||
    message.includes("Missing STRIPE_PRICE_ID_PRO") ||
    message.includes("Missing STRIPE_PRICE_ID_PRO_YEAR") ||
    message.includes("Monthly plan is using the yearly price") ||
    message.includes("Invalid priceId")
  ) {
    return NextResponse.json({ error: message, requestId }, { status: 400 });
  }

  if (message.includes("Missing STRIPE_SECRET_KEY")) {
    return NextResponse.json({ error: message, requestId }, { status: 500 });
  }

  const stripeErr = toStripeErrorLike(error);
  if (stripeErr?.type?.startsWith("Stripe")) {
    const status =
      typeof stripeErr.statusCode === "number" && stripeErr.statusCode >= 400 && stripeErr.statusCode < 500
        ? 400
        : 500;
    return NextResponse.json(
      {
        error: stripeErr.message,
        requestId,
        stripe: {
          type: stripeErr.type,
          code: stripeErr.code,
          requestId: stripeErr.requestId,
        },
      },
      { status }
    );
  }

  return NextResponse.json({ error: "Something went wrong", requestId }, { status: 500 });
}

export async function POST(req: Request) {
  const requestId = createRequestId();
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized", requestId }, { status: 401 });
    }

    const user = await db.user.findUnique({
      where: { id: session.user.id },
      select: { id: true, email: true, stripeCustomerId: true },
    });

    if (!user) {
      return NextResponse.json({ error: "Unauthorized", requestId }, { status: 401 });
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
            requestId,
          },
          { status: 409 }
        );
      } catch (portalErr) {
        logError("billing.checkout.portal_error", { requestId }, portalErr instanceof Error ? portalErr : undefined);
        return NextResponse.json(
          {
            error: "You already have an active subscription. Open billing portal from Settings to manage it.",
            code: "ALREADY_SUBSCRIBED",
            requestId,
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
      logError("billing.checkout.price_config", { requestId, plan, normalizedPlan }, e instanceof Error ? e : undefined);
      return NextResponse.json({ error: msg, plan, normalizedPlan, requestId }, { status: 400 });
    }

    if (!priceId || !priceId.startsWith("price_")) {
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
          requestId,
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
      requestId,
    });

    const stripe = getStripeClient();

    // Preflight validate Stripe price config (recurring interval + key mode). This turns vague 500s into actionable 400s.
    try {
      const price = await stripe.prices.retrieve(priceId);
      const interval = price.recurring?.interval ?? null;

      if (!price.active) {
        return NextResponse.json(
          {
            error: `Stripe Price ${priceId} is inactive. Enable it in Stripe or set a different Price ID.`,
            plan,
            normalizedPlan,
            requestId,
          },
          { status: 400 }
        );
      }

      if (keyMode === "live" && price.livemode === false) {
        return NextResponse.json(
          {
            error:
              `You're using a TEST price (${priceId}) with a LIVE Stripe key. ` +
              `Set STRIPE_PRICE_ID_PRO / STRIPE_PRICE_ID_PRO_YEAR (or PRO_PRICE_ID_*) to LIVE price IDs.`,
            plan,
            normalizedPlan,
            requestId,
          },
          { status: 400 }
        );
      }
      if (keyMode === "test" && price.livemode === true) {
        return NextResponse.json(
          {
            error:
              `You're using a LIVE price (${priceId}) with a TEST Stripe key. ` +
              `Set STRIPE_PRICE_ID_PRO / STRIPE_PRICE_ID_PRO_YEAR (or PRO_PRICE_ID_*) to TEST price IDs.`,
            plan,
            normalizedPlan,
            requestId,
          },
          { status: 400 }
        );
      }

      if (!interval) {
        return NextResponse.json(
          {
            error:
              `Stripe Price ${priceId} is not recurring. Create a recurring subscription price in Stripe (interval: ${plan === "year" ? "year" : "month"}).`,
            plan,
            normalizedPlan,
            requestId,
          },
          { status: 400 }
        );
      }
      if (plan === "month" && interval !== "month") {
        return NextResponse.json(
          {
            error:
              `Monthly plan requires a price with interval=month, but Stripe Price ${priceId} has interval=${interval}. ` +
              `Set STRIPE_PRICE_ID_PRO / PRO_PRICE_ID_MONTHLY to the monthly recurring price ID.`,
            plan,
            normalizedPlan,
            requestId,
          },
          { status: 400 }
        );
      }
      if (plan === "year" && interval !== "year") {
        return NextResponse.json(
          {
            error:
              `Yearly plan requires a price with interval=year, but Stripe Price ${priceId} has interval=${interval}. ` +
              `Set STRIPE_PRICE_ID_PRO_YEAR / PRO_PRICE_ID_YEARLY to the yearly recurring price ID.`,
            plan,
            normalizedPlan,
            requestId,
          },
          { status: 400 }
        );
      }
    } catch (e) {
      logError("billing.checkout.price_retrieve_error", { requestId, plan, normalizedPlan, priceId, keyMode }, e instanceof Error ? e : undefined);
      return errorToResponse(e, requestId);
    }

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
    logError("billing.checkout.error", { requestId }, error instanceof Error ? error : undefined);
    return errorToResponse(error, requestId);
  }
}
