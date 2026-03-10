import { formatAdaptivePlannerGeneratedAt } from "@/lib/product/adaptive-day-planner-ui";

export type TodayDecisionStaleReason = "CHECKIN_UPDATED" | "WORKOUT_UPDATED";

export function getTodayDecisionStaleBadgeCopy(reason: TodayDecisionStaleReason | null | undefined): string | null {
  if (reason === "CHECKIN_UPDATED") return "Check-in updated";
  if (reason === "WORKOUT_UPDATED") return "Plan changed";
  return "Needs refresh";
}

export function getTodayDecisionStaleMessage(reason: TodayDecisionStaleReason | null | undefined): string {
  if (reason === "CHECKIN_UPDATED") {
    return "New check-in saved after this recommendation.";
  }
  if (reason === "WORKOUT_UPDATED") {
    return "Workout changes may have made this recommendation outdated.";
  }
  return "This recommendation may be outdated.";
}

export function getTodayDecisionGeneratedLabel(params: {
  generatedAt?: string | null;
  cached?: boolean;
}): string | null {
  const time = formatAdaptivePlannerGeneratedAt(params.generatedAt);
  if (!time) return null;
  return `${params.cached ? "Cached" : "Updated"} ${time}`;
}

export function getTodayDecisionStaleDetail(params: {
  reason?: TodayDecisionStaleReason | null;
  changedAt?: string | null;
}): string {
  const base = getTodayDecisionStaleMessage(params.reason);
  const time = formatAdaptivePlannerGeneratedAt(params.changedAt);
  return time ? `${base} Latest change ${time}.` : base;
}
