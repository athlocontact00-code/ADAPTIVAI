import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { getEntitlements } from "@/lib/billing/entitlements";
import { resyncUserBilling } from "@/lib/billing/resync-user";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const url = new URL(req.url);
    const refresh = url.searchParams.get("refresh") === "1";
    if (refresh) {
      const result = await resyncUserBilling(session.user.id);
      if (!result.ok) {
        return NextResponse.json(
          { error: result.error ?? "Resync failed" },
          { status: 502 }
        );
      }
      revalidatePath("/settings");
      revalidatePath("/simulator");
      revalidatePath("/dashboard");
      revalidatePath("/");
    }

    const ent = await getEntitlements(session.user.id);
    const canUsePro = ent.plan === "PRO";

    const json = {
      plan: ent.plan,
      isPro: ent.isPro,
      canUsePro,
      status: ent.status,
      subscriptionStatus: ent.status,
      isTrialActive: ent.isTrialActive,
      trialEndsAt: ent.trialEndsAt?.toISOString() ?? null,
      trialDaysRemaining: ent.trialDaysRemaining,
      currentPeriodEnd: ent.currentPeriodEnd?.toISOString() ?? null,
      cancelAtPeriodEnd: ent.cancelAtPeriodEnd,
      canUseAICoach: ent.canUseAICoach,
      canUseSimulator: ent.canUseSimulator,
      canUseReports: ent.canUseReports,
      timestamp: new Date().toISOString(),
    };

    return NextResponse.json(json, {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
        Pragma: "no-cache",
      },
    });
  } catch (error) {
    console.error("Billing status error:", error);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
