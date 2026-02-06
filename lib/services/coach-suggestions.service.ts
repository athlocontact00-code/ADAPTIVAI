import { db } from "@/lib/db";
import { addDays, formatLocalDateInput, startOfWeek } from "@/lib/utils";
import { parseAISuggestionsResponse } from "@/lib/schemas/coach-suggestion";
import {
  getAthleteContextForAI,
  deriveRunTrainingPaces,
  deriveSwimPaces,
  deriveBikeTargets,
} from "@/lib/services/athlete-context";

const SUGGESTION_PROMPT = `You are an expert endurance coach. Generate training suggestions based on the athlete's data.

athleteContext (if present) includes: heartRateZones (zone1–zone5 min/max), runPaces (easy/tempo/threshold/vo2), swimPaces, bikeTargets (power zones from FTP). Also identity (club, location, timezone, birthYear), availability (daysAvailable, maxMinutesPerDay, preferredTime, restDaysPreference, atLeastOneRestDayPerWeek), preferences (trainingStyle, hardSessionsPerWeek, surfacePreference, swimPreference, notes), guardrails (maxIntensityWhenFatigueHigh, neverTwoHardRunDaysInRow, limitWeeklyRampRatePercent). Use these for target intensities and personalization when suggesting adjustments.

RULES:
- Return ONLY valid JSON, no markdown or extra text.
- Maximum 3-5 suggestions.
- Each suggestion MUST have: scope, type, title, summary, why, payload.
- "why" must be specific: data → conclusion → recommended change.
- If data is insufficient, return empty array [].
- Do NOT invent workouts or dates that don't exist in the context.

SCOPE: "today" | "week" | "season"
TYPE: ADJUST_INTENSITY | SWAP_SESSION | ADD_RECOVERY | REBALANCE_WEEK | REDUCE_VOLUME | MOVE_SESSION | ADD_EASY_SESSION

PAYLOAD SHAPES (use exact "kind"):
- adjustWorkout: { kind: "adjustWorkout", workoutId: string, intensityDeltaPct: number, volumeDeltaPct?: number, notes?: string }
- swapWorkouts: { kind: "swapWorkouts", fromWorkoutId: string, toDate: "YYYY-MM-DD", replacementWorkoutTemplate?: { type, durationMin, title? } }
- moveWorkout: { kind: "moveWorkout", workoutId: string, toDate: "YYYY-MM-DD" }
- addRecoveryDay: { kind: "addRecoveryDay", date: "YYYY-MM-DD", replacement: "rest"|"walk"|"easy_spin", durationMin?: number }
- rebalanceWeek: { kind: "rebalanceWeek", rules?: string[], changes?: [{ workoutId, patch }] }

LOGIC:
- Low readiness → ADJUST_INTENSITY (reduce) or SWAP_SESSION to easy.
- Low compliance → REDUCE_VOLUME, shorter sessions.
- Load spike → ADD_RECOVERY.
- Triathlon balance → REBALANCE_WEEK (more swim/bike/run distribution).
- workoutId and toDate must exist in context.`;

export type CoachSuggestionsContext = {
  contextDate: string;
  todayWorkouts: Array<{ id: string; title: string; type: string; durationMin: number | null; tss: number | null; date: string }>;
  weekWorkouts: Array<{ id: string; title: string; type: string; durationMin: number | null; tss: number | null; date: string; completed: boolean }>;
  readiness: number | null;
  atl: number | null;
  ctl: number | null;
  compliancePercent: number;
  plannedCount: number;
  completedCount: number;
  weekPlannedHours: number;
  weekPlannedTss: number;
  lastCheckIn: { date: string; readinessScore: number | null; recommendation: string | null } | null;
  season: { name: string; activeBlock: { type: string; focus: string | null } | null } | null;
  sport: string;
  weeklyHoursGoal: number;
  athleteContext?: {
    heartRateZones: Record<string, { min: number | null; max: number | null }>;
    runPaces: Record<string, string>;
    swimPaces: Record<string, string>;
    bikeTargets: Record<string, string>;
    planRigidity: string | null;
    identity?: { club: string | null; location: string | null; timezone: string | null; birthYear: number | null };
    availability?: { notes?: string | null; daysAvailable?: number[]; maxMinutesPerDay?: number; preferredTime?: string; restDaysPreference?: number; atLeastOneRestDayPerWeek?: boolean };
    preferences?: { trainingStyle?: string; hardSessionsPerWeek?: number; surfacePreference?: string[]; swimPreference?: string; notes?: string };
    guardrails?: { maxIntensityWhenFatigueHigh?: boolean; neverTwoHardRunDaysInRow?: boolean; limitWeeklyRampRatePercent?: number };
  };
};

