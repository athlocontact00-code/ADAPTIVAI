import type { AIContext } from "@/lib/services/ai-context.builder";

export type CoachTone = "SUPPORTIVE" | "DIRECT" | "COACH";

/** Jedyny system prompt AI coacha. Do rozbudowy od zera. */
export const COACH_SYSTEM_PROMPT = `You are an endurance coach. When the user asks for training, return a detailed session (swim, bike, run, or strength) with numbers: duration, warm-up, main set, cool-down, intensity (RPE or zones).

Safety: If the user reports injury, illness, or high fatigue, prescribe recovery or rest only. Do not diagnose.

When data is missing, use safe defaults (e.g. 45–60 min, easy–moderate).

When the user asks to add the workout to the calendar (e.g. "add to calendar", "send it to calendar"), your reply must end with a single \`\`\`json code block with this exact shape (no other text after the block):
\`\`\`json
{"calendarInsert":true,"mode":"final","items":[{"date":"YYYY-MM-DD","sport":"SWIM"|"BIKE"|"RUN"|"STRENGTH","title":"string","durationMin":60,"descriptionMd":"full markdown workout text"}]}
\`\`\`
Use today's date in YYYY-MM-DD if not specified. No "This is because..." or extra commentary after the JSON block.`;

export function getCoachToneFromPreference(pref: string | null): CoachTone {
  if (pref === "SUPPORTIVE" || pref === "DIRECT" || pref === "COACH") return pref;
  return "SUPPORTIVE";
}

function compactContext(context: AIContext) {
  const truncate = (s: string | null, max = 280): string | null => {
    if (typeof s !== "string") return null;
    const t = s.trim();
    if (t.length <= max) return t;
    return `${t.slice(0, max)}…`;
  };

  const checkIns = context.recentSignals.checkIns7d.items;
  const readiness = checkIns.map((c) => c.readinessScore).filter((n): n is number => typeof n === "number");

  const avgReadiness = readiness.length > 0 ? Math.round(readiness.reduce((a, b) => a + b, 0) / readiness.length) : null;

  const prefs = (context.userProfile.preferences as Record<string, unknown> | null) ?? {};
  const avail = (context.userProfile.availability as Record<string, unknown> | null) ?? {};
  const guard = (context.userProfile.guardrails as Record<string, unknown> | null) ?? {};
  const trainingDNA = {
    primarySport: context.userProfile.sportPrimary ?? null,
    experienceLevel: context.userProfile.experienceLevel ?? null,
    swimLevel: context.userProfile.swimLevel ?? (prefs.swimLevel as string | undefined) ?? null,
    constraints: {
      time: context.userProfile.availabilityNotes ?? (avail.preferredTime as string | undefined) ?? (avail.maxMinutesPerDay != null ? `max ${avail.maxMinutesPerDay} min/day` : null) ?? null,
      facility: context.userProfile.equipmentNotes ?? null,
      equipment: context.userProfile.equipmentNotes ?? null,
      poolLengthM: context.userProfile.swimPoolLengthM ?? null,
    },
    injuryRisk: (guard.injuryAreas as string | undefined) ?? (guard.avoid as string | undefined) ?? (prefs.notes as string | undefined) ?? null,
    preference: {
      timeOfDay: (avail.preferredTime as string | undefined) ?? null,
      poolLength: context.userProfile.swimPoolLengthM ?? null,
      likes: (prefs as { preferredSessionTypes?: string[] }).preferredSessionTypes ?? null,
      dislikes: (prefs as { avoidedSessionTypes?: string[] }).avoidedSessionTypes ?? null,
    },
    level: context.userProfile.experienceLevel ?? (prefs.swimLevel as string | undefined) ?? null,
  };

  return {
    contextVersion: context.contextVersion,
    generatedAt: context.generatedAt,
    trainingDNA,
    userProfile: {
      ...context.userProfile,
      equipmentNotes: truncate(context.userProfile.equipmentNotes),
      terrainNotes: truncate(context.userProfile.terrainNotes),
      availabilityNotes: truncate(context.userProfile.availabilityNotes),
    },
    zones: context.zones,
    pbs: context.pbs.slice(0, 10),
    goals: context.goals,
    planSummary: context.planSummary,
    todayCheckin: context.todayCheckin,
    recentSignals: {
      checkIns7d: {
        window: context.recentSignals.checkIns7d.window,
        count: checkIns.length,
        avgReadiness,
        latest: checkIns.length > 0 ? checkIns[checkIns.length - 1] : null,
      },
      feedbackPatterns14d: context.recentSignals.feedbackPatterns14d,
      diarySignals7d: {
        window: context.recentSignals.diarySignals7d.window,
        includedCount: context.recentSignals.diarySignals7d.includedCount,
        excludedHiddenCount: context.recentSignals.diarySignals7d.excludedHiddenCount,
        items: context.recentSignals.diarySignals7d.items.slice(-3),
      },
      metrics14d: context.recentSignals.metrics14d,
    },
    recentTraining: context.recentTraining,
    privacySummary: context.privacySummary,
  };
}

/** System prompt (params kept for API; ignored until guided mode is rebuilt). */
export function buildCoachSystemPrompt(_params: {
  tone: CoachTone;
  planRigidity: string | null;
  coachDetailLevel?: "minimal" | "detailed";
}): string {
  return COACH_SYSTEM_PROMPT;
}

/** Returns system prompt (always minimal until guided mode is rebuilt). */
export function getEffectiveCoachSystemPrompt(params: Parameters<typeof buildCoachSystemPrompt>[0]): string {
  return buildCoachSystemPrompt(params);
}

export function buildCoachUserPrompt(params: { input: string; context: AIContext }): string {
  const compact = compactContext(params.context);
  return `Athlete message:
${params.input}

Context (JSON):
${JSON.stringify(compact)}

Respond as the coach.`;
}
