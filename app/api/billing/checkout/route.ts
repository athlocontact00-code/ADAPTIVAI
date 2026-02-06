import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getStripeClient } from "@/lib/stripe";
import { ensureStripeCustomerForUser } from "@/lib/billing/stripe-customer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z
  .object({
    priceId: z.string().min(1).optional(),
  })
  .optional();

function getAppUrl(): string {
  const url = process.env.APP_URL;
  if (!url) throw new Error("Missing APP_URL");
  return url.replace(/\/$/, "");
}

const ALLOWED_PRICE_IDS = [
  process.env.PRO_PRICE_ID_MONTHLY,
  process.env.PRO_PRICE_ID_YEARLY,
  process.env.STRIPE_PRICE_ID_PRO,
].filter(Boolean) as string[];

function getProPriceId(input?: string): string {
  const defaultId = process.env.PRO_PRICE_ID_MONTHLY ?? process.env.STRIPE_PRICE_ID_PRO;
  const candidate = input ?? defaultId;
  if (!candidate) {
    throw new Error("Missing PRO_PRICE_ID_MONTHLY or STRIPE_PRICE_ID_PRO (or priceId in request)");
  }
  if (ALLOWED_PRICE_IDS.length > 0 && !ALLOWED_PRICE_IDS.includes(candidate)) {
    throw new Error("Invalid priceId");
  }
  return candidate;
}

function errorToResponse(error: unknown): NextResponse {
  const message = error instanceof Error ? error.message : String(error);

  if (
    message.includes("Missing PRO_PRICE_ID_MONTHLY") ||
    message.includes("Missing STRIPE_PRICE_ID_PRO") ||
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

    const parsedBody = bodySchema.parse(await req.json().catch(() => undefined));
    const priceId = getProPriceId(parsedBody?.priceId);

    const stripe = getStripeClient();

    const stripeCustomerId = await ensureStripeCustomerForUser(user.id);

    const appUrl = getAppUrl();

    const checkout = await stripe.checkout.sessions.create({
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
    });

    return NextResponse.json({ url: checkout.url });
  } catch (error) {
    console.error("Create checkout session error:", error);
    return errorToResponse(error);
  }
}
