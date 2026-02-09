import type Stripe from "stripe";

/** Runtime shape we read from Stripe Invoice (subscription can be string or expanded; line items can have subscription). */
type InvoiceSubscriptionShape = {
  subscription?: string | { id?: string } | null;
  lines?: { data?: Array<{ subscription?: string | null }> } | null;
  customer?: string | { id?: string } | null;
  period_end?: number;
};

/**
 * Extract subscription ID from Stripe Invoice (object or expanded).
 * Used by billing webhook for invoice.paid / invoice.payment_succeeded.
 */
export function getSubscriptionIdFromInvoice(invoice: Stripe.Invoice): string | null {
  const inv = invoice as unknown as InvoiceSubscriptionShape;
  const sub = inv.subscription;
  if (typeof sub === "string") return sub;
  if (sub && typeof (sub as { id?: string }).id === "string") return (sub as { id: string }).id;
  const firstLine = inv.lines?.data?.[0];
  if (firstLine && typeof firstLine.subscription === "string") return firstLine.subscription;
  return null;
}

/**
 * Resolve full subscription from invoice: by subscription id, then fallback to customer's subscriptions.
 */
export async function resolveSubscriptionFromInvoice(
  stripe: Stripe,
  invoice: Stripe.Invoice
): Promise<Stripe.Subscription | null> {
  let subscriptionId = getSubscriptionIdFromInvoice(invoice);
  if (subscriptionId) {
    try {
      return await stripe.subscriptions.retrieve(subscriptionId);
    } catch {
      subscriptionId = null;
    }
  }
  const inv = invoice as unknown as InvoiceSubscriptionShape;
  const customerId = typeof inv.customer === "string" ? inv.customer : inv.customer?.id;
  if (!customerId) return null;
  const list = await stripe.subscriptions.list({
    customer: customerId,
    status: "all",
    limit: 5,
  });
  if (list.data.length === 0) return null;
  const periodEnd = inv.period_end ?? 0;
  type SubWithPeriod = Stripe.Subscription & { current_period_end?: number };
  const byPeriod = list.data.find((s) => (s as SubWithPeriod).current_period_end === periodEnd);
  return byPeriod
    ? await stripe.subscriptions.retrieve(byPeriod.id)
    : await stripe.subscriptions.retrieve(list.data[0].id);
}
