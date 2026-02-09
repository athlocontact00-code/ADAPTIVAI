/**
 * AI Coach Brain — unified entry point for generate + adapt + save.
 * Enforces workout quality rubric, readiness adaptation, guardrails, idempotent save.
 * No new UI; used by coach-chat and calendar insertion.
 */

import { createHash } from "crypto";
import { db } from "@/lib/db";
import { addDays, startOfDay, parseDateToLocalNoon } from "@/lib/utils";
import { buildAIContextForUser } from "@/lib/services/ai-context.builder";
import { getAIMemorySummary } from "@/lib/services/ai-memory.service";
import {
  getLoadMetrics,
  calculateWeeklyLoad,
  checkGuardrails,
  DEFAULT_RAMP_THRESHOLD,
  type PlannedWorkout as GuardrailPlannedWorkout,
} from "@/lib/services/guardrails.service";
import type { AIContext } from "@/lib/services/ai-context.builder";
import type {
  WorkoutRubricPrescription,
  SessionIntent,
  RubricSport,
  RubricStep,
  WhyDrivers,
} from "@/lib/schemas/coach-rubric";
import { logError, logInfo } from "@/lib/logger";

const MAX_HARD_SESSIONS_PER_WEEK = 2;
const RAMP_THRESHOLD = DEFAULT_RAMP_THRESHOLD;

export type CoachBrainContext = {
  aiContext: AIContext;
  /** When true, strength prescription is mobility/prehab only (e.g. user reported shoulder pain). */
  strengthMobilityOnly?: boolean;
  recentWorkouts: Array<{
    id: string;
    date: Date;
    type: string;
    title: string;
    durationMin: number | null;
    tss: number | null;
    planned: boolean;
    completed: boolean;
  }>;
  plannedWorkoutsThisWeek: Array<{ date: Date; type: string; durationMin: number; intensity?: string }>;
  loadMetrics: { currentWeekLoad: number; previousWeekLoad: number; rampRate: number | null; status: string };
  hardSessionsThisWeek: number;
  aimemorySummary: Awaited<ReturnType<typeof getAIMemorySummary>>;
};

/**
 * Load full context for coach decisions (deterministic, logged).
 */
export async function loadCoachContext(userId: string): Promise<CoachBrainContext | null> {
  const [aiContext, aimemorySummary] = await Promise.all([
    buildAIContextForUser(userId),
    getAIMemorySummary(userId),
  ]);

  const now = new Date();
  const start28 = addDays(now, -28);
  const start14 = addDays(now, -14);
  const weekStart = startOfDay(now);
  weekStart.setDate(weekStart.getDate() - weekStart.getDay() + (weekStart.getDay() === 0 ? -6 : 1));
  const weekEnd = addDays(weekStart, 7);
  const prevWeekStart = addDays(weekStart, -7);

  const [recentWorkouts, plannedThisWeek, prevWeekWorkouts] = await Promise.all([
    db.workout.findMany({
      where: { userId, date: { gte: start14 } },
      orderBy: { date: "desc" },
      select: {
        id: true,
        date: true,
        type: true,
        title: true,
        durationMin: true,
        tss: true,
        planned: true,
        completed: true,
      },
    }),
    db.workout.findMany({
      where: {
        userId,
        date: { gte: weekStart, lt: weekEnd },
        planned: true,
      },
      orderBy: { date: "asc" },
      select: { date: true, type: true, durationMin: true, title: true },
    }),
    db.workout.findMany({
      where: {
        userId,
        date: { gte: prevWeekStart, lt: weekStart },
      },
      select: { durationMin: true, tss: true },
    }),
  ]);

  const currentWeekWorkouts = recentWorkouts.filter(
    (w) => w.date >= weekStart && w.date < weekEnd
  );
  const previousWeekLoad = calculateWeeklyLoad(
    prevWeekWorkouts.map((w) => ({ tss: w.tss, durationMin: w.durationMin }))
  );
  const loadMetrics = getLoadMetrics(
    currentWeekWorkouts.map((w) => ({ tss: w.tss, durationMin: w.durationMin })),
    prevWeekWorkouts.map((w) => ({ tss: w.tss, durationMin: w.durationMin })),
    RAMP_THRESHOLD
  );

  const hardKeywords = ["interval", "vo2", "threshold", "tempo", "hard", "quality"];
  const hardSessionsThisWeek = plannedThisWeek.filter((w) =>
    hardKeywords.some((k) => w.title?.toLowerCase().includes(k) || w.type?.toLowerCase().includes(k))
  ).length;

  return {
    aiContext,
    recentWorkouts: recentWorkouts.map((w) => ({
      id: w.id,
      date: w.date,
      type: w.type,
      title: w.title,
      durationMin: w.durationMin,
      tss: w.tss,
      planned: w.planned,
      completed: w.completed,
    })),
    plannedWorkoutsThisWeek: plannedThisWeek.map((w) => ({
      date: w.date,
      type: w.type,
      durationMin: w.durationMin ?? 0,
      intensity: hardKeywords.some((k) => (w.title ?? "").toLowerCase().includes(k)) ? "hard" : "easy",
    })),
    loadMetrics: {
      currentWeekLoad: loadMetrics.currentWeekLoad,
      previousWeekLoad: loadMetrics.previousWeekLoad,
      rampRate: loadMetrics.rampRate,
      status: loadMetrics.status,
    },
    hardSessionsThisWeek,
    aimemorySummary,
  };
}

/**
 * Resolve session intent from user message (sport, date, addToCalendar, createSeparate).
 */
