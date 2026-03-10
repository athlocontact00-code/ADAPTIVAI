export type CoachTodayWorkoutListItem = {
  title: string;
  type: string;
  durationMin: number | null;
  planned: boolean;
  completed: boolean;
};

export function formatCoachWorkoutLine(w: CoachTodayWorkoutListItem): string {
  const dur = typeof w.durationMin === "number" && w.durationMin > 0 ? `${w.durationMin} min` : "—";
  const status = w.completed ? "completed" : w.planned ? "planned" : "";
  const suffix = status ? ` _(${status})_` : "";
  return `- **${w.title}** (${w.type}, ${dur})${suffix}`;
}

export function buildTodayWorkoutsResponse(params: {
  workouts: CoachTodayWorkoutListItem[];
  date: Date;
}): { text: string; confidence: number } {
  const lines = params.workouts.map((w) => formatCoachWorkoutLine(w));
  const dateLabel = params.date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

  const text =
    lines.length > 0
      ? `## Today's workouts (${dateLabel})\n\n${lines.join("\n")}\n\nNext step: tell me how you slept and how your legs feel (fresh / heavy / sore).`
      : `## Today's workouts (${dateLabel})\n\nNo workouts scheduled for today.\n\nNext step: tell me your goal for today (and how you slept + how your legs feel).`;

  return { text, confidence: 90 };
}

export function buildSevenDayPlanResponse(params: {
  success: boolean;
  summaryMd?: string | null;
  error?: string | null;
}):
  | { ok: true; text: string; confidence: number }
  | { ok: false; error: string } {
  if (!params.success || !params.summaryMd) {
    return {
      ok: false,
      error: params.error || "Failed to generate training plan",
    };
  }

  return {
    ok: true,
    text: `${params.summaryMd}\n`,
    confidence: 85,
  };
}
