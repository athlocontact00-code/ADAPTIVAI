"use client";

export type DailyFlowStage =
  | "NO_PLAN"
  | "CHECKIN_REQUIRED"
  | "READY_TO_TRAIN"
  | "FEEDBACK_REQUIRED"
  | "DAY_COMPLETE";

export type DailyFlowIntent = "plan" | "checkin" | "start" | "feedback" | "review";

export function resolveDailyFlowStage(input: {
  hasPlannedWorkout: boolean;
  hasCompletedWorkout: boolean;
  requiresCheckIn: boolean;
  hasCheckIn: boolean;
  hasFeedbackPending: boolean;
}): DailyFlowStage {
  if (input.hasFeedbackPending) return "FEEDBACK_REQUIRED";
  if (input.hasPlannedWorkout && input.requiresCheckIn && !input.hasCheckIn) return "CHECKIN_REQUIRED";
  if (input.hasPlannedWorkout) return "READY_TO_TRAIN";
  if (input.hasCompletedWorkout) return "DAY_COMPLETE";
  return "NO_PLAN";
}

export function getDailyFlowCopy(
  stage: DailyFlowStage,
  options?: {
    workoutTitle?: string | null;
    checkInDecision?: string | null;
  }
): {
  badgeLabel: string;
  badgeVariant: "muted" | "warning" | "success" | "info";
  primaryIntent: DailyFlowIntent;
  title: string;
  subtitle: string;
  summary: string;
} {
  const workoutLabel = options?.workoutTitle?.trim() || "today's workout";
  const decision = options?.checkInDecision?.trim();

  switch (stage) {
    case "CHECKIN_REQUIRED":
      return {
        badgeLabel: "Check-in required",
        badgeVariant: "warning",
        primaryIntent: "checkin",
        title: "Complete your pre-training check-in.",
        subtitle: "Unlock the right session before you start training.",
        summary: `${workoutLabel} is waiting. A quick check-in helps AdaptivAI personalize today's work.`,
      };
    case "READY_TO_TRAIN":
      return {
        badgeLabel: "Ready",
        badgeVariant: "success",
        primaryIntent: "start",
        title: "Your workout is ready.",
        subtitle: decision ? `Coach decision: ${decision}` : "Open the session and start when you're ready.",
        summary: decision
          ? `${workoutLabel} has already been adapted based on today's signals.`
          : `${workoutLabel} is scheduled and ready to go.`,
      };
    case "FEEDBACK_REQUIRED":
      return {
        badgeLabel: "Feedback needed",
        badgeVariant: "info",
        primaryIntent: "feedback",
        title: "Close the loop with quick feedback.",
        subtitle: "A short post-workout note helps AdaptivAI calibrate the next sessions.",
        summary: `${workoutLabel} is done. Log how it felt before you move on.`,
      };
    case "DAY_COMPLETE":
      return {
        badgeLabel: "Day complete",
        badgeVariant: "success",
        primaryIntent: "review",
        title: "Today's work is logged.",
        subtitle: "Review the session or plan what comes next.",
        summary: `${workoutLabel} is complete and your daily loop is closed.`,
      };
    case "NO_PLAN":
    default:
      return {
        badgeLabel: "No plan",
        badgeVariant: "muted",
        primaryIntent: "plan",
        title: "Plan the next session.",
        subtitle: "Keep momentum by putting the next workout on the calendar.",
        summary: "No workout is scheduled yet for today.",
      };
  }
}