export function resolveSessionIntent(
  message: string,
  context: CoachBrainContext
): SessionIntent | null {
  const lower = message.trim().toLowerCase();
  const todayStr = context.aiContext.planSummary.today;

  const noCalendar = /\b(do not add|don't add|don't save|skip calendar|no calendar)\b/i.test(lower);
  const createSeparate = /\b(separate|another|additional|extra)\s+(session|workout)\b/i.test(lower);

  let sport: RubricSport | undefined;
  if (/\b(run|running|bieg|bieganie)\b/.test(lower)) sport = "RUN";
  else if (/\b(bike|cycling|rower|ride)\b/.test(lower)) sport = "BIKE";
  else if (/\b(swim|swimming|pływanie|plywanie)\b/.test(lower)) sport = "SWIM";
  else if (/\b(strength|gym|weights|siłownia|silownia)\b/.test(lower)) sport = "STRENGTH";

  let dateStr: string | undefined;
  const isoMatch = message.match(/\b(\d{4}-\d{2}-\d{2})\b/);
  if (isoMatch) dateStr = isoMatch[1];
  else if (/\b(tomorrow|jutro)\b/.test(lower)) {
    const d = parseDateToLocalNoon(todayStr);
    d.setDate(d.getDate() + 1);
    dateStr = d.toISOString().slice(0, 10);
  } else if (/\b(today|dzisiaj|dzis)\b/.test(lower)) dateStr = todayStr;
  else if (/\b(in|za)\s*(\d{1,2})\s*(days|dni)\b/i.test(lower)) {
    const n = parseInt(lower.match(/(?:in|za)\s*(\d{1,2})/)?.[1] ?? "0", 10);
    if (n >= 0 && n <= 30) {
      const d = parseDateToLocalNoon(todayStr);
      d.setDate(d.getDate() + n);
      dateStr = d.toISOString().slice(0, 10);
    }
  }
  if (!dateStr) dateStr = todayStr;

  const durationMatch = lower.match(/(\d{1,3})\s*min(?:ute)?s?/);
  const durationMinHint = durationMatch ? parseInt(durationMatch[1], 10) : undefined;

  const metersMatch = lower.match(/\b(\d{2,4})\s*m\b/);
  const targetMeters = metersMatch && (sport === "SWIM" || !sport) ? parseInt(metersMatch[1], 10) : undefined;

  const replaceIntent =
    /\b(change|modify|replace|zmień|zmien|zrób\s+\d+\s*m\s*(zamiast)?)\b/i.test(lower) &&
    (/\b(it|tomorrow|jutro|workout|trening|session)\b/i.test(lower) || targetMeters != null);

  const isSingleRequest =
    isAddWorkoutRequest(lower) ||
    /\b(give me|get me|plan|schedule|add|create|want|write|generate)\s+(a\s+)?(run|bike|swim|strength|workout|session)\b/i.test(lower) ||
    (sport !== undefined && /\b(for|on|tomorrow|today)\b/.test(lower)) ||
    (targetMeters != null && (sport === "SWIM" || /\b(swim|pływanie)\b/i.test(lower))) ||
    (replaceIntent && (targetMeters != null || sport !== undefined));

  if (!isSingleRequest && !sport) return null;

  const resolvedSport =
    sport ?? (targetMeters != null ? "SWIM" : "RUN");

  return {
    kind: "single",
    sport: resolvedSport,
    date: dateStr,
    addToCalendar: !noCalendar,
    createSeparate,
    durationMinHint,
    targetMeters: targetMeters && targetMeters >= 100 && targetMeters <= 10000 ? targetMeters : undefined,
    replaceIntent: replaceIntent || false,
  };
}

function isAddWorkoutRequest(lower: string): boolean {
  const hasVerb = /(^|\b)(dodaj|zaplanuj|wstaw|ustaw|add|schedule|plan)\b/.test(lower);
  if (!hasVerb) return false;
  const hasNoun = /(\btrening\b|\bworkout\b|\bsession\b)/.test(lower);
  const hasSport = /(\bbieg\b|\brun\b|\bbike\b|\bswim\b|\bstrength\b)/.test(lower);
  return hasNoun || hasSport;
}

/**
 * Generate full rubric prescription from intent + context (deterministic).
 */
export function generateRubricPrescription(
  intent: SessionIntent,
  context: CoachBrainContext
): WorkoutRubricPrescription {
  const sport = intent.sport ?? "RUN";
  const date = intent.date ?? context.aiContext.planSummary.today;
  const durationMin = Math.min(120, Math.max(20, intent.durationMinHint ?? 60));
  const profile = context.aiContext.userProfile;
  const identityMode = (profile.identityMode as string) ?? "competitive";
  const experienceLevel = (profile.experienceLevel as string) ?? "intermediate";

  const isLowReadiness =
    (context.aiContext.todayCheckin?.data?.readinessScore ?? 100) < 50 ||
    (context.aiContext.todayCheckin?.data?.soreness ?? 0) >= 4;

  const intensity = isLowReadiness ? "easy" : "moderate";
  const effectiveDuration = isLowReadiness ? Math.round(durationMin * 0.75) : durationMin;

  const warmupMin = Math.max(5, Math.round(effectiveDuration * 0.15));
  const cooldownMin = Math.max(5, Math.round(effectiveDuration * 0.1));
  const mainMin = Math.max(10, effectiveDuration - warmupMin - cooldownMin);

  const options =
    sport === "SWIM" && intent.targetMeters != null
      ? { requestedTotalMeters: intent.targetMeters }
      : sport === "STRENGTH" && context.strengthMobilityOnly
        ? { strengthMobilityOnly: true }
        : undefined;
  const { warmup, main, cooldown, techniqueCues, intensityTargets, goal, title } = buildBlocksBySport(
    sport,
    intensity,
    warmupMin,
    mainMin,
    cooldownMin,
    context,
    options
  );

  const rationale = isLowReadiness
    ? "Adapted for lower readiness: reduced volume and intensity to support recovery while keeping consistency."
    : `Session aligned with ${identityMode} mode and ${experienceLevel} level.`;

  const why: WhyDrivers = {
    rationale,
    guardrailChecks: [
      `Hard sessions this week: ${context.hardSessionsThisWeek} (max ${MAX_HARD_SESSIONS_PER_WEEK})`,
      `Ramp: ${context.loadMetrics.rampRate ?? "n/a"}%`,
    ],
    adaptationReason: isLowReadiness ? "Readiness/soreness triggered easier variant." : undefined,
  };

  const fuelingGuidance =
    effectiveDuration > 60
      ? "If session >60 min: 30–60 g carbs/hour, 500 ml water/hour, electrolytes if sweating heavily."
      : undefined;

  const variantA = "Ideal day: full duration and target intensity.";
  const variantB =
    sport === "SWIM"
      ? "Option B (shorter): reduce to ~70% total meters; keep warm-up and cool-down, shorten main set."
      : "Low-energy day: reduce main set by 20% or swap to easy effort only.";

  const progressionNote = getBeginnerProgressionNote(sport, experienceLevel, context);
  return {
    sport,
    date,
    title,
    durationMin: effectiveDuration,
    goal,
    warmup,
    main,
    cooldown,
    intensityTargets,
    techniqueCues,
    fuelingGuidance,
    variantA,
    variantB,
    successCriteria: "You stayed within target zones/RPE and completed warm-up and cool-down.",
    progressionNote: progressionNote ?? undefined,
    rationale,
    why,
  };
}

