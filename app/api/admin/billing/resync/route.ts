import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { isAdmin, verifyAdminSecretHeader } from "@/lib/admin";
import { resyncUserBilling } from "@/lib/billing/resync-user";
import { z } from "zod";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const bodySchema = z.object({
  userId: z.string().optional(),
});

export async function POST(req: Request) {
  const session = await auth();
  const hasSecret = verifyAdminSecretHeader(req);

  if (!hasSecret && !session?.user?.id) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  if (!hasSecret && !isAdmin(session)) {
    return NextResponse.json({ ok: false, error: "Forbidden: admin only" }, { status: 403 });
  }

  const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Invalid body" }, { status: 400 });
  }

  const targetUserId = parsed.data.userId ?? session?.user?.id;
  if (!targetUserId) {
    return NextResponse.json(
      { ok: false, error: "Provide userId in body or be logged in" },
      { status: 400 }
    );
  }

  const result = await resyncUserBilling(targetUserId);

  if (!result.ok) {
    return NextResponse.json(
      { ok: false, error: result.error },
      { status: 422 }
    );
  }

  return NextResponse.json(
    {
      ok: true,
      resyncedUserId: result.resyncedUserId,
      subscriptionStatus: result.subscriptionStatus,
      entitlements: {
        plan: result.entitlements.plan,
        status: result.entitlements.status,
        currentPeriodEnd: result.entitlements.currentPeriodEnd?.toISOString() ?? null,
        isPro: result.entitlements.isPro,
      },
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
