import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const suggestion = await db.coachSuggestion.findFirst({
      where: { id, userId: session.user.id },
    });

    if (!suggestion) {
      return NextResponse.json({ error: "Suggestion not found" }, { status: 404 });
    }

    if (suggestion.status !== "PENDING") {
      return NextResponse.json(
        { error: "Suggestion already applied or dismissed" },
        { status: 400 }
      );
    }

    await db.coachSuggestion.update({
      where: { id },
      data: { status: "DISMISSED", dismissedAt: new Date() },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Failed to dismiss suggestion";
    console.error("[CoachSuggestions] Dismiss error:", error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