/** Beginner/developing: phase 1 = week 1–2, 2 = week 3–4, 3 = week 5–6. Based on sessions of this sport in last 14 days. */
function getBeginnerPhase(sport: RubricSport, context: CoachBrainContext): 1 | 2 | 3 {
  const typeUpper = sport.toUpperCase();
  const count = context.recentWorkouts.filter(
    (w) => (w.type?.toUpperCase() ?? "") === typeUpper
  ).length;
  if (count <= 2) return 1;
  if (count <= 5) return 2;
  return 3;
}

function getBeginnerProgressionNote(
  sport: RubricSport,
  experienceLevel: string,
  context: CoachBrainContext
): string | null {
  const isBeginner =
    /beginner|novice|new/i.test(experienceLevel) ||
    context.recentWorkouts.filter((w) => (w.type?.toUpperCase() ?? "") === sport.toUpperCase()).length <= 1;
  if (!isBeginner) return null;
  const phase = getBeginnerPhase(sport, context);
  if (sport === "SWIM") {
    if (phase === 1) return "Progression (Week 1–2): technique + consistent easy volume; next week add one steady set.";
    if (phase === 2) return "Progression (Week 3–4): add one quality-light session; slightly longer main set.";
    return "Progression (Week 5–6): introduce tempo-lite sets if readiness OK; keep 70–85% easy.";
  }
  if (sport === "RUN") {
    if (phase === 1) return "Progression (Week 1–2): easy run/walk + strides; next add steady blocks.";
    if (phase === 2) return "Progression (Week 3–4): add 2×8 min steady @ RPE 5 once per week.";
    return "Progression (Week 5–6): add light threshold only if no soreness.";
  }
  if (sport === "BIKE") {
    if (phase === 1) return "Progression (Week 1–2): easy endurance + cadence drills.";
    if (phase === 2) return "Progression (Week 3–4): add 3×8 min steady @ RPE 5.";
    return "Progression (Week 5–6): add 2×12 min tempo @ RPE 6, no all-out.";
  }
  if (sport === "STRENGTH") {
    if (phase === 1) return "Progression (Week 1–2): technique + posterior chain + core.";
    if (phase === 2) return "Progression (Week 3–4): add 1 set or +2 reps where comfortable.";
    return "Progression (Week 5–6): add unilateral stability if pain-free.";
  }
  return null;
}

function buildBlocksBySport(
  sport: RubricSport,
  intensity: string,
  warmupMin: number,
  mainMin: number,
  cooldownMin: number,
  context: CoachBrainContext,
  options?: { requestedTotalMeters?: number }
): {
  warmup: RubricStep[];
  main: RubricStep[];
  cooldown: RubricStep[];
  techniqueCues: string[];
  intensityTargets: { pace?: string; hr?: string; watts?: string; rpe?: string; zone?: string };
  goal: string;
  title: string;
} {
  const z = context.aiContext.zones;
  const rpe = intensity === "easy" ? "RPE 3–4" : intensity === "moderate" ? "RPE 5–6" : "RPE 7–8";
  const hr =
    z.hr.z2.min != null && z.hr.z2.max != null && intensity === "easy"
      ? `${z.hr.z2.min}–${z.hr.z2.max} bpm`
      : z.hr.z3.min != null && z.hr.z3.max != null
        ? `${z.hr.z3.min}–${z.hr.z3.max} bpm`
        : "HR Zone 2–3";
  const watts =
    z.power.ftp != null
      ? intensity === "easy"
        ? `55–70% FTP (${Math.round(z.power.ftp * 0.55)}–${Math.round(z.power.ftp * 0.7)} W)`
        : `75–90% FTP`
      : "Power Zone 2–3";

  if (sport === "RUN") {
    return {
      title: intensity === "easy" ? "Easy Run" : "Steady Run",
      goal: intensity === "easy"
        ? "Aerobic maintenance and recovery."
        : "Sustained steady effort to build endurance.",
      warmup: [
        { description: "Easy jog 2–3 min", durationMin: 2 },
        { description: "Dynamic drills: leg swings, skips, strides 4x20 sec", durationMin: 4 },
        { description: "Gradual build to target effort", durationMin: warmupMin - 6 },
      ],
      main: [
        {
          description: "Steady run at target intensity. Keep cadence 170–180 if possible.",
          durationMin: mainMin,
          intensityTarget: { rpe, hr, zone: "Z2" },
        },
      ],
      cooldown: [
        { description: "Gradual decrease to easy jog", durationMin: 2 },
        { description: "Walk 2–3 min", durationMin: cooldownMin - 2 },
      ],
      techniqueCues: ["Relaxed shoulders", "Quick light steps", "Breathe rhythmically", "Land midfoot"],
      intensityTargets: { rpe, hr, pace: "Conversational; talk test" },
    };
  }

  if (sport === "BIKE") {
    return {
      title: intensity === "easy" ? "Endurance Ride" : "Tempo Ride",
      goal: intensity === "easy"
        ? "Aerobic base and time in saddle."
        : "Sustained power in upper Z2/low Z3.",
      warmup: [
        { description: "Easy spin 5 min", durationMin: 5 },
        { description: "3x 1 min gradual build", durationMin: 3 },
        { description: "Stretch hips/back 2 min", durationMin: warmupMin - 10 },
      ],
      main: [
        {
          description: "Steady effort at target power/HR. Stay seated, smooth pressure.",
          durationMin: mainMin,
          intensityTarget: { rpe, hr, watts },
        },
      ],
      cooldown: [
        { description: "Spin down 5 min", durationMin: Math.min(5, cooldownMin) },
        { description: "Easy spin to finish", durationMin: cooldownMin - 5 },
      ],
      techniqueCues: ["Smooth pedal stroke", "Relax upper body", "90+ rpm if possible", "Stay hydrated"],
      intensityTargets: { rpe, hr, watts },
    };
  }

  if (sport === "SWIM") {
    const poolLen = context.aiContext.userProfile.swimPoolLengthM ?? 25;
    const swimLevel = (context.aiContext.userProfile.swimLevel as string) || "age_group";
    const totalRange =
      swimLevel === "beginner"
        ? { min: 800, max: 1600 }
        : swimLevel === "advanced"
          ? { min: 2500, max: 4000 }
          : swimLevel === "expert"
            ? { min: 3500, max: 5500 }
            : { min: 1600, max: 2800 };
    const totalMeters =
      options?.requestedTotalMeters != null && options.requestedTotalMeters >= 100 && options.requestedTotalMeters <= 10000
        ? options.requestedTotalMeters
        : Math.min(totalRange.max, Math.max(totalRange.min, Math.round((mainMin * 40) / 5) * 5));
    const warmupM = swimLevel === "beginner" ? 200 : swimLevel === "advanced" || swimLevel === "expert" ? 400 : 300;
    const warmup1M = Math.min(poolLen * 2, 100);
    const warmup2M = swimLevel === "beginner" ? 150 : 200;
    const warmup3M = Math.max(0, warmupM - warmup1M - warmup2M);
    const mainM = totalMeters - warmupM - 100;

    const title =
      options?.requestedTotalMeters != null
        ? `Swim ${options.requestedTotalMeters}m`
        : swimLevel === "beginner"
          ? "Technique-Focus Swim"
          : swimLevel === "expert"
            ? "Structured Swim"
            : "Technique & Endurance Swim";

    return {
      title,
      goal:
        swimLevel === "beginner"
          ? "Stroke efficiency and comfort in the water."
          : swimLevel === "expert"
            ? "Sustained aerobic and threshold work with minimal rest."
            : "Stroke efficiency and aerobic capacity.",
      warmup: [
        { description: `${warmup1M}m easy swim`, durationMin: 2, distanceM: warmup1M },
        {
          description:
            swimLevel === "beginner"
              ? "Drills: 3x50m (e.g. catch-up, fist)"
              : "Drills: 4x50m (e.g. catch-up, fist)",
          durationMin: 5,
          distanceM: warmup2M,
        },
        { description: warmup3M > 0 ? `${warmup3M}m build to steady` : "Build to steady", durationMin: warmupMin - 7, distanceM: warmup3M },
      ],
      main: [
        {
          description: `Main set: ${mainM}m steady, focus on form. ${poolLen}m pool: count laps.`,
          durationMin: mainMin,
          distanceM: mainM,
          intensityTarget: { rpe, zone: "Z2" },
        },
      ],
      cooldown: [
        { description: "Easy 100m", durationMin: 2, distanceM: 100 },
        { description: "Stretch shoulders", durationMin: Math.max(0, cooldownMin - 2) },
      ],
      techniqueCues: ["High elbow catch", "Rotate from hips", "Breathe bilaterally", "Relaxed kick"],
      intensityTargets: { rpe, pace: "per 100m comfortable" },
    };
  }

  // STRENGTH — templates by primary sport (swimmer / triathlete / runner) + level + duration
  const primarySport = (context.aiContext.userProfile.sportPrimary as string) ?? "RUN";
  const experienceLevel = (context.aiContext.userProfile.experienceLevel as string) ?? "intermediate";
  const mobilityOnly = options?.strengthMobilityOnly === true;
  return buildStrengthBlocks(primarySport, experienceLevel, warmupMin, mainMin, cooldownMin, mobilityOnly);
}

