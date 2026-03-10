import type { AIContext } from "@/lib/services/ai-context.builder";

export type AdaptiveDayPlannerDecision =
  | "CHECK_IN_FIRST"
  | "DO_THIS_WORKOUT"
  | "ADAPT_SESSION"
  | "RECOVER_AND_REPLAN"
  | "PLAN_NEXT";

export type AdaptiveDayPlannerState =
  | "NO_PLAN"
  | "CHECK_IN_REQUIRED"
  | "READY"
  | "ADAPT"
  | "FEEDBACK_REQUIRED"
  | "COMPLETE";

export type AdaptivePlannerLink = {
  type: "workout" | "calendar_day" | "coach_chat";
  id?: string;
  date?: string;
};

export type AdaptivePlannerWorkout = {
  id: string;
  title: string;
  type: string;
  date: string;
  planned: boolean;
  completed: boolean;
  durationMin: number | null;
  tss: number | null;
};

export type AdaptivePlannerPatchItem = {
  date: string;
  title: string;
  type: string;
  change: "KEEP" | "ADAPT" | "RECOVER" | "REVIEW";
  before: string | null;
  after: string | null;
};

export type AdaptiveDayPlannerPayload = {
  decision: AdaptiveDayPlannerDecision;
  state: AdaptiveDayPlannerState;
  generatedAt?: string;
  action: {
    title: string;
    details: string;
    targets?: {
      discipline?: string;
      paceRange?: string;
      powerRange?: string;
      hrRange?: string;
      durationMin?: number;
    };
    link?: AdaptivePlannerLink;
  };
  why: string;
  confidence: "LOW" | "MED" | "HIGH";
  reasons: string[];
  patchPreview?: {
    summary: string;
    horizonDays: number;
    items: AdaptivePlannerPatchItem[];
  } | null;
};

type AdaptiveDayPlannerInput = {
  signals: AdaptiveDayPlannerSignals;
  decisionDate: string;
  todayWorkouts: AdaptivePlannerWorkout[];
  horizonWorkouts: AdaptivePlannerWorkout[];
  feedbackRequiredWorkout?: Pick<AdaptivePlannerWorkout, "id" | "title" | "type" | "date"> | null;
};

type AdaptiveDayPlannerContextInput = {
  context: AIContext;
  decisionDate: string;
  todayWorkouts: AdaptivePlannerWorkout[];
  horizonWorkouts: AdaptivePlannerWorkout[];
  feedbackRequiredWorkout?: Pick<AdaptivePlannerWorkout, "id" | "title" | "type" | "date"> | null;
};

export type AdaptiveDayPlannerSignals = {
  checkinRequired: boolean;
  readiness: number | null;
  hasConflict: boolean;
  activeInjury: boolean;
  hardFeedbackCount: number;
};

function isWorkoutIntense(workout: Pick<AdaptivePlannerWorkout, "title" | "type" | "tss">): boolean {
  const text = `${workout.title} ${workout.type}`.toLowerCase();
  if (typeof workout.tss === "number" && workout.tss >= 75) return true;
  return /(interval|tempo|threshold|vo2|race|brick|hard|quality)/.test(text);
}

function formatWorkoutLine(workout: Pick<AdaptivePlannerWorkout, "type" | "durationMin" | "tss">): string {
  const parts = [workout.type];
  if (typeof workout.durationMin === "number" && workout.durationMin > 0) parts.push(`${workout.durationMin} min`);
  if (typeof workout.tss === "number" && workout.tss > 0) parts.push(`${workout.tss} TSS`);
  return parts.join(" • ");
}

function lower(value: string | null | undefined): string {
  return String(value ?? "").toLowerCase();
}

function normalizeDiscipline(
  value: string | null | undefined
): "run" | "bike" | "swim" | "strength" | undefined {
  const normalized = lower(value);
  if (normalized.includes("run")) return "run";
  if (normalized.includes("bike") || normalized.includes("cycle")) return "bike";
  if (normalized.includes("swim")) return "swim";
  if (normalized.includes("strength")) return "strength";
  return undefined;
}

function hasActiveInjury(context: AIContext): boolean {
  return context.userProfile.activeInjuries.some((injury) => injury.status === "ACTIVE");
}

function primaryLink(input: {
  workout?: AdaptivePlannerWorkout | Pick<AdaptivePlannerWorkout, "id" | "date"> | null;
  fallbackDate: string;
}): AdaptivePlannerLink {
  if (input.workout?.id) {
    return { type: "workout", id: input.workout.id };
  }
  return { type: "calendar_day", date: input.fallbackDate };
}

