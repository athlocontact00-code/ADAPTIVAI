import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getStripeClient } from "@/lib/stripe";
import { syncSubscriptionFromStripe } from "@/lib/billing/stripe-sync";

function getWebhookSecret(): string {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    throw new Error("Missing STRIPE_WEBHOOK_SECRET");
  }
  return secret;
}

async function markProcessed(stripeEventId: string): Promise<void> {
  await db.stripeEvent.update({
    where: { stripeEventId },
    data: { processedAt: new Date() },
  });
}

export async function POST(req: Request) {
  const stripe = getStripeClient();

  try {
    const signature = req.headers.get("stripe-signature");
    if (!signature) {
      return NextResponse.json({ error: "Missing stripe-signature" }, { status: 400 });
    }

    const body = await req.text();
    const event = stripe.webhooks.constructEvent(body, signature, getWebhookSecret());

    // Idempotency:
    // - Create event record if first time
    // - If already exists + processedAt set => no-op
    // - If exists but processedAt null => retry allowed
    try {
      await db.stripeEvent.create({
        data: {
          stripeEventId: event.id,
          type: event.type,
          livemode: event.livemode,
        },
      });
    } catch {
      const existing = await db.stripeEvent.findUnique({
        where: { stripeEventId: event.id },
        select: { processedAt: true },
      });

      if (existing?.processedAt) {
        return NextResponse.json({ received: true });
      }

      console.warn("[billing] Retrying previously seen event", event.id, event.type);
    }

    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as unknown as { subscription?: string | null };
        if (session.subscription) {
          const sub = await stripe.subscriptions.retrieve(session.subscription);
          await syncSubscriptionFromStripe(sub);
        }
        break;
      }

      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const sub = event.data.object as unknown as import("stripe").Stripe.Subscription;
        await syncSubscriptionFromStripe(sub);
        break;
      }

      case "invoice.payment_failed":
      case "invoice.paid": {
        const invoice = event.data.object as unknown as { subscription?: string | null };
        if (invoice.subscription) {
          const sub = await stripe.subscriptions.retrieve(invoice.subscription);
          await syncSubscriptionFromStripe(sub);
        }
        break;
      }

      default:
        break;
    }

    await markProcessed(event.id);
    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Stripe webhook error:", error);
    return NextResponse.json({ error: "Webhook error" }, { status: 400 });
  }
}
