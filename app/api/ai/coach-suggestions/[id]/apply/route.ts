import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { applySuggestionPayload } from "@/lib/services/coach-suggestion-apply.service";
import { isWorkoutLocked, type PlanRigiditySetting } from "@/lib/services/plan-rigidity.service";
import { parseDateToLocalNoon } from "@/lib/utils";

async function anyAffectedWorkoutLocked(
  userId: string,
  payload: Record<string, unknown> & { kind?: string },
  planRigidity: PlanRigiditySetting
): Promise<boolean> {
  const kind = payload.kind;
  const now = new Date();

  if (kind === "adjustWorkout" && typeof payload.workoutId === "string") {
    const w = await db.workout.findFirst({
      where: { id: payload.workoutId, userId },
      select: { date: true },
    });
    return w ? isWorkoutLocked({ workoutDate: w.date, now, planRigidity }) : false;
  }

  if (kind === "swapWorkouts" && typeof payload.fromWorkoutId === "string" && typeof payload.toDate === "string") {
    const w = await db.workout.findFirst({
      where: { id: payload.fromWorkoutId, userId },
      select: { date: true },
    });
    if (w && isWorkoutLocked({ workoutDate: w.date, now, planRigidity })) return true;
    const toDate = parseDateToLocalNoon(payload.toDate);
    return isWorkoutLocked({ workoutDate: toDate, now, planRigidity });
  }

  if (kind === "moveWorkout" && typeof payload.workoutId === "string" && typeof payload.toDate === "string") {
    const toDate = parseDateToLocalNoon(payload.toDate);
    return isWorkoutLocked({ workoutDate: toDate, now, planRigidity });
  }

  if (kind === "addRecoveryDay" && typeof payload.date === "string") {
    const d = parseDateToLocalNoon(payload.date);
    return isWorkoutLocked({ workoutDate: d, now, planRigidity });
  }

  if (kind === "rebalanceWeek" && Array.isArray(payload.changes)) {
    for (const c of payload.changes) {
      if (typeof c !== "object" || c === null || typeof (c as { workoutId?: unknown }).workoutId !== "string")
        continue;
      const w = await db.workout.findFirst({
        where: { id: (c as { workoutId: string }).workoutId, userId },
        select: { date: true },
      });
      if (w && isWorkoutLocked({ workoutDate: w.date, now, planRigidity })) return true;
    }
  }

  return false;
}

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

    let payload: Record<string, unknown>;
    try {
      payload = JSON.parse(suggestion.payload || "{}") as Record<string, unknown>;
    } catch {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    const profile = await db.profile.findUnique({
      where: { userId: session.user.id },
      select: { planRigidity: true },
    });
    const rigidity = (profile?.planRigidity ?? "LOCKED_1_DAY") as PlanRigiditySetting;

    if (rigidity !== "FLEXIBLE_WEEK") {
      const locked = await anyAffectedWorkoutLocked(session.user.id, payload, rigidity);
      if (locked) {
        await db.planChangeProposal.create({
          data: {
            userId: session.user.id,
            sourceType: "COACH",
            summary: suggestion.title || suggestion.summary || "Coach suggestion",
            patchJson: JSON.stringify(payload),
          },
        });
        await db.coachSuggestion.update({
          where: { id },
          data: { status: "APPLIED", appliedAt: new Date() },
        });
        return NextResponse.json({ ok: true, proposalCreated: true });
      }
    }

    const result = await applySuggestionPayload(session.user.id, payload);

    if (!result.ok) {
      return NextResponse.json(
        { error: result.error ?? "Failed to apply" },
        { status: 400 }
      );
    }

    await db.coachSuggestion.update({
      where: { id },
      data: { status: "APPLIED", appliedAt: new Date() },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.error("[CoachSuggestions] Apply error:", error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