/** Strength templates: 6–8 exercises, sets×reps, tempo, rest, RPE, core block, prehab. 30/45/60 min variants. mobilityOnly: no heavy load (e.g. shoulder pain). */
function buildStrengthBlocks(
  primarySport: string,
  experienceLevel: string,
  warmupMin: number,
  mainMin: number,
  cooldownMin: number,
  mobilityOnly = false
): {
  warmup: RubricStep[];
  main: RubricStep[];
  cooldown: RubricStep[];
  techniqueCues: string[];
  intensityTargets: { rpe?: string };
  goal: string;
  title: string;
} {
  const level = /beginner|novice|new/i.test(experienceLevel)
    ? "beginner"
    : /advanced|expert|competitive/i.test(experienceLevel)
      ? "advanced"
      : "intermediate";
  const totalMin = warmupMin + mainMin + cooldownMin;
  const durationVariant = totalMin <= 35 ? "30" : totalMin <= 52 ? "45" : "60";
  const setsReps =
    level === "beginner"
      ? "2 sets × 8–12 reps"
      : level === "advanced"
        ? "3–4 sets × 6–10 reps"
        : "3 sets × 8–10 reps";
  const rpe = level === "beginner" ? "RPE 5–6" : level === "advanced" ? "RPE 7–8" : "RPE 6–7";
  const rest = level === "beginner" ? "60–90 s" : "90–120 s";

  const warmup: RubricStep[] = [
    { description: "5 min light cardio or dynamic mobility (band/bodyweight)", durationMin: 5 },
    { description: "Joint circles (hips, shoulders, thoracic); activation (glutes, scapula)", durationMin: Math.max(0, warmupMin - 5) },
  ];

  if (mobilityOnly) {
    const main: RubricStep[] = [
      {
        description: "Mobility / prehab only — avoid load until cleared. Band pull-aparts 2×15; YTW 2×8 each; external rotation 2×12; thoracic rotations 2×10 each. Rest 45 s. No heavy pressing/pulling.",
        durationMin: Math.round(mainMin * 0.4),
      },
      {
        description: "Core: Dead bug 3×8; Pallof hold 2×30 s each; cat-cow 10 reps. Anti-rotation, low load.",
        durationMin: Math.min(12, Math.round(mainMin * 0.35)),
      },
    ];
    return {
      title: `Strength — Mobility Only (${durationVariant} min)`,
      goal: "Mobility and prehab only; no heavy resistance. Support recovery and range of motion.",
      warmup,
      main,
      cooldown: [{ description: "Stretch shoulders, chest, thoracic; gentle mobility", durationMin: cooldownMin }],
      techniqueCues: ["No load on painful areas", "Controlled range", "Stop if pain increases"],
      intensityTargets: { rpe: "RPE 3–4 (very light)" },
    };
  }

  // Swimmer: shoulder/scapula prehab + posterior chain + core
  if (primarySport === "SWIM") {
    const main: RubricStep[] = [
      {
        description: `Goblet squat: ${setsReps}, tempo 3-1-2-0, rest ${rest}. Cue: chest up, knees out. ${rpe}.`,
        durationMin: Math.round(mainMin * 0.2),
        intensityTarget: { rpe },
      },
      {
        description: `Single-leg RDL (or hip hinge): ${setsReps} each leg, 3-1-2-0, rest ${rest}. Cue: soft knee, hinge at hip. ${rpe}.`,
        durationMin: Math.round(mainMin * 0.2),
        intensityTarget: { rpe },
      },
      {
        description: `Prehab — Band pull-aparts: 2×15. YTW: 2×8 each. External rotation: 2×12. Rest 45 s. Cue: squeeze scapula, no shrug.`,
        durationMin: Math.round(mainMin * 0.15),
      },
      {
        description: `Push-up or floor press: ${setsReps}, 3-1-2-0, rest ${rest}. Cue: elbows 45°, full lockout. ${rpe}.`,
        durationMin: Math.round(mainMin * 0.15),
        intensityTarget: { rpe },
      },
      {
        description: `Row (cable/band): ${setsReps}, 2-1-2-0, rest ${rest}. Cue: pull to ribs, squeeze. ${rpe}.`,
        durationMin: Math.round(mainMin * 0.15),
        intensityTarget: { rpe },
      },
      {
        description: `Core block (10–12 min): Dead bug 3×8 each side; Pallof hold 3×30 s each; Plank 2×45 s. Anti-rotation focus. Rest 30 s.`,
        durationMin: Math.min(12, Math.round(mainMin * 0.15)),
      },
    ];
    return {
      title: `Strength for Swimmers (${durationVariant} min)`,
      goal: "Strength and injury resilience: posterior chain, shoulder/scapula prehab, core anti-rotation.",
      warmup,
      main,
      cooldown: [
        { description: "Stretch chest, lats, hips; shoulder circles", durationMin: cooldownMin },
      ],
      techniqueCues: ["Brace core throughout", "Controlled tempo", "Prehab before load", "Rest between sets"],
      intensityTargets: { rpe },
    };
  }

  // Triathlete: balanced — posterior chain, push/pull, core
  if (primarySport === "BIKE" || /\btriathlete|triathlon\b/i.test(primarySport)) {
    const main: RubricStep[] = [
      {
        description: `Goblet or front squat: ${setsReps}, 3-1-2-0, rest ${rest}. Cue: knees out, brace. ${rpe}.`,
        durationMin: Math.round(mainMin * 0.22),
        intensityTarget: { rpe },
      },
      {
        description: `Romanian deadlift or hinge: ${setsReps}, 3-1-2-0, rest ${rest}. Cue: soft knee, drive hips. ${rpe}.`,
        durationMin: Math.round(mainMin * 0.22),
        intensityTarget: { rpe },
      },
      {
        description: `Push (push-up or press): ${setsReps}, 3-1-2-0, rest ${rest}. Cue: full ROM. ${rpe}.`,
        durationMin: Math.round(mainMin * 0.18),
        intensityTarget: { rpe },
      },
      {
        description: `Row (horizontal pull): ${setsReps}, 2-1-2-0, rest ${rest}. Cue: squeeze scapula. ${rpe}.`,
        durationMin: Math.round(mainMin * 0.18),
        intensityTarget: { rpe },
      },
      {
        description: `Core block (10–12 min): Dead bug 3×8; Pallof hold 3×30 s; Bird-dog 2×8 each. Anti-rotation + anti-extension. Rest 30 s.`,
        durationMin: Math.min(12, Math.round(mainMin * 0.2)),
      },
    ];
    return {
      title: `Strength for Triathlete (${durationVariant} min)`,
      goal: "Posterior chain, push/pull balance, core stability for swim-bike-run.",
      warmup,
      main,
      cooldown: [
        { description: "Stretch hips, hamstrings, chest, lats", durationMin: cooldownMin },
      ],
      techniqueCues: ["Brace core", "Controlled tempo", "Rest 60–90 s between sets", "Full ROM"],
      intensityTargets: { rpe },
    };
  }

  // Runner (default): posterior chain, single-leg, core
  const main: RubricStep[] = [
    {
      description: `Split squat or lunge: ${setsReps} each leg, 3-1-2-0, rest ${rest}. Cue: front knee over toe. ${rpe}.`,
      durationMin: Math.round(mainMin * 0.22),
      intensityTarget: { rpe },
    },
    {
      description: `Single-leg RDL or hinge: ${setsReps} each, 3-1-2-0, rest ${rest}. Cue: hinge at hip. ${rpe}.`,
      durationMin: Math.round(mainMin * 0.22),
      intensityTarget: { rpe },
    },
    {
      description: `Push-up or press: ${setsReps}, 3-1-2-0, rest ${rest}. Cue: core tight. ${rpe}.`,
      durationMin: Math.round(mainMin * 0.18),
      intensityTarget: { rpe },
    },
    {
      description: `Row or inverted row: ${setsReps}, 2-1-2-0, rest ${rest}. Cue: pull to ribs. ${rpe}.`,
      durationMin: Math.round(mainMin * 0.18),
      intensityTarget: { rpe },
    },
    {
      description: `Core block (10–12 min): Dead bug 3×8; Pallof 3×30 s; Plank 2×45 s. Anti-rotation/anti-extension. Rest 30 s.`,
      durationMin: Math.min(12, Math.round(mainMin * 0.2)),
    },
  ];
  return {
    title: `Strength for Runners (${durationVariant} min)`,
    goal: "Posterior chain and single-leg stability, core anti-rotation, injury resilience.",
    warmup,
    main,
    cooldown: [
      { description: "Stretch calves, hamstrings, hips, glutes", durationMin: cooldownMin },
    ],
    techniqueCues: ["Brace core", "Controlled tempo", "Single-leg quality over load", "Rest between sets"],
    intensityTargets: { rpe },
  };
}

