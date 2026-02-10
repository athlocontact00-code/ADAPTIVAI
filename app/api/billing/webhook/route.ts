import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { db } from "@/lib/db";
import { getStripeClient } from "@/lib/stripe";
import { syncSubscriptionFromStripe } from "@/lib/billing/stripe-sync";
import { resolveSubscriptionFromInvoice } from "@/lib/billing/webhook-invoice";
import { createRequestId, logInfo, logWarn, logError } from "@/lib/logger";
import { getAppUrl } from "@/lib/app-url";

const WEBHOOK_PATH = "/api/billing/webhook";

function getWebhookSecret(): string {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret || secret.length < 10) {
    throw new Error("STRIPE_WEBHOOK_SECRET is not configured");
  }
  return secret;
}

let _webhookUrlLogged = false;
function logExpectedWebhookUrlOnce(): void {
  if (_webhookUrlLogged) return;
  _webhookUrlLogged = true;
  const base = getAppUrl();
  const expected = `${base}${WEBHOOK_PATH}`;
  logInfo("webhook.expected_url", { expectedUrl: expected });
  if (process.env.NODE_ENV === "production" && !process.env.APP_URL) {
    logWarn("webhook.app_url_missing", {
      message: "APP_URL is not set in production; Stripe Dashboard webhook URL should use canonical base (e.g. https://www.adaptivai.online)",
    });
  }
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

  logExpectedWebhookUrlOnce();

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
        const session = event.data.object as Stripe.Checkout.Session;
        const customerId =
          typeof session.customer === "string" ? session.customer : session.customer?.id ?? null;
        const clientReferenceId = session.client_reference_id ?? null;
        if (session.subscription) {
          const subId = typeof session.subscription === "string" ? session.subscription : session.subscription.id;
          const sub = await stripe.subscriptions.retrieve(subId);
          let userId = await syncSubscriptionFromStripe(sub);
          if (!userId && customerId && clientReferenceId) {
            await db.user.updateMany({
              where: { id: clientReferenceId },
              data: { stripeCustomerId: customerId },
            });
            userId = await syncSubscriptionFromStripe(sub);
          }
          logInfo("webhook.processed", {
            requestId,
            eventId: event.id,
            eventType: event.type,
            userId: userId ?? null,
          });
        } else if (customerId && clientReferenceId) {
          await db.user.updateMany({
            where: { id: clientReferenceId },
            data: { stripeCustomerId: customerId },
          });
          logInfo("webhook.processed", {
            requestId,
            eventId: event.id,
            eventType: event.type,
            note: "customer saved, no subscription",
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
      case "invoice.payment_succeeded":
      case "invoice.paid": {
        const invoice = event.data.object as Stripe.Invoice;
        const sub = await resolveSubscriptionFromInvoice(stripe, invoice);
        if (sub) {
          const userId = await syncSubscriptionFromStripe(sub);
          logInfo("webhook.processed", {
            requestId,
            eventId: event.id,
            eventType: event.type,
            userId: userId ?? null,
          });
        } else {
          const customerId = typeof invoice.customer === "string" ? invoice.customer : invoice.customer?.id;
          logWarn("webhook.invoice_no_subscription", {
            requestId,
            eventId: event.id,
            eventType: event.type,
            invoiceId: invoice.id,
            customerId: customerId ?? null,
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
