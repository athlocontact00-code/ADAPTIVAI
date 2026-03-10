import type { AdaptiveDayPlannerPayload, AdaptivePlannerPatchItem } from "@/lib/services/adaptive-day-planner.service";

export type PremiumConflictSuggestion = {
  action: string;
  reason: string;
  newType?: string;
  newTitle?: string;
  durationFactor?: number;
  intensityFactor?: number;
  patch?: {
    date: string;
    change: AdaptivePlannerPatchItem["change"];
    title: string;
    type: string;
    durationMin?: number | null;
    tss?: number | null;
    before?: string | null;
    after?: string | null;
  };
};

const INTENSIVE_KEYWORDS = [
  "interval",
  "intervals",
  "tempo",
  "race",
  "brick",
  "threshold",
  "vo2max",
  "hard",
];

export function isAdaptivePlannerWorkoutIntense(workout: {
  type?: string | null;
  title?: string | null;
  tss?: number | null;
}): boolean {
  const matchesKeyword = (text: string | null | undefined) => {
    if (!text) return false;
    const normalized = text.toLowerCase();
    return INTENSIVE_KEYWORDS.some((keyword) => normalized.includes(keyword));
  };

  if (typeof workout.tss === "number" && workout.tss > 80) return true;
  if (matchesKeyword(workout.type)) return true;
  if (matchesKeyword(workout.title)) return true;
  return false;
}

export function derivePremiumConflictSignal(params: {
  readinessScore: number;
  fatigue: number;
  soreness: number;
  todayWorkout: {
    id: string;
    title: string;
    type: string;
    tss?: number | null;
  } | null;
  recentHardSessionsBeforeToday: number;
  maxHardSessionsPerWeek?: number;
}): boolean {
  if (!params.todayWorkout) return false;

  const intense = isAdaptivePlannerWorkoutIntense(params.todayWorkout);
  const hardSessionLimit = params.maxHardSessionsPerWeek ?? 3;
  const weeklyGuardrailExceeded = intense && params.recentHardSessionsBeforeToday >= hardSessionLimit;

  if (params.soreness > 70) return true;
  if (params.fatigue > 75) return true;
  if (intense && params.readinessScore < 70) return true;
  if (weeklyGuardrailExceeded) return true;

  return false;
}

export function parsePlannerAfterMetrics(after: string | null | undefined): {
  durationMin?: number | null;
  tss?: number | null;
} {
  const durationMatch = after?.match(/(\d+)\s*min/i);
  const tssMatch = after?.match(/(\d+)\s*TSS/i);

  return {
    durationMin: durationMatch ? Number(durationMatch[1]) : null,
    tss: tssMatch ? Number(tssMatch[1]) : null,
  };
}

export function mapPlannerPatchToConflictSuggestion(
  planner: AdaptiveDayPlannerPayload,
  workout: { title: string; type: string; durationMin?: number | null; tss?: number | null } | null
): PremiumConflictSuggestion | null {
  const item = planner.patchPreview?.items?.[0];
  if (!item || (planner.decision !== "ADAPT_SESSION" && planner.decision !== "RECOVER_AND_REPLAN")) {
    return null;
  }

  const parsedAfter = parsePlannerAfterMetrics(item.after);
  const durationFactor =
    typeof workout?.durationMin === "number" && typeof parsedAfter.durationMin === "number" && workout.durationMin > 0
      ? Number((parsedAfter.durationMin / workout.durationMin).toFixed(2))
      : undefined;
  const intensityFactor =
    typeof workout?.tss === "number" && typeof parsedAfter.tss === "number" && workout.tss > 0
      ? Number((parsedAfter.tss / workout.tss).toFixed(2))
      : undefined;

  let action = "reduce_intensity";
  if (item.change === "RECOVER") action = "swap_recovery";
  else if (item.change === "ADAPT" && item.type !== workout?.type) action = "swap_easy";
  else if (item.change === "ADAPT" && durationFactor && durationFactor < 0.95) action = "reduce_duration";

  return {
    action,
    reason: planner.why,
    newType: item.type !== workout?.type ? item.type : undefined,
    newTitle: item.title !== workout?.title ? item.title : undefined,
    durationFactor,
    intensityFactor,
    patch: {
      date: item.date,
      change: item.change,
      title: item.title,
      type: item.type,
      durationMin: parsedAfter.durationMin,
      tss: parsedAfter.tss,
      before: item.before,
      after: item.after,
    },
  };
}