/**
 * Apply readiness adaptation (reduce intensity/duration or swap to recovery).
 */
export function applyReadinessAdaptation(
  prescription: WorkoutRubricPrescription,
  context: CoachBrainContext
): WorkoutRubricPrescription {
  const readiness = context.aiContext.todayCheckin?.data?.readinessScore ?? 100;
  const soreness = context.aiContext.todayCheckin?.data?.soreness ?? 0;
  const sleepQual = context.aiContext.todayCheckin?.data?.sleepQuality ?? 5;

  if (readiness >= 55 && soreness < 4 && sleepQual >= 3) return prescription;

  const factor = readiness < 40 ? 0.6 : readiness < 55 ? 0.8 : 0.9;
  const newDuration = Math.max(20, Math.round(prescription.durationMin * factor));

  return {
    ...prescription,
    durationMin: newDuration,
    rationale: `${prescription.rationale} Readiness/soreness/sleep triggered adaptation: reduced to ${newDuration} min.`,
    why: {
      rationale: prescription.why?.rationale ?? prescription.rationale,
      guardrailChecks: prescription.why?.guardrailChecks,
      adaptationReason: `Readiness ${readiness}, soreness ${soreness}, sleep ${sleepQual}. Reduced volume.`,
    },
  };
}

/**
 * Validate guardrails; adjust prescription if needed (max hard/week, ramp).
 */
