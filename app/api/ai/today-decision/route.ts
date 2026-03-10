import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  adaptiveDayPlannerPayloadSchema,
  getAdaptiveDayPlannerCacheSnapshot,
  persistAdaptiveDayPlannerCache,
} from "@/lib/services/adaptive-day-planner-cache.service";
import { buildAIContextForUser } from "@/lib/services/ai-context.builder";
import {
  buildAdaptiveDayPlannerFromContext,
  type AdaptiveDayPlannerPayload,
} from "@/lib/services/adaptive-day-planner.service";
import { startOfDay } from "@/lib/utils";
import { z } from "zod";

const InputSchema = z.object({
  date: z.string().datetime().optional(),
  force: z.boolean().optional(),
});

const DecisionSchema = adaptiveDayPlannerPayloadSchema;

function fallbackDecision(): AdaptiveDayPlannerPayload {
  return {
    decision: "PLAN_NEXT",
    state: "NO_PLAN",
    action: {
      title: "Plan the next sessions",
      details: "Create a 7-day plan in the AI Coach or Calendar to unlock adaptive daily decisions.",
      link: { type: "coach_chat" },
    },
    why: "The planner needs a visible short-horizon plan before it can adapt the day.",
    confidence: "LOW",
    reasons: ["No short-horizon plan available yet"],
    patchPreview: null,
  };
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { date?: string; force?: boolean } = {};
  try {
    body = await req.json().catch(() => ({}));
  } catch {
    // empty body ok
  }
  const parsed = InputSchema.safeParse(body);
  const { date: dateStr, force } = parsed.success ? parsed.data : { date: undefined, force: false };

  const decisionDate = dateStr ? startOfDay(new Date(dateStr)) : startOfDay(new Date());

  if (!force) {
    const cached = await getAdaptiveDayPlannerCacheSnapshot(session.user.id, decisionDate);
    if (cached.payload) {
      return NextResponse.json({
        decision: DecisionSchema.parse(cached.payload),
        cached: true,
        stale: cached.stale,
        staleReason: cached.staleReason,
        changedAt: cached.changedAt,
        date: decisionDate.toISOString(),
      });
    }
  }

  let decision: AdaptiveDayPlannerPayload;

  try {
    const context = await buildAIContextForUser(session.user.id);
    const horizonEnd = new Date(decisionDate);
    horizonEnd.setDate(horizonEnd.getDate() + 3);
    const tomorrow = new Date(decisionDate);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const [horizonWorkouts, feedbackRequiredWorkout] = await Promise.all([
      db.workout.findMany({
        where: {
          userId: session.user.id,
          date: { gte: decisionDate, lt: horizonEnd },
        },
        orderBy: [{ date: "asc" }, { createdAt: "asc" }],
        select: {
          id: true,
          title: true,
          type: true,
          date: true,
          planned: true,
          completed: true,
          durationMin: true,
          tss: true,
        },
      }),
      db.workout.findFirst({
        where: {
          userId: session.user.id,
          completed: true,
          date: { gte: decisionDate, lt: tomorrow },
          feedback: null,
        },
        orderBy: { date: "desc" },
        select: {
          id: true,
          title: true,
          type: true,
          date: true,
        },
      }),
    ]);

    const workoutsMapped = horizonWorkouts.map((workout) => ({
      ...workout,
      date: workout.date.toISOString().slice(0, 10),
    }));

    decision = buildAdaptiveDayPlannerFromContext({
      context,
      decisionDate: decisionDate.toISOString().slice(0, 10),
      todayWorkouts: workoutsMapped.filter((workout) => workout.date === decisionDate.toISOString().slice(0, 10)),
      horizonWorkouts: workoutsMapped,
      feedbackRequiredWorkout: feedbackRequiredWorkout
        ? {
            id: feedbackRequiredWorkout.id,
            title: feedbackRequiredWorkout.title,
            type: feedbackRequiredWorkout.type,
            date: feedbackRequiredWorkout.date.toISOString().slice(0, 10),
          }
        : null,
    });
  } catch (err) {
    console.error("[today-decision] planner failed:", err);
    decision = fallbackDecision();
  }

  decision = await persistAdaptiveDayPlannerCache(session.user.id, decisionDate, decision);

  return NextResponse.json({
    decision,
    cached: false,
    stale: false,
    staleReason: null,
    changedAt: null,
    date: decisionDate.toISOString(),
  });
}
