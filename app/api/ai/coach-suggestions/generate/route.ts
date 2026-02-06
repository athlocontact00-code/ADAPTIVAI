import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getEntitlements } from "@/lib/billing/entitlements";
import { generateCoachSuggestions } from "@/lib/services/coach-suggestions.service";

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const ent = await getEntitlements(session.user.id);
    if (!ent.canUseAICoach) {
      return NextResponse.json(
        { error: "Trial ended. Upgrade to Pro to use AI Coach.", code: "PAYWALL" },
        { status: 402 }
      );
    }

    let body: { contextDate?: string; force?: boolean } = {};
    try {
      body = await req.json();
    } catch {
      // empty body is ok
    }

    const result = await generateCoachSuggestions(
      session.user.id,
      body.contextDate,
      body.force ?? false
    );

    if (!result.ok) {
      return NextResponse.json(
        { error: result.error ?? "Failed to generate suggestions" },
        { status: 400 }
      );
    }

    return NextResponse.json({ ok: true, count: result.count });
  } catch (error) {
    console.error("[CoachSuggestions] Generate error:", error);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