export function validateGuardrails(
  prescription: WorkoutRubricPrescription,
  context: CoachBrainContext
): { prescription: WorkoutRubricPrescription; warnings: string[] } {
  const warnings: string[] = [];
  const planned: GuardrailPlannedWorkout[] = [
    ...context.plannedWorkoutsThisWeek.map((w) => ({
      date: w.date,
      durationMin: w.durationMin,
      intensity: (w.intensity ?? "easy") as "easy" | "moderate" | "hard",
      tss: Math.round((w.durationMin ?? 0) * 0.8),
    })),
    {
      date: parseDateToLocalNoon(prescription.date),
      durationMin: prescription.durationMin,
      intensity: "moderate",
      tss: Math.round(prescription.durationMin * 0.8),
    },
  ];

  const result = checkGuardrails(
    planned,
    context.loadMetrics.previousWeekLoad,
    context.recentWorkouts.map((w) => ({
      date: w.date,
      intensity: undefined,
      durationMin: w.durationMin,
    })),
    RAMP_THRESHOLD
  );

  if (!result.isWithinLimits && result.adjustments.length > 0) {
    const adj = result.adjustments[0];
    if (adj.adjustedDuration < prescription.durationMin) {
      warnings.push(result.warnings[0]?.message ?? "Ramp limit");
      return {
        prescription: {
          ...prescription,
          durationMin: Math.max(20, adj.adjustedDuration),
          rationale: `${prescription.rationale} Guardrail: duration capped for safe ramp.`,
        },
        warnings,
      };
    }
  }
  result.warnings.forEach((w) => warnings.push(w.message));
  return { prescription, warnings };
}

/**
 * Build RESULT TEMPLATE section (compact) for calendar block. Sport-specific fields.
 */
function buildResultTemplateSection(sport: RubricSport): string[] {
  const lines: string[] = [];
  lines.push("### RESULT TEMPLATE (optional)");
  lines.push("- Completed? (Y/N):");
  lines.push("- Actual duration:");
  lines.push("- Actual distance:");
  lines.push("- Avg HR (optional):");
  lines.push("- RPE (1–10):");
  lines.push("- Feeling (great/good/ok/tired/bad):");
  lines.push("- Legs (fresh/normal/heavy/sore):");
  lines.push("- Notes (1 line):");
  if (sport === "SWIM") {
    lines.push("- Pool length (25/50):");
    lines.push("- Main set pace (sec/100m) OR best 100 split:");
  } else if (sport === "BIKE") {
    lines.push("- Avg power (W) OR NP (optional) OR avg speed:");
  } else if (sport === "RUN") {
    lines.push("- Avg pace (min/km) OR best 1km split:");
  } else if (sport === "STRENGTH") {
    lines.push("- Completed sets/reps? + load (optional):");
  }
  return lines;
}

/**
 * Format prescription as markdown for user (explainLevel: minimal | standard | deep).
 */
export function formatPrescriptionMarkdown(
  prescription: WorkoutRubricPrescription,
  explainLevel: "minimal" | "standard" | "deep",
  options?: { includeResultTemplate?: boolean }
): string {
  const lines: string[] = [];
  lines.push(`## ${prescription.title}`);
  lines.push("");
  lines.push(`**Goal:** ${prescription.goal}`);
  lines.push(`**Duration:** ${prescription.durationMin} min`);
  const totalMeters =
    prescription.sport === "SWIM"
      ? [...prescription.warmup, ...prescription.main, ...prescription.cooldown].reduce(
          (sum, s) => sum + (s.distanceM ?? 0),
          0
        )
      : 0;
  if (totalMeters > 0) {
    lines.push(`**TOTAL METERS:** ${totalMeters}`);
    lines.push(`**Total:** ${prescription.durationMin} min / ~${totalMeters}m`);
    lines.push("");
  }

  if (explainLevel !== "minimal") {
    lines.push("### Why");
    lines.push(prescription.rationale);
    if (prescription.why?.adaptationReason) {
      lines.push(prescription.why.adaptationReason);
    }
    if (explainLevel === "deep" && prescription.why?.guardrailChecks?.length) {
      lines.push("");
      lines.push("Guardrail checks:");
      prescription.why.guardrailChecks.forEach((c) => lines.push(`- ${c}`));
    }
    lines.push("");
  }

  lines.push("### Warm-up");
  prescription.warmup.forEach((s) => {
    const d = s.durationMin ? ` (${s.durationMin} min)` : "";
    lines.push(`- ${s.description}${d}`);
  });
  lines.push("");
  lines.push("### Main set");
  prescription.main.forEach((s) => {
    const d = s.durationMin ? ` (${s.durationMin} min)` : "";
    const t = s.intensityTarget
      ? ` — ${[s.intensityTarget.rpe, s.intensityTarget.hr, s.intensityTarget.watts].filter(Boolean).join(", ")}`
      : "";
    lines.push(`- ${s.description}${d}${t}`);
  });
  lines.push("");
  lines.push("### Cool-down");
  prescription.cooldown.forEach((s) => {
    const d = s.durationMin ? ` (${s.durationMin} min)` : "";
    lines.push(`- ${s.description}${d}`);
  });
  lines.push("");
  lines.push("### Targets");
  const t = prescription.intensityTargets;
  if (t.rpe) lines.push(`- RPE: ${t.rpe}`);
  if (t.hr) lines.push(`- HR: ${t.hr}`);
  if (t.watts) lines.push(`- Power: ${t.watts}`);
  if (t.pace) lines.push(`- Pace: ${t.pace}`);
  lines.push("");
  lines.push("### Technique");
  prescription.techniqueCues.forEach((c) => lines.push(`- ${c}`));
  if (prescription.fuelingGuidance) {
    lines.push("");
    lines.push("### Fueling");
    lines.push(prescription.fuelingGuidance);
  }
  lines.push("");
  lines.push("### Variants");
  lines.push(`- **A (ideal):** ${prescription.variantA ?? "Full session."}`);
  lines.push(`- **B (low energy):** ${prescription.variantB ?? "Reduce volume."}`);
  if (prescription.progressionNote) {
    lines.push("");
    lines.push(`**Progression note:** ${prescription.progressionNote}`);
  }
  lines.push("");
  lines.push("**Success criteria:** " + (prescription.successCriteria ?? "Complete warm-up, main set, and cool-down within targets."));
  lines.push("");
  lines.push("*Post-workout: log total time, avg pace/speed, RPE, legs.*");
  if (options?.includeResultTemplate !== false) {
    lines.push("");
    lines.push("");
    buildResultTemplateSection(prescription.sport).forEach((l) => lines.push(l));
  }
  lines.push("");
  lines.push("---");
  lines.push("*Today's win: complete this session and note how you feel.*");

  return lines.join("\n");
}

