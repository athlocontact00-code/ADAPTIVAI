/**
 * AI Coach Brain — unified entry point for generate + adapt + save.
 * Enforces workout quality rubric, readiness adaptation, guardrails, idempotent save.
 * No new UI; used by coach-chat and calendar insertion.
 */

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

const MAX_HARD_SESSIONS_PER_WEEK = 2;
const RAMP_THRESHOLD = DEFAULT_RAMP_THRESHOLD;

export type CoachBrainContext = {
  aiContext: AIContext;
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

  const isSingleRequest =
    isAddWorkoutRequest(lower) ||
    /\b(give me|get me|plan|schedule|add|create|want)\s+(a\s+)?(run|bike|swim|strength|workout|session)\b/i.test(lower) ||
    (sport !== undefined && /\b(for|on|tomorrow|today)\b/.test(lower));

  if (!isSingleRequest && !sport) return null;

  return {
    kind: "single",
    sport: sport ?? "RUN",
    date: dateStr,
    addToCalendar: !noCalendar,
    createSeparate,
    durationMinHint,
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

  const { warmup, main, cooldown, techniqueCues, intensityTargets, goal, title } = buildBlocksBySport(
    sport,
    intensity,
    warmupMin,
    mainMin,
    cooldownMin,
    context
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
  const variantB = "Low-energy day: reduce main set by 20% or swap to easy effort only.";

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
    rationale,
    why,
  };
}

function buildBlocksBySport(
  sport: RubricSport,
  intensity: string,
  warmupMin: number,
  mainMin: number,
  cooldownMin: number,
  context: CoachBrainContext
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
    return {
      title: "Technique & Endurance Swim",
      goal: "Stroke efficiency and aerobic capacity.",
      warmup: [
        { description: `${poolLen * 2}m easy swim`, durationMin: 3 },
        { description: "Drills: 4x50m (e.g. catch-up, fist)", durationMin: 5 },
        { description: "Build to steady", durationMin: warmupMin - 8 },
      ],
      main: [
        {
          description: `Steady swim, focus on form. ${poolLen}m pool: count laps.`,
          durationMin: mainMin,
          intensityTarget: { rpe, zone: "Z2" },
        },
      ],
      cooldown: [
        { description: "Easy 100m", durationMin: 2 },
        { description: "Stretch shoulders", durationMin: cooldownMin - 2 },
      ],
      techniqueCues: ["High elbow catch", "Rotate from hips", "Breathe bilaterally", "Relaxed kick"],
      intensityTargets: { rpe, pace: "per 100m comfortable" },
    };
  }

  // STRENGTH
  return {
    title: "Full Body Strength",
    goal: "Maintain strength and injury resilience.",
    warmup: [
      { description: "5 min light cardio or dynamic mobility", durationMin: 5 },
      { description: "Joint circles and activation", durationMin: warmupMin - 5 },
    ],
    main: [
      {
        description: "Compound lifts: squat pattern, hinge, push, pull. 2–3 sets, 8–12 reps, RPE 6–7.",
        durationMin: mainMin,
        intensityTarget: { rpe: "RPE 6–7" },
      },
    ],
    cooldown: [
      { description: "Stretch major muscle groups", durationMin: cooldownMin },
    ],
    techniqueCues: ["Brace core", "Controlled tempo", "Full range of motion", "Rest 60–90 s between sets"],
    intensityTargets: { rpe: "RPE 6–7" },
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
 * Format prescription as markdown for user (explainLevel: minimal | standard | deep).
 */
export function formatPrescriptionMarkdown(
  prescription: WorkoutRubricPrescription,
  explainLevel: "minimal" | "standard" | "deep"
): string {
  const lines: string[] = [];
  lines.push(`## ${prescription.title}`);
  lines.push("");
  lines.push(`**Goal:** ${prescription.goal}`);
  lines.push(`**Duration:** ${prescription.durationMin} min`);
  lines.push("");

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
  lines.push("");
  lines.push("**Success criteria:** " + (prescription.successCriteria ?? "Complete warm-up, main set, and cool-down within targets."));
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
function rubricToCalendarItemInternal(prescription: WorkoutRubricPrescription): {
  descriptionMd: string;
  prescriptionJson: Record<string, unknown>;
} {
  const descriptionMd = formatPrescriptionMarkdown(prescription, "standard");
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

/**
 * Idempotent save: find by (userId, date same day, type); if exists and !createSeparate, update; else create.
 * Returns { workoutId, created }.
 */
export async function saveWorkoutIdempotent(
  userId: string,
  prescription: WorkoutRubricPrescription,
  options: { createSeparate?: boolean; source?: string } = {}
): Promise<{ workoutId: string; created: boolean }> {
  const date = parseDateToLocalNoon(prescription.date);
  const type = sportToType(prescription.sport);
  const dayStart = startOfDay(date);
  const dayEnd = addDays(dayStart, 1);

  const existing = await db.workout.findFirst({
    where: {
      userId,
      date: { gte: dayStart, lt: dayEnd },
      type,
    },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });

  const item = rubricToCalendarItemInternal(prescription);
  const source = options.source ?? "AI";

  if (existing && !options.createSeparate) {
    await db.workout.update({
      where: { id: existing.id },
      data: {
        title: prescription.title,
        durationMin: prescription.durationMin,
        descriptionMd: item.descriptionMd,
        prescriptionJson: JSON.stringify(item.prescriptionJson),
        source,
        aiGenerated: true,
        planned: true,
      },
    });
    return { workoutId: existing.id, created: false };
  }

  const created = await db.workout.create({
    data: {
      userId,
      title: prescription.title,
      type,
      date,
      durationMin: prescription.durationMin,
      planned: true,
      completed: false,
      aiGenerated: true,
      source,
      descriptionMd: item.descriptionMd,
      prescriptionJson: JSON.stringify(item.prescriptionJson),
    },
    select: { id: true },
  });
  return { workoutId: created.id, created: true };
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

    let prescription = generateRubricPrescription(intent, ctx);
    prescription = applyReadinessAdaptation(prescription, ctx);
    const { prescription: validated, warnings } = validateGuardrails(prescription, ctx);
    prescription = validated;

    const explainLevel = options.explainLevel ?? "standard";
    const markdown = formatPrescriptionMarkdown(prescription, explainLevel);

    const addToCalendar = options.addToCalendar !== false && intent.addToCalendar;
    if (!addToCalendar) {
      return {
        success: true,
        markdown,
        title: prescription.title,
        warnings,
      };
    }

    const { workoutId, created } = await saveWorkoutIdempotent(userId, prescription, {
      createSeparate: intent.createSeparate,
      source: options.source ?? "AI",
    });

    console.log("[coach-brain] save", {
      userId,
      workoutId,
      created,
      sport: prescription.sport,
      date: prescription.date,
      title: prescription.title,
    });

    return {
      success: true,
      workoutId,
      created,
      createdWorkoutIds: [workoutId],
      markdown,
      title: prescription.title,
      warnings,
    };
  } catch (err) {
    console.error("[coach-brain] generateAndSaveWorkout failed:", err);
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