export async function buildCoachSuggestionsContext(userId: string, contextDateStr?: string): Promise<CoachSuggestionsContext | null> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const contextDate = contextDateStr ? new Date(contextDateStr) : today;
  contextDate.setHours(0, 0, 0, 0);
  const contextDateEnd = addDays(contextDate, 1);
  const weekStart = startOfWeek(contextDate);
  const weekEnd = addDays(weekStart, 7);

  const [todayWorkouts, weekWorkouts, lastCheckIn, latestMetric, profile, activeSeason] = await Promise.all([
    db.workout.findMany({
      where: { userId, date: { gte: contextDate, lt: contextDateEnd } },
    }),
    db.workout.findMany({
      where: { userId, date: { gte: weekStart, lt: weekEnd }, planned: true },
    }),
    db.dailyCheckIn.findFirst({
      where: { userId },
      orderBy: { date: "desc" },
      select: { date: true, readinessScore: true, recommendation: true },
    }),
    db.metricDaily.findFirst({
      where: { userId },
      orderBy: { date: "desc" },
    }),
    db.profile.findUnique({ where: { userId } }),
    db.season.findFirst({
      where: { userId, startDate: { lte: contextDate }, endDate: { gte: contextDate } },
      include: {
        trainingBlocks: {
          where: {
            startDate: { lte: contextDate },
            endDate: { gte: contextDate },
          },
          take: 1,
        },
      },
    }),
  ]);

  const plannedCount = weekWorkouts.length;
  const completedCount = weekWorkouts.filter((w) => w.completed).length;
  const compliancePercent = plannedCount > 0 ? Math.round((completedCount / plannedCount) * 100) : 0;
  const weekPlannedHours = weekWorkouts.reduce((s, w) => s + (w.durationMin || 0) / 60, 0);
  const weekPlannedTss = weekWorkouts.reduce((s, w) => s + (w.tss || 0), 0);

  const metric = latestMetric as { readinessScore?: number | null; atl?: number | null; ctl?: number | null } | null;

  const athleteCtx = await getAthleteContextForAI(userId);
  const runPaces = deriveRunTrainingPaces(athleteCtx);
  const swimPaces = deriveSwimPaces(athleteCtx);
  const bikeTargets = deriveBikeTargets(athleteCtx);

  return {
    contextDate: formatLocalDateInput(contextDate),
    todayWorkouts: todayWorkouts.map((w) => ({
      id: w.id,
      title: w.title,
      type: w.type,
      durationMin: w.durationMin,
      tss: w.tss,
      date: formatLocalDateInput(w.date),
    })),
    weekWorkouts: weekWorkouts.map((w) => ({
      id: w.id,
      title: w.title,
      type: w.type,
      durationMin: w.durationMin,
      tss: w.tss,
      date: formatLocalDateInput(w.date),
      completed: w.completed,
    })),
    readiness: metric?.readinessScore ?? null,
    atl: metric?.atl ?? null,
    ctl: metric?.ctl ?? null,
    compliancePercent,
    plannedCount,
    completedCount,
    weekPlannedHours: Math.round(weekPlannedHours * 10) / 10,
    weekPlannedTss: Math.round(weekPlannedTss),
    lastCheckIn: lastCheckIn
      ? {
          date: formatLocalDateInput(lastCheckIn.date),
          readinessScore: lastCheckIn.readinessScore,
          recommendation: lastCheckIn.recommendation,
        }
      : null,
    season: activeSeason
      ? {
          name: activeSeason.name,
          activeBlock:
            activeSeason.trainingBlocks[0] != null
              ? { type: activeSeason.trainingBlocks[0].type, focus: activeSeason.trainingBlocks[0].focus }
              : null,
        }
      : null,
    sport: profile?.sportPrimary ?? "triathlon",
    weeklyHoursGoal: profile?.weeklyHoursGoal ?? 5,
    athleteContext: athleteCtx
      ? {
          heartRateZones: {
            zone1: athleteCtx.heartRateZones.zone1,
            zone2: athleteCtx.heartRateZones.zone2,
            zone3: athleteCtx.heartRateZones.zone3,
            zone4: athleteCtx.heartRateZones.zone4,
            zone5: athleteCtx.heartRateZones.zone5,
          },
          runPaces: runPaces as Record<string, string>,
          swimPaces: swimPaces as Record<string, string>,
          bikeTargets: bikeTargets as Record<string, string>,
          planRigidity: athleteCtx.aiSettings.planRigidity,
          ...(athleteCtx.identity && { identity: athleteCtx.identity }),
          ...(athleteCtx.availability && { availability: athleteCtx.availability }),
          ...(athleteCtx.preferences && { preferences: athleteCtx.preferences }),
          ...(athleteCtx.guardrails && { guardrails: athleteCtx.guardrails }),
        }
      : undefined,
  };
}