/** Map rubric sport to DB type string. */
function sportToType(sport: RubricSport): string {
  return sport;
}

/**
 * Convert rubric to calendar-insert item (descriptionMd + prescriptionJson).
 */
function rubricToCalendarItemInternal(
  prescription: WorkoutRubricPrescription,
  opts?: { includeResultTemplate?: boolean }
): {
  descriptionMd: string;
  prescriptionJson: Record<string, unknown>;
} {
  const descriptionMd = formatPrescriptionMarkdown(prescription, "standard", {
    includeResultTemplate: opts?.includeResultTemplate !== false,
  });
  const prescriptionJson = {
    version: 2,
    objective: prescription.goal,
    sections: [
      {
        id: "warmup",
        type: "warmup",
        title: "Warm-up",
        blocks: prescription.warmup.map((s) => ({
          id: `w-${s.description.slice(0, 20)}`,
          durationSec: (s.durationMin ?? 0) * 60,
          notes: s.description,
          intensityRange: s.intensityTarget?.rpe ? { unit: "rpe", min: 3, max: 5 } : undefined,
        })),
      },
      {
        id: "main",
        type: "main",
        title: "Main set",
        blocks: prescription.main.map((s) => ({
          id: "m-1",
          durationSec: (s.durationMin ?? 0) * 60,
          notes: s.description,
          intensityRange: { unit: "rpe" as const, min: 5, max: 7 },
        })),
      },
      {
        id: "cooldown",
        type: "cooldown",
        title: "Cool-down",
        blocks: prescription.cooldown.map((s) => ({
          id: "c-1",
          durationSec: (s.durationMin ?? 0) * 60,
          notes: s.description,
        })),
      },
    ],
  };
  return { descriptionMd, prescriptionJson };
}

export type SaveWorkoutMode = "create" | "replace" | "upsert";

/** Explicit save result: exactly one of created/updated/reused is true; reason explains outcome. */
export type SaveWorkoutResult = {
  workoutId: string;
  created: boolean;
  updated: boolean;
  reused: boolean;
  reason: string;
};

/** Hash payload (title, description, distance, duration, prescription) for compare — no system fields. */
function payloadHash(p: {
  title: string;
  durationMin: number;
  distanceM: number | null | undefined;
  descriptionMd: string;
  prescriptionJson: string;
}): string {
  const canonical = JSON.stringify({
    title: p.title,
    durationMin: p.durationMin,
    distanceM: p.distanceM ?? null,
    descriptionMd: p.descriptionMd,
    prescriptionJson: p.prescriptionJson,
  });
  return createHash("sha256").update(canonical).digest("hex");
}

/**
 * Save workout: find by (userId, date same day, type). Behavior by mode:
 * - create: always insert new (ignore existing).
 * - replace: if existing, compare payload hash; if different => update (updated:true); if same => reused:true.
 * - upsert: if existing and !createSeparate, same as replace; else create.
 * Returns { workoutId, created, updated, reused, reason }. Never silent reuse when payload differs.
 */
export async function saveWorkoutIdempotent(
  userId: string,
  prescription: WorkoutRubricPrescription,
  options: {
    createSeparate?: boolean;
    source?: string;
    includeResultTemplate?: boolean;
    mode?: SaveWorkoutMode;
    reason?: string;
    targetMeters?: number;
  } = {}
): Promise<SaveWorkoutResult> {
  const date = parseDateToLocalNoon(prescription.date);
  const type = sportToType(prescription.sport);
  const dayStart = startOfDay(date);
  const dayEnd = addDays(dayStart, 1);
  const mode = options.mode ?? "upsert";
  const targetSport = prescription.sport;

  const existing = await db.workout.findFirst({
    where: {
      userId,
      date: { gte: dayStart, lt: dayEnd },
      type,
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      title: true,
      descriptionMd: true,
      durationMin: true,
      distanceM: true,
      prescriptionJson: true,
    },
  });

  const item = rubricToCalendarItemInternal(prescription, {
    includeResultTemplate: options.includeResultTemplate !== false,
  });
  const source = options.source ?? "AI";
  const distanceM =
    prescription.sport === "SWIM"
      ? [...prescription.warmup, ...prescription.main, ...prescription.cooldown].reduce(
          (sum, s) => sum + (s.distanceM ?? 0),
          0
        ) || undefined
      : undefined;

  const prescriptionJsonStr = JSON.stringify(item.prescriptionJson);
  const updatePayload = {
    title: prescription.title,
    durationMin: prescription.durationMin,
    distanceM,
    descriptionMd: item.descriptionMd,
    prescriptionJson: prescriptionJsonStr,
    source,
    aiGenerated: true,
    planned: true,
  };

  const shouldConsiderUpdate =
    existing &&
    (mode === "replace" || (mode === "upsert" && !options.createSeparate));

  if (shouldConsiderUpdate && existing) {
    const newHash = payloadHash({
      title: prescription.title,
      durationMin: prescription.durationMin,
      distanceM: distanceM ?? null,
      descriptionMd: item.descriptionMd,
      prescriptionJson: prescriptionJsonStr,
    });
    const existingHash = payloadHash({
      title: existing.title,
      durationMin: existing.durationMin ?? 0,
      distanceM: existing.distanceM ?? null,
      descriptionMd: existing.descriptionMd ?? "",
      prescriptionJson: existing.prescriptionJson ?? "{}",
    });

    if (newHash === existingHash) {
      const reason = options.reason ?? "payload unchanged; reused existing";
      logInfo("coach-brain.save", {
        mode,
        targetMeters: options.targetMeters,
        targetSport,
        existingId: existing.id,
        created: false,
        updated: false,
        reused: true,
        reason,
      });
      return {
        workoutId: existing.id,
        created: false,
        updated: false,
        reused: true,
        reason,
      };
    }

    await db.workout.update({
      where: { id: existing.id },
      data: updatePayload,
    });
    const reason = options.reason ?? "payload changed; updated existing";
    logInfo("coach-brain.save", {
      mode,
      targetMeters: options.targetMeters,
      targetSport,
      existingId: existing.id,
      created: false,
      updated: true,
      reused: false,
      reason,
      previousTitle: existing.title,
      newTitle: prescription.title,
    });
    return {
      workoutId: existing.id,
      created: false,
      updated: true,
      reused: false,
      reason,
    };
  }

  if (mode === "create" && existing) {
    logInfo("coach-brain.save", {
      mode: "create",
      targetMeters: options.targetMeters,
      targetSport,
      existingId: existing.id,
      created: false,
      updated: false,
      reused: false,
      reason: options.reason ?? "create requested but existing found; creating separate",
    });
  }

  const created = await db.workout.create({
    data: {
      userId,
      title: prescription.title,
      type,
      date,
      durationMin: prescription.durationMin,
      distanceM,
      planned: true,
      completed: false,
      aiGenerated: true,
      source,
      descriptionMd: item.descriptionMd,
      prescriptionJson: prescriptionJsonStr,
    },
    select: { id: true },
  });
  const reason =
    options.reason ?? (existing ? "createSeparate or create mode" : "no existing workout");
  logInfo("coach-brain.save", {
    mode,
    targetMeters: options.targetMeters,
    targetSport,
    existingId: existing?.id,
    created: true,
    updated: false,
    reused: false,
    reason,
    workoutId: created.id,
    title: prescription.title,
  });
  return {
    workoutId: created.id,
    created: true,
    updated: false,
    reused: false,
    reason,
  };
}

