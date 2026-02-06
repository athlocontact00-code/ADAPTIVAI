import { NextResponse } from "next/server";
import { verifyCronSecretFromRequest } from "@/lib/internal/cron-auth";
import { getStripeClient } from "@/lib/stripe";
import { syncSubscriptionFromStripe } from "@/lib/billing/stripe-sync";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  stripeSubscriptionId: z.string().min(3),
});

export async function POST(req: Request) {
  const auth = verifyCronSecretFromRequest(req);
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Invalid body" }, { status: 400 });
  }
  const { stripeSubscriptionId } = parsed.data;

  const stripe = getStripeClient();
  const sub = await stripe.subscriptions.retrieve(stripeSubscriptionId);
  await syncSubscriptionFromStripe(sub);

  return NextResponse.json(
    { ok: true, stripeSubscriptionId },
    { headers: { "Cache-Control": "no-store" } }
  );
}
