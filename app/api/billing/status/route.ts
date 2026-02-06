import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getEntitlements } from "@/lib/billing/entitlements";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const ent = await getEntitlements(session.user.id);

    return NextResponse.json({
      plan: ent.plan,
      isPro: ent.isPro,
      isTrialActive: ent.isTrialActive,
      trialEndsAt: ent.trialEndsAt?.toISOString() ?? null,
      trialDaysRemaining: ent.trialDaysRemaining,
      currentPeriodEnd: ent.currentPeriodEnd?.toISOString() ?? null,
      canUseAICoach: ent.canUseAICoach,
      canUseSimulator: ent.canUseSimulator,
      canUseReports: ent.canUseReports,
    });
  } catch (error) {
    console.error("Billing status error:", error);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