/**
 * Single entry: generate + adapt + validate + save. Returns markdown and workoutId(s) for response.
 */
export async function generateAndSaveWorkout(
  userId: string,
  message: string,
  options: {
    addToCalendar?: boolean;
    explainLevel?: "minimal" | "standard" | "deep";
    /** "AI_DRAFT" for draft (undo-able), "AI" for final */
    source?: "AI" | "AI_DRAFT";
  } = {}
): Promise<{
  success: boolean;
  workoutId?: string;
  created?: boolean;
  createdWorkoutIds?: string[];
  markdown?: string;
  title?: string;
  warnings?: string[];
  error?: string;
}> {
  try {
    const ctx = await loadCoachContext(userId);
    if (!ctx) return { success: false, error: "Could not load context" };

    const intent = resolveSessionIntent(message, ctx);
    if (!intent || intent.kind !== "single" || !intent.sport) {
      return { success: false };
    }

    if (intent.sport === "STRENGTH" && /\b(shoulder pain|ból barku|bark|injury|kontuzja|pain|obol|sore)\b/i.test(message)) {
      ctx.strengthMobilityOnly = true;
    }

    let prescription = generateRubricPrescription(intent, ctx);
    prescription = applyReadinessAdaptation(prescription, ctx);
    const { prescription: validated, warnings } = validateGuardrails(prescription, ctx);
    prescription = validated;

    const explainLevel = options.explainLevel ?? "standard";
    const includeResultTemplate = ctx.aiContext.userProfile.coachIncludeResultTemplate !== false;
    const markdown = formatPrescriptionMarkdown(prescription, explainLevel, { includeResultTemplate });

    const addToCalendar = options.addToCalendar !== false && intent.addToCalendar;
    if (!addToCalendar) {
      return {
        success: true,
        markdown,
        title: prescription.title,
        warnings,
      };
    }

    if (intent.targetMeters != null && prescription.sport === "SWIM") {
      const prescriptionTotal =
        [...prescription.warmup, ...prescription.main, ...prescription.cooldown].reduce(
          (sum, s) => sum + (s.distanceM ?? 0),
          0
        );
      if (prescriptionTotal !== intent.targetMeters) {
        logInfo("coach-brain.save", {
          reason: "targetMeters mismatch; not saving template",
          targetMeters: intent.targetMeters,
          prescriptionTotal,
        });
        return {
          success: false,
          error: "Prescription total meters does not match request; use chat for custom workout.",
        };
      }
    }

    const mode: SaveWorkoutMode =
      intent.replaceIntent || intent.targetMeters != null ? "replace" : "upsert";
    const saveReason =
      intent.replaceIntent
        ? "user asked to change/replace"
        : intent.targetMeters != null
          ? "user requested specific meters"
          : "default rubric (no targetMeters)";
    const saveResult = await saveWorkoutIdempotent(userId, prescription, {
      createSeparate: intent.createSeparate,
      source: options.source ?? "AI",
      includeResultTemplate,
      mode,
      reason: saveReason,
      targetMeters: intent.targetMeters ?? undefined,
    });

    return {
      success: true,
      workoutId: saveResult.workoutId,
      created: saveResult.created,
      createdWorkoutIds: [saveResult.workoutId],
      markdown,
      title: prescription.title,
      warnings,
    };
  } catch (err) {
    logError("coach-brain.generateAndSaveWorkout.failed", { userId }, err instanceof Error ? err : undefined);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Generation failed",
    };
  }
}

/**
 * Convert rubric to calendar-insert item (descriptionMd + prescriptionJson). Public API.
 */
export function rubricToCalendarItem(prescription: WorkoutRubricPrescription): {
  date: string;
  sport: "SWIM" | "BIKE" | "RUN" | "STRENGTH";
  title: string;
  durationMin: number;
  descriptionMd: string;
  prescriptionJson: Record<string, unknown>;
} {
  const { descriptionMd, prescriptionJson } = rubricToCalendarItemInternal(prescription);
  return {
    date: prescription.date,
    sport: prescription.sport,
    title: prescription.title,
    durationMin: prescription.durationMin,
    descriptionMd,
    prescriptionJson,
  };
}
