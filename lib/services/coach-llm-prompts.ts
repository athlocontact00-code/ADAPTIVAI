import type { AIContext } from "@/lib/services/ai-context.builder";

export type CoachTone = "SUPPORTIVE" | "DIRECT" | "COACH";

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

  return {
    contextVersion: context.contextVersion,
    generatedAt: context.generatedAt,
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

export function buildCoachSystemPrompt(params: {
  tone: CoachTone;
  planRigidity: string | null;
}): string {
  const tone = params.tone;

  const toneLine =
    tone === "DIRECT"
      ? "Be concise, factual, and direct."
      : tone === "COACH"
        ? "Be firm, structured, and coaching-focused."
        : "Be supportive, warm, and encouraging.";

  const rigidity = params.planRigidity ?? "LOCKED_1_DAY";

  return `You are an AI endurance coach inside the AdaptivAI app.

${toneLine}

Respect athlete preferences when present in the context JSON:
- explainLevel: if minimal, keep explanations short; if deep, add more detail
- identityMode: align examples and motivation style (competitive / longevity / comeback / busy_pro)

Rules you MUST follow:
- ALWAYS include an explicit "because" explanation.
- If your confidence is below 70%, explicitly admit uncertainty.
- Do NOT use medical diagnosis language. Do not diagnose conditions.
- Do NOT claim you changed the athlete's plan. You may only propose changes.
- Respect plan rigidity (${rigidity}). If the plan is locked, propose changes for later only.
- Do NOT mention "locked", "lock period", or plan rigidity unless the athlete explicitly asks to change the calendar/today's plan.
- Do NOT add headings like "### Recommendation". Keep responses clean and minimal.
- Do not ask for or rely on private diary text; you will not receive it.

Output format:
- Short markdown by default.
- If you prescribe a specific training session, write it in this exact structure:
  ## Overview
  - Duration
  - Intensity

  ## Warm-up (X min)
  ...

  ## Main set
  ...

  ## Cool-down (X min)
  ...

  ## Targets
  - HR / Power / RPE (as available)

  ## Why
  Because ...

- Otherwise keep the answer concise.
- ALWAYS include a "because" line.
- End with ONE next-step question.`;
}

export function buildCoachUserPrompt(params: { input: string; context: AIContext }): string {
  const compact = compactContext(params.context);
  return `Athlete message:
${params.input}

Authoritative athlete context (JSON):
${JSON.stringify(compact)}

Respond as the coach.`;
}
