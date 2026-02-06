import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatLocalDateInput } from "@/lib/utils";

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const dateParam = searchParams.get("date");
    const includeApplied = searchParams.get("includeApplied") === "true";

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const contextDate = dateParam ? new Date(dateParam) : today;
    contextDate.setHours(0, 0, 0, 0);

    const where: { userId: string; contextDate: Date; status?: string } = {
      userId: session.user.id,
      contextDate,
    };
    if (!includeApplied) {
      where.status = "PENDING";
    }

    const suggestions = await db.coachSuggestion.findMany({
      where,
      orderBy: { createdAt: "asc" },
    });

    const items = suggestions.map((s) => ({
      id: s.id,
      contextDate: formatLocalDateInput(s.contextDate),
      scope: s.scope,
      type: s.type,
      title: s.title,
      summary: s.summary,
      why: s.why,
      payload: JSON.parse(s.payload || "{}") as Record<string, unknown>,
      status: s.status,
      appliedAt: s.appliedAt,
      dismissedAt: s.dismissedAt,
      createdAt: s.createdAt,
    }));

    return NextResponse.json({ suggestions: items });
  } catch (error) {
    console.error("[CoachSuggestions] GET error:", error);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
