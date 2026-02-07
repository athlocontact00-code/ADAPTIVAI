"use server";

import { Prisma } from "@prisma/client";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { parseDateToLocalNoon } from "@/lib/utils";
import type { CalendarInsertPayload } from "@/lib/schemas/coach-calendar-insert";

const AI_DRAFT_SOURCE = "AI_DRAFT";
const AI_FINAL_SOURCE = "AI";

/** Max age (ms) for undo: only allow undoing drafts created in the last 15 minutes. */
const UNDO_MAX_AGE_MS = 15 * 60 * 1000;

export type CoachCalendarSettings = {
  detailLevel: "minimal" | "detailed";
  autoAddToCalendar: "off" | "draft" | "final";
};

/**
 * Read coach calendar settings from profile preferences.
 * Defaults: detailLevel "detailed", autoAddToCalendar "draft".
 */
export async function getCoachCalendarSettings(): Promise<CoachCalendarSettings | null> {
  const session = await auth();
  if (!session?.user?.id) return null;

  const profile = await db.profile.findFirst({
    where: { userId: session.user.id },
    select: { preferences: true },
  });

  const prefs = (profile?.preferences as Record<string, unknown> | null) ?? {};
  const detailLevel = prefs.coachDetailLevel as string | undefined;
  const autoAddToCalendar = prefs.coachAutoAddToCalendar as string | undefined;

  return {
    detailLevel: detailLevel === "minimal" ? "minimal" : "detailed",
    autoAddToCalendar:
      autoAddToCalendar === "off"
        ? "off"
        : autoAddToCalendar === "final"
          ? "final"
          : "draft",
  };
}

/**
 * Update coach calendar settings in profile preferences.
 */
export async function updateCoachCalendarSettings(settings: Partial<CoachCalendarSettings>): Promise<{ success: boolean; error?: string }> {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: "Unauthorized" };

  const profile = await db.profile.findFirst({
    where: { userId: session.user.id },
    select: { id: true, preferences: true },
  });

  if (!profile) return { success: false, error: "Profile not found" };

  const prefs = (profile.preferences as Record<string, unknown> | null) ?? {};
  if (settings.detailLevel !== undefined) prefs.coachDetailLevel = settings.detailLevel;
  if (settings.autoAddToCalendar !== undefined) prefs.coachAutoAddToCalendar = settings.autoAddToCalendar;

  await db.profile.update({
    where: { id: profile.id },
    data: { preferences: prefs as Prisma.InputJsonValue },
  });
  return { success: true };
}

function mapSportToType(sport: string): string {
  const upper = sport.toUpperCase();
  if (upper === "SWIM") return "SWIM";
  if (upper === "BIKE") return "BIKE";
  if (upper === "RUN") return "RUN";
  if (upper === "STRENGTH") return "STRENGTH";
  return sport;
}

/**
 * Insert workouts from parsed calendar insert payload.
 * User setting autoAddToCalendar ("draft" | "final") overrides payload.mode when provided.
 * Returns created workout IDs for Undo (only when inserted as draft).
 */
export async function insertDraftWorkoutsFromCalendarJson(
  payload: CalendarInsertPayload,
  options?: { forceMode?: "draft" | "final" }
): Promise<{ success: boolean; createdIds: string[]; error?: string }> {
  const session = await auth();
  if (!session?.user?.id) return { success: false, createdIds: [], error: "Unauthorized" };

  const userId = session.user.id;
  const createdIds: string[] = [];
  const asDraft = options?.forceMode ? options.forceMode === "draft" : payload.mode === "draft";

  for (const item of payload.items) {
    const date = parseDateToLocalNoon(item.date);
    const type = mapSportToType(item.sport);
    const prescriptionJson =
      typeof item.prescriptionJson === "object" && item.prescriptionJson !== null
        ? JSON.stringify(item.prescriptionJson)
        : "{}";

    const created = await db.workout.create({
      data: {
        userId,
        title: item.title,
        type,
        date,
        durationMin: item.durationMin ?? 60,
        planned: true,
        completed: false,
        aiGenerated: true,
        source: asDraft ? AI_DRAFT_SOURCE : AI_FINAL_SOURCE,
        descriptionMd: item.descriptionMd ?? "",
        prescriptionJson,
      },
      select: { id: true },
    });
    createdIds.push(created.id);
  }

  return { success: true, createdIds };
}

/**
 * Undo: delete draft workouts that are AI_DRAFT and created recently.
 */
export async function undoDraftWorkouts(workoutIds: string[]): Promise<{ success: boolean; deleted: number; error?: string }> {
  const session = await auth();
  if (!session?.user?.id) return { success: false, deleted: 0, error: "Unauthorized" };

  if (workoutIds.length === 0) return { success: true, deleted: 0 };

  const cutoff = new Date(Date.now() - UNDO_MAX_AGE_MS);
  const deleted = await db.workout.deleteMany({
    where: {
      id: { in: workoutIds },
      userId: session.user.id,
      source: AI_DRAFT_SOURCE,
      createdAt: { gte: cutoff },
    },
  });

  return { success: true, deleted: deleted.count };
}

/**
 * Finalize a draft workout: set source from AI_DRAFT to AI. Keeps all content.
 */
export async function finalizeDraftWorkout(workoutId: string): Promise<{ success: boolean; error?: string }> {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: "Unauthorized" };

  const workout = await db.workout.findFirst({
    where: { id: workoutId, userId: session.user.id },
    select: { id: true, source: true },
  });

  if (!workout) return { success: false, error: "Workout not found" };
  if (workout.source !== AI_DRAFT_SOURCE) return { success: false, error: "Not a draft workout" };

  await db.workout.update({
    where: { id: workoutId },
    data: { source: AI_FINAL_SOURCE },
  });
  return { success: true };
}