export function isOpenAIAvailable(): boolean {
  const key = process.env.OPENAI_API_KEY;
  return !!key && key.length > 10;
}

export async function generateCoachSuggestions(
  userId: string,
  contextDate?: string,
  force = false
): Promise<{ ok: boolean; count: number; error?: string }> {
  const ctx = await buildCoachSuggestionsContext(userId, contextDate);
  if (!ctx) return { ok: false, count: 0, error: "Failed to build context" };

  const hasData = ctx.todayWorkouts.length > 0 || ctx.weekWorkouts.length > 0;
  if (!hasData) return { ok: true, count: 0 };

  if (!force) {
    const existing = await db.coachSuggestion.count({
      where: {
        userId,
        contextDate: contextDate ? new Date(contextDate) : new Date(new Date().setHours(0, 0, 0, 0)),
        status: "PENDING",
      },
    });
    if (existing > 0) return { ok: true, count: existing };
  }

  if (!isOpenAIAvailable()) return { ok: false, count: 0, error: "OpenAI not configured" };

  const key = process.env.OPENAI_API_KEY!;
  const contextJson = JSON.stringify(ctx, null, 2);
  const prompt = `${SUGGESTION_PROMPT}\n\nContext (JSON):\n${contextJson}\n\nReturn JSON: { "suggestions": [...] }`;

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: "gpt-4.1",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 1500,
        temperature: 0.5,
        response_format: { type: "json_object" },
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error("[CoachSuggestions] OpenAI error:", res.status, err);
      return { ok: false, count: 0, error: `OpenAI API error: ${res.status}` };
    }

    const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const raw = data.choices?.[0]?.message?.content;
    if (!raw) return { ok: false, count: 0, error: "Empty AI response" };

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      console.error("[CoachSuggestions] Invalid JSON from AI:", raw.slice(0, 200));
      return { ok: false, count: 0, error: "Invalid AI response format" };
    }

    const suggestions = parseAISuggestionsResponse(parsed);
    if (suggestions.length === 0) return { ok: true, count: 0 };

    const contextDateVal = contextDate ? new Date(contextDate) : new Date(new Date().setHours(0, 0, 0, 0));
    contextDateVal.setHours(0, 0, 0, 0);

    await db.coachSuggestion.createMany({
      data: suggestions.map((s) => ({
        userId,
        contextDate: contextDateVal,
        scope: s.scope,
        type: s.type,
        title: s.title,
        summary: s.summary,
        why: s.why,
        payload: JSON.stringify(s.payload),
        status: "PENDING",
      })),
    });

    return { ok: true, count: suggestions.length };
  } catch (e) {
    console.error("[CoachSuggestions] Generate error:", e);
    return { ok: false, count: 0, error: e instanceof Error ? e.message : "Unknown error" };
  }
}