export function buildAdaptiveDayPlanner(input: AdaptiveDayPlannerInput): AdaptiveDayPlannerPayload {
  const todayPlanned = input.todayWorkouts.find((workout) => workout.planned && !workout.completed) ?? null;
  const todayCompleted = input.todayWorkouts.find((workout) => workout.completed) ?? null;
  const next72h = input.horizonWorkouts.filter((workout) => workout.date >= input.decisionDate).slice(0, 3);
  const tomorrowWorkout =
    next72h.find((workout) => workout.date !== input.decisionDate && workout.planned && !workout.completed) ?? null;

  const { readiness, hasConflict, checkinRequired, activeInjury, hardFeedbackCount } = input.signals;
  const intensityPressure = todayPlanned ? isWorkoutIntense(todayPlanned) : false;
  const reasons: string[] = [];
  if (typeof readiness === "number") reasons.push(`Readiness ${readiness}/100`);
  if (checkinRequired) reasons.push("Pre-training check-in still required");
  if (hasConflict) reasons.push("Current plan conflicts with latest recovery signals");
  if (activeInjury) reasons.push("Active injury context is present");
  if (hardFeedbackCount >= 2) reasons.push("Recent feedback suggests the last sessions felt too hard");

  if (input.feedbackRequiredWorkout) {
    return {
      decision: "RECOVER_AND_REPLAN",
      state: "FEEDBACK_REQUIRED",
      action: {
        title: "Close the loop with feedback",
        details: "Before replanning the next sessions, log how the completed workout really felt.",
        link: { type: "workout", id: input.feedbackRequiredWorkout.id },
      },
      why: "The fastest way to improve the next recommendation is to record feedback from the latest completed session.",
      confidence: "HIGH",
      reasons,
      patchPreview: null,
    };
  }

  if (!todayPlanned && !todayCompleted && next72h.length === 0) {
    return {
      decision: "PLAN_NEXT",
      state: "NO_PLAN",
      action: {
        title: "Plan the next 72 hours",
        details: "There is no workout on deck. Generate the next sessions in Coach or add one to Calendar.",
        link: { type: "coach_chat" },
      },
      why: "Without a short-horizon plan, the system cannot adapt your day with confidence.",
      confidence: "LOW",
      reasons,
      patchPreview: null,
    };
  }

  if (checkinRequired && todayPlanned) {
    return {
      decision: "CHECK_IN_FIRST",
      state: "CHECK_IN_REQUIRED",
      action: {
        title: "Do the check-in first",
        details: "Unlock today's recommendation before committing to the session.",
        targets: {
          discipline: normalizeDiscipline(todayPlanned.type),
          durationMin: todayPlanned.durationMin ?? undefined,
        },
        link: primaryLink({ workout: todayPlanned, fallbackDate: input.decisionDate }),
      },
      why: "Today's session looks important enough that your readiness should be confirmed first.",
      confidence: "MED",
      reasons,
      patchPreview: {
        summary: "Planner is waiting for today's check-in before it adapts the next 72 hours.",
        horizonDays: 3,
        items: [
          {
            date: input.decisionDate,
            title: todayPlanned.title,
            type: todayPlanned.type,
            change: "REVIEW",
            before: formatWorkoutLine(todayPlanned),
            after: "Pending check-in result",
          },
        ],
      },
    };
  }

  if (todayPlanned && (hasConflict || activeInjury || (typeof readiness === "number" && readiness < 55) || (intensityPressure && hardFeedbackCount >= 2))) {
    const adaptedDuration =
      typeof todayPlanned.durationMin === "number" ? Math.max(20, Math.round(todayPlanned.durationMin * 0.75)) : 40;
    const adaptedTss = typeof todayPlanned.tss === "number" ? Math.max(20, Math.round(todayPlanned.tss * 0.7)) : null;
    const adaptedTitle = activeInjury ? "Recovery-focused alternative" : `${todayPlanned.title} (lighter)`;

    const patchItems: AdaptivePlannerPatchItem[] = [
      {
        date: input.decisionDate,
        title: adaptedTitle,
        type: activeInjury ? "recovery" : todayPlanned.type,
        change: activeInjury ? "RECOVER" : "ADAPT",
        before: formatWorkoutLine(todayPlanned),
        after: `${activeInjury ? "recovery" : todayPlanned.type} • ${adaptedDuration} min${adaptedTss ? ` • ${adaptedTss} TSS` : ""}`,
      },
    ];

    if (tomorrowWorkout) {
      patchItems.push({
        date: tomorrowWorkout.date,
        title: tomorrowWorkout.title,
        type: tomorrowWorkout.type,
        change: "REVIEW",
        before: formatWorkoutLine(tomorrowWorkout),
        after: "Keep under review after today's adaptation",
      });
    }

    return {
      decision: "ADAPT_SESSION",
      state: "ADAPT",
      action: {
        title: "Use the lighter version today",
        details: activeInjury
          ? "Today's signals suggest swapping the planned load for recovery work and re-checking the next sessions."
          : "A shorter, lighter session is the safest way to keep momentum without forcing the original load.",
        targets: {
          discipline: normalizeDiscipline(todayPlanned.type),
          durationMin: adaptedDuration,
        },
        link: primaryLink({ workout: todayPlanned, fallbackDate: input.decisionDate }),
      },
      why: activeInjury
        ? "The planner is protecting training continuity by reducing load while injury context is active."
        : "The planner sees more downside than upside in forcing the original session today.",
      confidence: typeof readiness === "number" && readiness < 45 ? "HIGH" : "MED",
      reasons,
      patchPreview: {
        summary: "Short-horizon replan for today and the next 72 hours.",
        horizonDays: 3,
        items: patchItems,
      },
    };
  }

  if (todayPlanned) {
    return {
      decision: "DO_THIS_WORKOUT",
      state: "READY",
      action: {
        title: "Today's session is ready",
        details: "Signals look stable enough to execute the planned workout.",
        targets: {
          discipline: normalizeDiscipline(todayPlanned.type),
          durationMin: todayPlanned.durationMin ?? undefined,
        },
        link: primaryLink({ workout: todayPlanned, fallbackDate: input.decisionDate }),
      },
      why: "No short-horizon adjustment is strong enough to justify changing the plan today.",
      confidence: typeof readiness === "number" && readiness >= 70 ? "HIGH" : "MED",
      reasons,
      patchPreview: {
        summary: "The current plan stays intact for today.",
        horizonDays: 3,
        items: [
          {
            date: input.decisionDate,
            title: todayPlanned.title,
            type: todayPlanned.type,
            change: "KEEP",
            before: formatWorkoutLine(todayPlanned),
            after: formatWorkoutLine(todayPlanned),
          },
        ],
      },
    };
  }

  if (todayCompleted || tomorrowWorkout) {
    return {
      decision: "PLAN_NEXT",
      state: todayCompleted ? "COMPLETE" : "READY",
      action: {
        title: tomorrowWorkout ? "Review the next session" : "Review your next step",
        details: tomorrowWorkout
          ? "Today's work is done. Use the next session in the 72-hour window as your planning anchor."
          : "Today's loop is closed. Open Calendar to shape the next block.",
        link: tomorrowWorkout
          ? primaryLink({ workout: tomorrowWorkout, fallbackDate: tomorrowWorkout.date })
          : { type: "calendar_day", date: input.decisionDate },
      },
      why: "The planner is shifting from execution mode to short-horizon planning mode.",
      confidence: "MED",
      reasons,
      patchPreview: tomorrowWorkout
        ? {
            summary: "Next actionable session inside the 72-hour window.",
            horizonDays: 3,
            items: [
              {
                date: tomorrowWorkout.date,
                title: tomorrowWorkout.title,
                type: tomorrowWorkout.type,
                change: "REVIEW",
                before: formatWorkoutLine(tomorrowWorkout),
                after: "Ready for review in Calendar",
              },
            ],
          }
        : null,
    };
  }

  return {
    decision: "PLAN_NEXT",
    state: "NO_PLAN",
    action: {
      title: "Plan the next session",
      details: "Open Coach or Calendar to create the next workout block.",
      link: { type: "coach_chat" },
    },
    why: "The planner needs a concrete next session before it can adapt the day.",
    confidence: "LOW",
    reasons,
    patchPreview: null,
  };
}

function extractSignalsFromContext(context: AIContext): AdaptiveDayPlannerSignals {
  return {
    checkinRequired: context.todayCheckin.status === "required",
    readiness: context.todayCheckin.data?.readinessScore ?? null,
    hasConflict: Boolean(context.todayCheckin.data?.hasConflict),
    activeInjury: hasActiveInjury(context),
    hardFeedbackCount:
      (context.recentSignals.feedbackPatterns14d.perceivedDifficultyCounts.HARD ?? 0) +
      (context.recentSignals.feedbackPatterns14d.perceivedDifficultyCounts.BRUTAL ?? 0),
  };
}

export function buildAdaptiveDayPlannerFromContext(input: AdaptiveDayPlannerContextInput): AdaptiveDayPlannerPayload {
  const todayPlanned = input.todayWorkouts.find((workout) => workout.planned && !workout.completed) ?? null;
  return buildAdaptiveDayPlanner({
    signals: extractSignalsFromContext(input.context),
    decisionDate: input.decisionDate,
    todayWorkouts: input.todayWorkouts,
    horizonWorkouts: input.horizonWorkouts,
    feedbackRequiredWorkout: input.feedbackRequiredWorkout,
  });
}
