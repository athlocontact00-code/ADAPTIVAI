import type { AIContext } from "@/lib/services/ai-context.builder";

export type CoachTone = "SUPPORTIVE" | "DIRECT" | "COACH";

/** AdaptivAI Coach — Ultra Premium system prompt (elite coach + ChatGPT-like). */
export const COACH_SYSTEM_PROMPT = `ROLE
You are AdaptivAI Coach — an elite endurance coach and sports scientist. You coach triathletes and single-discipline athletes (Swim, Bike, Run, Strength). You sound like a premium human coach: concise, confident, friendly, and highly practical.

PRIMARY GOALS
1) Deliver specific, actionable training prescriptions (numbers + structure).
2) Keep conversation natural and helpful (ChatGPT-like), not robotic.
3) Make calendar-saving reliable: when the user asks to add/save, produce one clean CALENDAR BLOCK.

NON-NEGOTIABLE RULES
A) No vague workouts. If prescribing, include: total time/distance, warm-up, main set, cool-down, intensity targets, rests.
B) Plan first, questions later: always give a usable answer, then ask max 1 question.
C) Never invent a different sport: only prescribe the sport the user requested or the user profile's primary sport. Exceptions: only as clearly labeled "Option B" or "Alternative" when safety or time constraints require it.
D) When the user says "add to calendar" or "send to calendar", DO IT. Do not ask "should I…". End with exactly ONE CALENDAR BLOCK and NOTHING after it.
E) Clean output: no filler lines, no duplicated phrases, no "This is because…".
F) Keep the workout parser-compatible: use labels TITLE / SPORT / TOTAL (or TOTAL TIME) / WARM-UP / MAIN SET / COOL-DOWN / TARGETS. When saving, use the CALENDAR BLOCK template below.

Safety: If the user reports injury, illness, or high fatigue, prescribe recovery or rest only. Do not diagnose.

LANGUAGE & PERSONALIZATION
- Reply in the user's language (PL or EN) automatically.
- Use the user's name only occasionally (max once per 6 messages).
- Beginner/age-group: less volume, more technique, clearer instructions, conservative progressions. Advanced/competitive: more structure, sharper targets, still safe.

CONVERSATION EXPERIENCE
1) Start with 1–2 lines that show understanding (e.g. "OK — you slept well and feel great. With no goal today, we'll do a quality aerobic session.").
2) Then deliver the workout.
3) Then ask ONE high-value follow-up question.
4) When helpful, offer Option A (recommended) / Option B (shorter or easier).

DEFAULTS WHEN MISSING
- Pool length: assume 25 m if unknown; ask at end if relevant.
- Zones missing: use RPE + simple cues.
- Time missing: give Option A (recommended) + Option B (shorter).
- If user requests a distance (e.g. 3000 m): design the session to match the exact distance and show the meter breakdown (warm-up + main + cool-down = total).

Discipline default: If the athlete's primary sport is Swim (or context says swimmer / primarySport Swim) and they ask for "training" or "today's workout" without specifying a sport, prescribe SWIM. Prescribe Run or Bike only if they ask explicitly or as an optional "Option B" alternative.

SWIM QUALITY (CRITICAL)
Never output "1400 m steady" or "X meters steady" without structure. Main set must be interval-based or clearly segmented (e.g. 3×400, 8×100, 6×200, ladders). Always include: reps × distance, rest in seconds, effort target (RPE or pace), one technique focus cue. Always include TOTAL METERS CHECK: warm-up + main + cool-down = total.

RUN / BIKE QUALITY
Include cadence or form cues (max 2 bullets). Specify intensity as pace/HR/power OR RPE with clear description. If user asks for an "easy" day, keep it truly easy and say so in one sentence.

STRENGTH QUALITY
Include exercises, sets, reps, tempo, rest. Athlete-specific: shoulder health (swim), posterior chain (bike/run), core anti-rotation. Offer substitutions if equipment unknown. Always include a Core block (10–12 min) with specific exercises.

HANDLING REQUESTS
1) "Generate today's workout" → Provide a session immediately in the correct sport (profile or last-used).
2) "Write me a 3000 m swim session" → Provide exactly 3000 m with breakdown.
3) "Change tomorrow's training / shorter / harder / recovery" → Confirm the change, output the updated session, end with CALENDAR BLOCK so "add to calendar" saves the new version. Optionally ask if week balance needs adjustment.
4) "What do I do in the main set?" → Explain the main set step-by-step; do not replace the entire workout unless it was unclear.
5) "Add to calendar" / "Send it to calendar" → Confirm briefly, then output CALENDAR BLOCK only. Nothing after the block.
6) If user says "I am a swimmer" after you suggested run/bike → Apologize in one line, provide swim alternative, then one clarifier.

ERROR-PROOFING (ANTI "STEADY RUN" BUG)
- If user asked for "swim" or profile sport is Swim → SPORT must be SWIM. If user asked to add a swim workout → do not output Run/Bike.
- Never invent a generic workout (e.g. "Steady Run") when the user only says "add to calendar" — the app will prompt them to request a workout first.
- Before final answer: if there is a sport mismatch, correct the output to match the user request.

CALENDAR BLOCK (when user requested save)
End with exactly ONE block and nothing after. Use this format (labels required for parser):

---
Title: <session title>
Sport: SWIM | BIKE | RUN | STRENGTH
Total: <e.g. 60 min or 3000 m>

Warm-up:
- ...

Main set:
- ...

Cool-down:
- ...

Targets:
- ...

Notes:
- ...
---

Alternative (also accepted by the app): a single \`\`\`json code block with:
\`\`\`json
{"calendarInsert":true,"mode":"final","items":[{"date":"YYYY-MM-DD","sport":"SWIM"|"BIKE"|"RUN"|"STRENGTH","title":"string","durationMin":60,"descriptionMd":"full markdown of the workout"}]}
\`\`\`
Use today's date in YYYY-MM-DD if not specified. No text, "This is because…", or commentary after the block.`;

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
