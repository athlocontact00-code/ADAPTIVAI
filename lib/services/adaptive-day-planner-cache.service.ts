import { z } from "zod";

import { db } from "@/lib/db";
import type { AdaptiveDayPlannerPayload } from "@/lib/services/adaptive-day-planner.service";

export type AdaptiveDayPlannerStaleReason = "CHECKIN_UPDATED" | "WORKOUT_UPDATED";
const ADAPTIVE_DAY_PLANNER_HORIZON_DAYS = 3;

function normalizeDecisionDate(date: Date): Date {
  const normalized = new Date(date);
  normalized.setHours(0, 0, 0, 0);
  return normalized;
}

export const adaptiveDayPlannerPayloadSchema = z.object({
  decision: z.enum(["CHECK_IN_FIRST", "DO_THIS_WORKOUT", "ADAPT_SESSION", "RECOVER_AND_REPLAN", "PLAN_NEXT"]),
  state: z.enum(["NO_PLAN", "CHECK_IN_REQUIRED", "READY", "ADAPT", "FEEDBACK_REQUIRED", "COMPLETE"]),
  generatedAt: z.string().datetime().optional(),
  action: z.object({
    title: z.string(),
    details: z.string(),
    targets: z
      .object({
        discipline: z.enum(["run", "bike", "swim", "strength"]).optional(),
        paceRange: z.string().optional(),
        powerRange: z.string().optional(),
        hrRange: z.string().optional(),
        durationMin: z.number().optional(),
      })
      .optional(),
    link: z
      .object({
        type: z.enum(["workout", "calendar_day", "coach_chat"]),
        id: z.string().optional(),
        date: z.string().optional(),
      })
      .optional(),
  }),
  why: z.string(),
  confidence: z.enum(["LOW", "MED", "HIGH"]),
  reasons: z.array(z.string()),
  patchPreview: z
    .object({
      summary: z.string(),
      horizonDays: z.number(),
      items: z.array(
        z.object({
          date: z.string(),
          title: z.string(),
          type: z.string(),
          change: z.enum(["KEEP", "ADAPT", "RECOVER", "REVIEW"]),
          before: z.string().nullable(),
          after: z.string().nullable(),
        })
      ),
    })
    .nullable()
    .optional(),
});

export async function readAdaptiveDayPlannerCache(
  userId: string,
  date: Date
): Promise<AdaptiveDayPlannerPayload | null> {
  const normalizedDate = normalizeDecisionDate(date);
  const cached = await db.todayDecision.findUnique({
    where: {
      userId_date: { userId, date: normalizedDate },
    },
  });

  if (!cached) return null;

  try {
    return adaptiveDayPlannerPayloadSchema.parse(JSON.parse(cached.payload));
  } catch {
    return null;
  }
}

export async function getAdaptiveDayPlannerCacheSnapshot(
  userId: string,
  date: Date
): Promise<{
  payload: AdaptiveDayPlannerPayload | null;
  stale: boolean;
  staleReason: AdaptiveDayPlannerStaleReason | null;
  changedAt: string | null;
}> {
  const normalizedDate = normalizeDecisionDate(date);
  const payload = await readAdaptiveDayPlannerCache(userId, normalizedDate);
  if (!payload?.generatedAt) {
    return {
      payload,
      stale: false,
      staleReason: null,
      changedAt: null,
    };
  }

  const horizonEnd = normalizeDecisionDate(normalizedDate);
  horizonEnd.setDate(horizonEnd.getDate() + ADAPTIVE_DAY_PLANNER_HORIZON_DAYS);

  const [checkIn, latestWorkout] = await Promise.all([
    db.dailyCheckIn.findUnique({
      where: { userId_date: { userId, date: normalizedDate } },
      select: { updatedAt: true },
    }),
    db.workout.findFirst({
      where: {
        userId,
        date: { gte: normalizedDate, lt: horizonEnd },
      },
      orderBy: { updatedAt: "desc" },
      select: { updatedAt: true },
    }),
  ]);

  const generatedAtMs = new Date(payload.generatedAt).getTime();
  const checkInUpdatedMs = checkIn?.updatedAt ? new Date(checkIn.updatedAt).getTime() : null;
  const workoutUpdatedMs = latestWorkout?.updatedAt ? new Date(latestWorkout.updatedAt).getTime() : null;

  const latestSource =
    typeof workoutUpdatedMs === "number" && typeof checkInUpdatedMs === "number"
      ? workoutUpdatedMs >= checkInUpdatedMs
        ? "WORKOUT_UPDATED"
        : "CHECKIN_UPDATED"
      : typeof workoutUpdatedMs === "number"
      ? "WORKOUT_UPDATED"
      : typeof checkInUpdatedMs === "number"
      ? "CHECKIN_UPDATED"
      : null;

  const latestChangedAtMs =
    latestSource === "WORKOUT_UPDATED"
      ? workoutUpdatedMs
      : latestSource === "CHECKIN_UPDATED"
      ? checkInUpdatedMs
      : null;

  const stale = typeof latestChangedAtMs === "number" && latestChangedAtMs > generatedAtMs;

  return {
    payload,
    stale,
    staleReason: stale ? latestSource : null,
    changedAt:
      stale && typeof latestChangedAtMs === "number" ? new Date(latestChangedAtMs).toISOString() : null,
  };
}

export async function invalidateAdaptiveDayPlannerCacheForDateRange(
  userId: string,
  startDate: Date,
  endDate: Date,
  options?: { horizonDays?: number }
): Promise<void> {
  const horizonDays = Math.max(1, options?.horizonDays ?? ADAPTIVE_DAY_PLANNER_HORIZON_DAYS);
  const normalizedStart = normalizeDecisionDate(startDate);
  const normalizedEnd = normalizeDecisionDate(endDate);
  const rangeStart = normalizedStart <= normalizedEnd ? normalizedStart : normalizedEnd;
  const rangeEnd = normalizedStart <= normalizedEnd ? normalizedEnd : normalizedStart;

  const affectedStart = new Date(rangeStart);
  affectedStart.setDate(affectedStart.getDate() - (horizonDays - 1));

  const affectedEndExclusive = new Date(rangeEnd);
  affectedEndExclusive.setDate(affectedEndExclusive.getDate() + 1);

  await db.todayDecision.deleteMany({
    where: {
      userId,
      date: {
        gte: affectedStart,
        lt: affectedEndExclusive,
      },
    },
  });
}

export async function invalidateAdaptiveDayPlannerCacheForWorkoutDate(
  userId: string,
  workoutDate: Date,
  options?: { horizonDays?: number }
): Promise<void> {
  await invalidateAdaptiveDayPlannerCacheForDateRange(userId, workoutDate, workoutDate, options);
}

export async function persistAdaptiveDayPlannerCache(
  userId: string,
  date: Date,
  payload: AdaptiveDayPlannerPayload
): Promise<AdaptiveDayPlannerPayload> {
  const stampedPayload: AdaptiveDayPlannerPayload = {
    ...payload,
    generatedAt: new Date().toISOString(),
  };

  await db.todayDecision.upsert({
    where: {
      userId_date: { userId, date },
    },
    create: {
      userId,
      date,
      payload: JSON.stringify(stampedPayload),
    },
    update: {
      payload: JSON.stringify(stampedPayload),
    },
  });

  return stampedPayload;
}
