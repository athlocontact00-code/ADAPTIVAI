import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getStripeClient } from "@/lib/stripe";
import { syncSubscriptionFromStripe } from "@/lib/billing/stripe-sync";
import { createRequestId, logInfo, logWarn, logError } from "@/lib/logger";

function getWebhookSecret(): string {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret || secret.length < 10) {
    throw new Error("STRIPE_WEBHOOK_SECRET is not configured");
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
  const requestId = createRequestId();
  const env = process.env.NODE_ENV ?? "development";

  if (!process.env.STRIPE_WEBHOOK_SECRET || process.env.STRIPE_WEBHOOK_SECRET.length < 10) {
    logError("webhook.error", { requestId, env, message: "STRIPE_WEBHOOK_SECRET is not configured" });
    return NextResponse.json(
      { error: "Webhook configuration error" },
      { status: 500 }
    );
  }

  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    logWarn("webhook.missing_signature", { requestId, env });
    return NextResponse.json({ error: "Missing stripe-signature" }, { status: 400 });
  }

  const stripe = getStripeClient();

  try {
    const body = await req.text();
    const event = stripe.webhooks.constructEvent(body, signature, getWebhookSecret());

    logInfo("webhook.received", {
      requestId,
      env,
      eventId: event.id,
      eventType: event.type,
      livemode: event.livemode,
    });

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
        logInfo("webhook.idempotent_noop", { requestId, eventId: event.id, eventType: event.type });
        return NextResponse.json({ received: true });
      }

      logWarn("webhook.retry", { requestId, eventId: event.id, eventType: event.type });
    }

    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as unknown as { subscription?: string | null };
        if (session.subscription) {
          const sub = await stripe.subscriptions.retrieve(session.subscription);
          const userId = await syncSubscriptionFromStripe(sub);
          logInfo("webhook.processed", {
            requestId,
            eventId: event.id,
            eventType: event.type,
            userId: userId ?? null,
          });
        } else {
          logInfo("webhook.processed", {
            requestId,
            eventId: event.id,
            eventType: event.type,
            note: "no subscription",
          });
        }
        break;
      }

      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const sub = event.data.object as unknown as import("stripe").Stripe.Subscription;
        const userId = await syncSubscriptionFromStripe(sub);
        logInfo("webhook.processed", {
          requestId,
          eventId: event.id,
          eventType: event.type,
          userId: userId ?? null,
        });
        break;
      }

      case "invoice.payment_failed":
      case "invoice.paid": {
        const invoice = event.data.object as unknown as { subscription?: string | null };
        if (invoice.subscription) {
          const sub = await stripe.subscriptions.retrieve(invoice.subscription);
          const userId = await syncSubscriptionFromStripe(sub);
          logInfo("webhook.processed", {
            requestId,
            eventId: event.id,
            eventType: event.type,
            userId: userId ?? null,
          });
        } else {
          logInfo("webhook.processed", {
            requestId,
            eventId: event.id,
            eventType: event.type,
            note: "no subscription",
          });
        }
        break;
      }

      default:
        logInfo("webhook.processed", {
          requestId,
          eventId: event.id,
          eventType: event.type,
          note: "no-op",
        });
        break;
    }

    await markProcessed(event.id);
    return NextResponse.json({ received: true });
  } catch (error) {
    logError(
      "webhook.error",
      {
        requestId,
        env,
        message: error instanceof Error ? error.message : String(error),
      },
      error instanceof Error ? error : undefined
    );
    return NextResponse.json({ error: "Webhook error" }, { status: 400 });
  }
}
