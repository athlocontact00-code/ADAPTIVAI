"use server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { track } from "@/lib/analytics/events";
import { createRequestId, logError, logInfo } from "@/lib/logger";
import {
  evaluatePreTraining,
  calculateReadinessScore,
  detectPatterns,
  type CheckInData,
  type TrainingContext,
  type EvaluationResult,
  type MuscleSoreness,
  type AIDecision,
  type DetectedPattern,
} from "@/lib/services/daily-checkin.service";
import {
  createPlanChangeProposal,
  type ProposalPatch,
} from "@/lib/actions/plan-rigidity";
import { isWorkoutLocked, type PlanRigiditySetting } from "@/lib/services/plan-rigidity.service";
import { isOpenAIAvailable } from "@/lib/services/openai-coach";
import { addDays, formatLocalDateInput } from "@/lib/utils";
import {
  calculatePremiumReadiness,
  type PremiumCheckinInput,
  type PremiumReadinessResult,
} from "@/lib/utils/premium-readiness";

type DailyCheckInRow = {
  id: string;
  userId: string;
  date: Date;
  sleepDuration: number;
  sleepQuality: number;
  physicalFatigue: number;
  mentalReadiness: number;
  motivation: number;
  muscleSoreness: MuscleSoreness;
  stressLevel: number;
  notes: string | null;
  readinessScore: number | null;
  aiDecision: string | null;
  aiConfidence: number | null;
  aiExplanation: string | null;
  userAccepted: boolean | null;
  userOverrideReason: string | null;
};

type DailyCheckInDelegate = {
  findMany: (args: unknown) => Promise<DailyCheckInRow[]>;
};

const checkInDb = db as unknown as { dailyCheckIn: DailyCheckInDelegate };

export interface SaveCheckInInput {
  sleepDuration: number;
  sleepQuality: number;
  physicalFatigue: number;
  mentalReadiness: number;
  motivation: number;
  muscleSoreness: MuscleSoreness;
  stressLevel: number;
  notes?: string;
  workoutId?: string;
}

export type CheckInRecommendationType =
  | "keep"
  | "reduce_intensity"
  | "reduce_volume"
  | "swap_session"
  | "rest";

export type CheckInWorkoutSnapshot = {
  id?: string;
  title: string;
  type: string;
  durationMin?: number | null;
  tss?: number | null;
  descriptionMd?: string | null;
  prescriptionJson?: string | null;
  notes?: string | null;
};

export type CheckInRecommendation = {
  readiness_score: number;
  key_factors: string[];
  recommendation_type: CheckInRecommendationType;
  explanation: string;
  changes: {
    apply: boolean;
    requires_confirmation: boolean;
    before: CheckInWorkoutSnapshot | null;
    after: CheckInWorkoutSnapshot | null;
    rationale: string[];
  };
  coach_message: string;
};

const checkInWorkoutSchema = z.object({
  title: z.string().min(1),
  type: z.string().min(1),
  durationMin: z.number().min(0).optional().nullable(),
  tss: z.number().min(0).optional().nullable(),
  descriptionMd: z.string().optional().nullable(),
  prescriptionJson: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

const checkInRecommendationSchema = z.object({
  readiness_score: z.number().min(0).max(100),
  key_factors: z.array(z.string()).max(6),
  recommendation_type: z.enum([
    "keep",
    "reduce_intensity",
    "reduce_volume",
    "swap_session",
    "rest",
  ]),
  explanation: z.string().min(1),
  changes: z.object({
    apply: z.boolean(),
    requires_confirmation: z.boolean(),
    before: checkInWorkoutSchema.nullable().optional(),
    after: checkInWorkoutSchema.nullable().optional(),
    rationale: z.array(z.string()).optional().default([]),
  }),
  coach_message: z.string().min(1),
});

function extractJsonBlock(raw: string): string | null {
  const trimmed = raw.trim();
  if (trimmed.startsWith("{") && trimmed.endsWith("}")) return trimmed;
  const match = trimmed.match(/\{[\s\S]*\}/);
  return match ? match[0] : null;
}

function mapRecommendationToDecision(type: CheckInRecommendationType): AIDecision {
  switch (type) {
    case "reduce_intensity":
      return "REDUCE_INTENSITY";
    case "reduce_volume":
      return "SHORTEN";
    case "swap_session":
      return "SWAP_RECOVERY";
    case "rest":
      return "REST";
    default:
      return "PROCEED";
  }
}

function buildBeforeSnapshot(workout: {
  id: string;
  title: string;
  type: string;
  durationMin: number | null;
  tss: number | null;
  descriptionMd?: string | null;
  prescriptionJson?: string | null;
  notes?: string | null;
} | null): CheckInWorkoutSnapshot | null {
  if (!workout) return null;
  return {
    id: workout.id,
    title: workout.title,
    type: workout.type,
    durationMin: workout.durationMin ?? null,
    tss: workout.tss ?? null,
    descriptionMd: workout.descriptionMd ?? null,
    prescriptionJson: workout.prescriptionJson ?? null,
    notes: workout.notes ?? null,
  };
}

function buildSwapSuggestion(before: CheckInWorkoutSnapshot): CheckInWorkoutSnapshot {
  const baseType = before.type.toLowerCase();
  if (baseType.includes("run")) {
    return { ...before, type: "bike", title: "Easy Z2 Bike", tss: before.tss ? Math.max(20, Math.round(before.tss * 0.6)) : before.tss };
  }
  if (baseType.includes("bike")) {
    return { ...before, type: "run", title: "Easy Run", tss: before.tss ? Math.max(15, Math.round(before.tss * 0.6)) : before.tss };
  }
  if (baseType.includes("swim")) {
    return { ...before, type: "bike", title: "Recovery Spin", tss: before.tss ? Math.max(15, Math.round(before.tss * 0.6)) : before.tss };
  }
  return { ...before, title: "Recovery Session", tss: before.tss ? Math.max(15, Math.round(before.tss * 0.6)) : before.tss };
}

function buildAfterSnapshot(
  before: CheckInWorkoutSnapshot | null,
  rec: CheckInRecommendation
): CheckInWorkoutSnapshot | null {
  if (!before) return null;
  const overlay = rec.changes.after ?? null;
  let merged: CheckInWorkoutSnapshot = { ...before, ...(overlay ?? {}) };

  if (rec.recommendation_type === "reduce_intensity") {
    if (typeof merged.tss === "number") merged.tss = Math.max(1, Math.round(merged.tss * 0.85));
  }
  if (rec.recommendation_type === "reduce_volume") {
    if (typeof merged.durationMin === "number") {
      merged.durationMin = Math.max(20, Math.round(merged.durationMin * 0.7));
    }
    if (typeof merged.tss === "number") merged.tss = Math.max(1, Math.round(merged.tss * 0.7));
  }
  if (rec.recommendation_type === "swap_session") {
    merged = buildSwapSuggestion(merged);
  }
  if (rec.recommendation_type === "rest") {
    merged = { ...merged, type: "rest", title: "Rest + mobility", durationMin: 0, tss: 0 };
  }

  if (merged.type !== "rest" && (merged.durationMin == null || merged.durationMin <= 0)) {
    merged.durationMin = Math.max(20, before.durationMin ?? 40);
  }

  return merged;
}

async function callCheckInCoach(params: {
  checkIn: CheckInData;
  plannedWorkout: CheckInWorkoutSnapshot | null;
  last7Summary: {
    totalDurationMin: number;
    totalTss: number;
    compliancePercent: number;
  };
  constraints: {
    weeklyHoursGoal: number | null;
    experienceLevel: string | null;
    zones: Record<string, number | null>;
  };
  guardrails: {
    rampRate: number | null;
    riskStatus: string | null;
    warnings: string[];
  };
}): Promise<CheckInRecommendation | null> {
  if (!isOpenAIAvailable()) return null;

  const system = [
    "You are a premium endurance coach. Return ONLY valid JSON.",
    "Follow this schema exactly:",
    "{",
    '  "readiness_score": 0-100,',
    '  "key_factors": ["sleep low", "stress high"],',
    '  "recommendation_type": "keep" | "reduce_intensity" | "reduce_volume" | "swap_session" | "rest",',
    '  "explanation": "short, concrete",',
    '  "changes": {',
    '    "apply": true/false,',
    '    "requires_confirmation": true/false,',
    '    "before": { "title": "...", "type": "...", "durationMin": 60, "tss": 50 },',
    '    "after": { "title": "...", "type": "...", "durationMin": 45, "tss": 40 },',
    '    "rationale": ["...","..."]',
    "  },",
    '  "coach_message": "coach-style guidance"',
    "}",
    "If there is no planned workout, set recommendation_type to keep and changes.apply=false.",
  ].join("\n");

  const user = [
    `Check-in:`,
    `sleepDuration=${params.checkIn.sleepDuration}h, sleepQuality=${params.checkIn.sleepQuality}/5, fatigue=${params.checkIn.physicalFatigue}/5, soreness=${params.checkIn.muscleSoreness}, mental=${params.checkIn.mentalReadiness}/5, motivation=${params.checkIn.motivation}/5, stress=${params.checkIn.stressLevel}/5`,
    params.checkIn.notes ? `note=${params.checkIn.notes}` : "note=none",
    "",
    `Planned workout for today:`,
    params.plannedWorkout
      ? JSON.stringify(params.plannedWorkout)
      : "none",
    "",
    `Last 7 days summary:`,
    `volume=${Math.round((params.last7Summary.totalDurationMin / 60) * 10) / 10}h, TSS=${params.last7Summary.totalTss}, compliance=${params.last7Summary.compliancePercent}%`,
    "",
    `Constraints: weeklyHoursGoal=${params.constraints.weeklyHoursGoal ?? "n/a"}, experience=${params.constraints.experienceLevel ?? "n/a"}, zones=${JSON.stringify(params.constraints.zones)}`,
    "",
    `Guardrails: rampRate=${params.guardrails.rampRate ?? "n/a"}, status=${params.guardrails.riskStatus ?? "n/a"}, warnings=${params.guardrails.warnings.join("; ") || "none"}`,
  ].join("\n");

  const key = process.env.OPENAI_API_KEY;
  if (!key || key.length < 10) return null;

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model: "gpt-4.1",
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      temperature: 0.3,
      max_tokens: 500,
    }),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`OpenAI error: ${response.status} ${text}`);
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = data.choices?.[0]?.message?.content;
  if (!content || typeof content !== "string") {
    throw new Error("OpenAI returned empty response");
  }

  const jsonBlock = extractJsonBlock(content);
  if (!jsonBlock) {
    throw new Error("OpenAI returned invalid JSON");
  }

  const parsed = JSON.parse(jsonBlock);
  const result = checkInRecommendationSchema.safeParse(parsed);
  if (!result.success) {
    throw new Error("AI response failed schema validation");
  }

  const parsedData = result.data;
  return {
    ...parsedData,
    changes: {
      ...parsedData.changes,
      before: parsedData.changes.before ?? null,
      after: parsedData.changes.after ?? null,
    },
  };
}

// ============================================
// PRE-TRAINING GATE (Calendar workout detail)
// ============================================

export async function getPreTrainingGateStatus(workoutId: string): Promise<{
  success: boolean;
  error?: string;
  data?: {
    workoutId: string;
    workoutDate: Date;
    required: boolean;
    checkInDone: boolean;
    checkInId: string | null;
    aiDecision: string | null;
    aiExplanation: string | null;
    skipped: boolean;
    skipReason: string | null;
  };
}> {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: "Unauthorized" };

  const workout = await db.workout.findFirst({
    where: { id: workoutId, userId: session.user.id },
    select: { id: true, date: true, planned: true, completed: true },
  });
  if (!workout) return { success: false, error: "Workout not found" };

  const start = new Date(workout.date);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);

  const checkIn = await db.dailyCheckIn.findFirst({
    where: {
      userId: session.user.id,
      date: { gte: start, lt: end },
    },
    select: { id: true, aiDecision: true, aiExplanation: true },
  });

  const skipAudit = await db.auditLog.findFirst({
    where: {
      userId: session.user.id,
      actionType: "PRETRAINING_SKIPPED",
      targetType: "WORKOUT",
      targetId: workoutId,
    },
    orderBy: { createdAt: "desc" },
  });

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const required = workout.planned && !workout.completed && start.getTime() === today.getTime();

  let skipReason: string | null = null;
  if (skipAudit?.detailsJson) {
    try {
      const parsed = JSON.parse(skipAudit.detailsJson);
      skipReason = typeof parsed?.reason === "string" ? parsed.reason : null;
    } catch {
      skipReason = null;
    }
  }

  return {
    success: true,
    data: {
      workoutId,
      workoutDate: workout.date,
      required,
      checkInDone: !!checkIn,
      checkInId: checkIn?.id ?? null,
      aiDecision: checkIn?.aiDecision ?? null,
      aiExplanation: checkIn?.aiExplanation ?? null,
      skipped: !!skipAudit,
      skipReason,
    },
  };
}

export async function skipPreTrainingCheck(workoutId: string, reason: string): Promise<{ success: boolean; error?: string }> {
  const requestId = createRequestId();
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: "Unauthorized" };

  const trimmed = reason.trim();
  if (trimmed.length < 3) return { success: false, error: "Skip reason is required" };

  const workout = await db.workout.findFirst({
    where: { id: workoutId, userId: session.user.id },
    select: { id: true, date: true },
  });
  if (!workout) return { success: false, error: "Workout not found" };

  logInfo("pretraining.skip", {
    requestId,
    userId: session.user.id,
    action: "skipPreTrainingCheck",
    workoutId,
  });

  await db.auditLog.create({
    data: {
      userId: session.user.id,
      actorUserId: session.user.id,
      actionType: "PRETRAINING_SKIPPED",
      targetType: "WORKOUT",
      targetId: workoutId,
      summary: "Skipped pre-training check",
      detailsJson: JSON.stringify({ reason: trimmed, workoutDate: workout.date }),
    },
  });

  await track({
    name: "checkin_skipped",
    userId: session.user.id,
    requestId,
    route: "/calendar",
    source: "pretraining_gate",
    properties: { workoutId },
  });

  revalidatePath("/calendar");
  revalidatePath("/dashboard");
  return { success: true };
}

export interface CheckInResult {
  success: boolean;
  error?: string;
  checkInId?: string;
  recommendation?: CheckInRecommendation;
  readinessScore?: number;
  analysisStatus?: "ok" | "error";
  analysisError?: string;
}

/**
 * Check if today's check-in exists
 */
export async function getTodayCheckIn() {
  const session = await auth();
  if (!session?.user?.id) {
    return null;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const checkIn = await db.dailyCheckIn.findUnique({
    where: {
      userId_date: {
        userId: session.user.id,
        date: today,
      },
    },
  });

  return checkIn;
}

/**
 * Check if user needs to complete check-in (has workout today but no check-in)
 */
export async function needsCheckIn(): Promise<{
  required: boolean;
  workout: { id: string; title: string; type: string; duration: number; tss: number } | null;
}> {
  const session = await auth();
  if (!session?.user?.id) {
    return { required: false, workout: null };
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  // Check for today's workout
  const todayWorkout = await db.workout.findFirst({
    where: {
      userId: session.user.id,
      date: {
        gte: today,
        lt: tomorrow,
      },
      completed: false,
    },
  });

  if (!todayWorkout) {
    return { required: false, workout: null };
  }

  // Check if check-in already exists
  const existingCheckIn = await db.dailyCheckIn.findUnique({
    where: {
      userId_date: {
        userId: session.user.id,
        date: today,
      },
    },
  });

  if (existingCheckIn) {
    return { required: false, workout: null };
  }

  return {
    required: true,
    workout: {
      id: todayWorkout.id,
      title: todayWorkout.title,
      type: todayWorkout.type,
      duration: todayWorkout.durationMin || 60,
      tss: todayWorkout.tss || 50,
    },
  };
}

/**
 * Save daily check-in and get AI evaluation
 */
export async function saveCheckIn(input: SaveCheckInInput): Promise<CheckInResult> {
  const requestId = createRequestId();
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized" };
    }

    const userId = session.user.id;

    logInfo("checkin.submit.started", {
      requestId,
      userId,
      action: "saveCheckIn",
      workoutId: input.workoutId ?? null,
    });
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Get training context for evaluation
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const sevenDaysAgo = addDays(today, -6);
    const fourteenDaysAgo = addDays(today, -13);

    const [todayMetrics, yesterdayMetrics, todayWorkout, profile, recentWorkouts] = await Promise.all([
      db.metricDaily.findUnique({
        where: { userId_date: { userId, date: today } },
      }),
      db.metricDaily.findFirst({
        where: {
          userId,
          date: { lt: today },
        },
        orderBy: { date: "desc" },
      }),
      input.workoutId
        ? db.workout.findUnique({ where: { id: input.workoutId } })
        : db.workout.findFirst({
            where: {
              userId,
              date: { gte: today, lt: tomorrow },
            },
          }),
      db.profile.findUnique({
        where: { userId },
        select: {
          weeklyHoursGoal: true,
          experienceLevel: true,
          zone1Min: true,
          zone1Max: true,
          zone2Min: true,
          zone2Max: true,
          zone3Min: true,
          zone3Max: true,
          zone4Min: true,
          zone4Max: true,
          zone5Min: true,
          zone5Max: true,
        },
      }),
      db.workout.findMany({
        where: {
          userId,
          date: { gte: fourteenDaysAgo, lt: tomorrow },
        },
        select: {
          id: true,
          date: true,
          planned: true,
          completed: true,
          durationMin: true,
          tss: true,
        },
      }),
    ]);

    // Build check-in data
    const checkInData: CheckInData = {
      sleepDuration: input.sleepDuration,
      sleepQuality: input.sleepQuality,
      physicalFatigue: input.physicalFatigue,
      mentalReadiness: input.mentalReadiness,
      motivation: input.motivation,
      muscleSoreness: input.muscleSoreness,
      stressLevel: input.stressLevel,
      notes: input.notes,
    };

    // Build training context
    const trainingContext: TrainingContext = {
      ctl: todayMetrics?.ctl || 50,
      atl: todayMetrics?.atl || 50,
      tsb: todayMetrics?.tsb || 0,
      yesterdayTSS: yesterdayMetrics?.tss || 0,
      plannedTSS: todayWorkout?.tss || 50,
      plannedDuration: todayWorkout?.durationMin || 60,
      workoutType: todayWorkout?.type || "run",
    };

    const fallbackEvaluation = evaluatePreTraining(checkInData, trainingContext);
    const readinessScore = calculateReadinessScore(checkInData);

    const plannedSnapshot = buildBeforeSnapshot(
      todayWorkout
        ? {
            id: todayWorkout.id,
            title: todayWorkout.title,
            type: todayWorkout.type,
            durationMin: todayWorkout.durationMin ?? null,
            tss: todayWorkout.tss ?? null,
            descriptionMd: todayWorkout.descriptionMd ?? null,
            prescriptionJson: todayWorkout.prescriptionJson ?? null,
            notes: todayWorkout.notes ?? null,
          }
        : null
    );

    const last7Workouts = recentWorkouts.filter((w) => {
      const d = new Date(w.date);
      return d >= sevenDaysAgo && d < tomorrow;
    });
    const last7Completed = last7Workouts.filter((w) => w.completed);
    const last7Planned = last7Workouts.filter((w) => w.planned);

    const last7Summary = {
      totalDurationMin: last7Completed.reduce((sum, w) => sum + (w.durationMin || 0), 0),
      totalTss: last7Completed.reduce((sum, w) => sum + (w.tss || 0), 0),
      compliancePercent: Math.round((last7Planned.filter((w) => w.completed).length / Math.max(1, last7Planned.length)) * 100),
    };

    const prev7Workouts = recentWorkouts.filter((w) => {
      const d = new Date(w.date);
      return d >= fourteenDaysAgo && d < sevenDaysAgo;
    });
    const prev7Tss = prev7Workouts.reduce((sum, w) => sum + (w.completed ? (w.tss || 0) : 0), 0);
    const current7Tss = last7Completed.reduce((sum, w) => sum + (w.tss || 0), 0);
    const rampRate = prev7Tss > 0 ? current7Tss / prev7Tss : null;

    let recommendation: CheckInRecommendation | null = null;
    let analysisStatus: "ok" | "error" = "ok";
    let analysisError: string | null = null;

    try {
      const aiRec = await callCheckInCoach({
        checkIn: checkInData,
        plannedWorkout: plannedSnapshot,
        last7Summary,
        constraints: {
          weeklyHoursGoal: profile?.weeklyHoursGoal ?? null,
          experienceLevel: profile?.experienceLevel ?? null,
          zones: {
            zone1Min: profile?.zone1Min ?? null,
            zone1Max: profile?.zone1Max ?? null,
            zone2Min: profile?.zone2Min ?? null,
            zone2Max: profile?.zone2Max ?? null,
            zone3Min: profile?.zone3Min ?? null,
            zone3Max: profile?.zone3Max ?? null,
            zone4Min: profile?.zone4Min ?? null,
            zone4Max: profile?.zone4Max ?? null,
            zone5Min: profile?.zone5Min ?? null,
            zone5Max: profile?.zone5Max ?? null,
          },
        },
        guardrails: {
          rampRate,
          riskStatus: rampRate !== null && rampRate >= 1.3 ? "HIGH" : "NORMAL",
          warnings: rampRate !== null && rampRate >= 1.3 ? ["High ramp rate vs last week"] : [],
        },
      });

      if (aiRec) {
        const normalized: CheckInRecommendation = {
          ...aiRec,
          key_factors: aiRec.key_factors.slice(0, 4),
          changes: {
            apply: aiRec.recommendation_type === "keep" ? false : aiRec.changes.apply,
            requires_confirmation: aiRec.changes.requires_confirmation,
            before: plannedSnapshot,
            after: aiRec.recommendation_type === "keep" ? plannedSnapshot : buildAfterSnapshot(plannedSnapshot, aiRec),
            rationale: aiRec.changes.rationale ?? [],
          },
        };
        recommendation = normalized;
      }
    } catch (error) {
      analysisStatus = "error";
      analysisError = "We couldn’t analyze, keep original workout.";
      logError("checkin.ai.failed", {
        requestId,
        action: "saveCheckIn",
        error: error instanceof Error ? error.message : String(error),
      });
    }

    const decisionSource = recommendation
      ? mapRecommendationToDecision(recommendation.recommendation_type)
      : fallbackEvaluation.decision;
    const confidenceSource = recommendation
      ? Math.max(55, Math.min(90, Math.round(recommendation.readiness_score)))
      : fallbackEvaluation.confidence;
    const explanationSource = recommendation
      ? recommendation.coach_message
      : fallbackEvaluation.explanation;
    const reasonJson = recommendation
      ? JSON.stringify({ ...recommendation, analysisStatus })
      : JSON.stringify(fallbackEvaluation.reasons);

    // Save check-in with AI decision
    const checkIn = await db.dailyCheckIn.upsert({
      where: {
        userId_date: {
          userId,
          date: today,
        },
      },
      update: {
        sleepDuration: input.sleepDuration,
        sleepQuality: input.sleepQuality,
        physicalFatigue: input.physicalFatigue,
        mentalReadiness: input.mentalReadiness,
        motivation: input.motivation,
        muscleSoreness: input.muscleSoreness,
        stressLevel: input.stressLevel,
        readinessScore: recommendation?.readiness_score ?? readinessScore,
        notes: input.notes,
        workoutId: todayWorkout?.id,
        mood: input.mentalReadiness,
        energy: 6 - input.physicalFatigue, // Inverse
        aiDecision: decisionSource,
        aiReasonJson: reasonJson,
        aiConfidence: confidenceSource,
        aiExplanation: explanationSource,
        originalWorkoutJson: todayWorkout ? JSON.stringify(todayWorkout) : null,
      },
      create: {
        userId,
        date: today,
        sleepDuration: input.sleepDuration,
        sleepQuality: input.sleepQuality,
        physicalFatigue: input.physicalFatigue,
        mentalReadiness: input.mentalReadiness,
        motivation: input.motivation,
        muscleSoreness: input.muscleSoreness,
        stressLevel: input.stressLevel,
        readinessScore: recommendation?.readiness_score ?? readinessScore,
        notes: input.notes,
        workoutId: todayWorkout?.id,
        mood: input.mentalReadiness,
        energy: 6 - input.physicalFatigue,
        aiDecision: decisionSource,
        aiReasonJson: reasonJson,
        aiConfidence: confidenceSource,
        aiExplanation: explanationSource,
        originalWorkoutJson: todayWorkout ? JSON.stringify(todayWorkout) : null,
      },
    });

    revalidatePath("/dashboard");
    revalidatePath("/calendar");

    await track({
      name: "checkin_submitted",
      userId,
      requestId,
      route: "/calendar",
      source: "daily_checkin",
      properties: {
        hasWorkoutId: !!input.workoutId,
        decision: decisionSource,
        confidence: confidenceSource,
        readinessScore: recommendation?.readiness_score ?? readinessScore,
      },
    });

    logInfo("checkin.submit.succeeded", {
      requestId,
      userId,
      action: "saveCheckIn",
      checkInId: checkIn.id,
      decision: decisionSource,
      confidence: confidenceSource,
      readinessScore: recommendation?.readiness_score ?? readinessScore,
    });

    return {
      success: true,
      checkInId: checkIn.id,
      recommendation: recommendation ?? undefined,
      readinessScore: recommendation?.readiness_score ?? readinessScore,
      analysisStatus,
      analysisError: analysisError ?? undefined,
    };
  } catch (error) {
    logError("checkin.submit.failed", {
      requestId,
      action: "saveCheckIn",
      error: error instanceof Error ? error.message : String(error),
    });
    return { success: false, error: "Failed to save check-in" };
  }
}

/**
 * Accept AI recommendation
 */
export async function acceptAIRecommendation(
  checkInId: string
): Promise<
  | { success: true; proposalId?: string; applied?: boolean; workoutId?: string }
  | { success: false; error: string }
> {
  const requestId = createRequestId();
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized" };
    }

    logInfo("checkin.accept.started", {
      requestId,
      userId: session.user.id,
      action: "acceptAIRecommendation",
      checkInId,
    });

    const checkIn = await db.dailyCheckIn.findUnique({
      where: { id: checkInId },
    });

    if (!checkIn || checkIn.userId !== session.user.id) {
      return { success: false, error: "Check-in not found" };
    }

    if (checkIn.lockedAt) {
      return { success: false, error: "Check-in is locked" };
    }

    const profile = await db.profile.findUnique({
      where: { userId: session.user.id },
      select: { planRigidity: true },
    });
    const planRigidity = (profile?.planRigidity as PlanRigiditySetting) || "LOCKED_1_DAY";
    let appliedResult: { applied: boolean; workoutId?: string } | null = null;

    // Apply deterministic workout adaptation (user-visible) based on AI decision
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const targetWorkout = checkIn.workoutId
      ? await db.workout.findUnique({ where: { id: checkIn.workoutId } })
      : await db.workout.findFirst({
          where: {
            userId: session.user.id,
            planned: true,
            completed: false,
            date: { gte: today, lt: tomorrow },
          },
          orderBy: { date: "asc" },
        });

    if (targetWorkout && targetWorkout.userId === session.user.id) {
      const parsedRecommendation = (() => {
        if (!checkIn.aiReasonJson) return null;
        try {
          const parsed = JSON.parse(checkIn.aiReasonJson);
          const result = checkInRecommendationSchema.safeParse(parsed);
          if (!result.success) return null;
          const d = result.data;
          return {
            ...d,
            changes: {
              ...d.changes,
              before: d.changes.before ?? null,
              after: d.changes.after ?? null,
            },
          } as CheckInRecommendation;
        } catch {
          return null;
        }
      })();

      if (parsedRecommendation) {
        const before = buildBeforeSnapshot({
          id: targetWorkout.id,
          title: targetWorkout.title,
          type: targetWorkout.type,
          durationMin: targetWorkout.durationMin ?? null,
          tss: targetWorkout.tss ?? null,
          descriptionMd: targetWorkout.descriptionMd ?? null,
          prescriptionJson: targetWorkout.prescriptionJson ?? null,
          notes: targetWorkout.notes ?? null,
        });
        const locked = isWorkoutLocked({ workoutDate: new Date(targetWorkout.date), planRigidity });
        const after = parsedRecommendation.recommendation_type === "keep"
          ? before
          : buildAfterSnapshot(before, parsedRecommendation);

        const shouldApply =
          parsedRecommendation.changes.apply &&
          parsedRecommendation.recommendation_type !== "keep" &&
          !!after;

        if (!shouldApply) {
          await db.dailyCheckIn.update({
            where: { id: checkInId },
            data: {
              userAccepted: true,
              userOverrideReason: null,
            },
          });
          revalidatePath("/dashboard");
          revalidatePath("/calendar");
          return { success: true, applied: false, workoutId: targetWorkout.id };
        }

        const updateData: Prisma.WorkoutUpdateInput = {
          aiGenerated: true,
          aiReason: parsedRecommendation.explanation,
          aiConfidence: typeof checkIn.aiConfidence === "number" ? checkIn.aiConfidence : null,
          source: "daily-checkin",
        };
        const patchUpdate: ProposalPatch["workout"]["update"] = {
          aiGenerated: true,
          aiReason: parsedRecommendation.explanation,
          aiConfidence: typeof checkIn.aiConfidence === "number" ? checkIn.aiConfidence : null,
          source: "daily-checkin",
        };

        if (after?.title) {
          updateData.title = after.title;
          patchUpdate.title = after.title;
        }
        if (after?.type) {
          updateData.type = after.type;
          patchUpdate.type = after.type;
        }
        if (typeof after?.durationMin === "number") {
          updateData.durationMin = after.durationMin;
          patchUpdate.durationMin = after.durationMin;
        }
        if (typeof after?.tss === "number") {
          updateData.tss = after.tss;
          patchUpdate.tss = after.tss;
        }
        if (typeof after?.descriptionMd === "string") {
          updateData.descriptionMd = after.descriptionMd;
          patchUpdate.descriptionMd = after.descriptionMd;
        }
        if (typeof after?.prescriptionJson === "string") {
          updateData.prescriptionJson = after.prescriptionJson;
          patchUpdate.prescriptionJson = after.prescriptionJson;
        }

        if (locked) {
          const patch: ProposalPatch = {
            workout: {
              id: targetWorkout.id,
              update: patchUpdate,
            },
          };

          const proposalRes = await createPlanChangeProposal({
            workoutId: targetWorkout.id,
            checkInId,
            sourceType: "DAILY_CHECKIN",
            confidence: typeof checkIn.aiConfidence === "number" ? checkIn.aiConfidence : undefined,
            summary: "Daily check-in recommends adapting a locked session.",
            patch,
          });

          if (!proposalRes.success || !proposalRes.proposalId) {
            logError("plan_proposal.create.failed", {
              requestId,
              action: "acceptAIRecommendation",
              checkInId,
              error: proposalRes.error || "Failed to create proposal",
            });
            await db.dailyCheckIn.update({
              where: { id: checkInId },
              data: {
                userAccepted: null,
                userOverrideReason: null,
              },
            });

            await db.auditLog.create({
              data: {
                userId: session.user.id,
                actorUserId: session.user.id,
                actionType: "CHECKIN_ACCEPTED_NEEDS_PROPOSAL",
                targetType: "CHECK_IN",
                targetId: checkInId,
                summary: "Acceptance created a proposal due to plan rigidity lock",
                detailsJson: JSON.stringify({
                  recommendationType: parsedRecommendation.recommendation_type,
                  planRigidity,
                  proposalId: proposalRes.proposalId,
                  workoutId: targetWorkout.id,
                }),
              },
            });

            revalidatePath("/dashboard");
            revalidatePath("/calendar");

            return { success: false, error: proposalRes.error || "Failed to create proposal" };
          }

          await track({
            name: "checkin_accepted",
            userId: session.user.id,
            requestId,
            route: "/calendar",
            source: "daily_checkin",
            properties: { checkInId, recommendation: parsedRecommendation.recommendation_type, createdProposal: true },
          });

          await track({
            name: "plan_proposal_shown",
            userId: session.user.id,
            requestId,
            route: "/calendar",
            source: "daily_checkin",
            properties: { proposalId: proposalRes.proposalId, workoutId: targetWorkout.id },
          });

          return { success: true, proposalId: proposalRes.proposalId };
        }

        await db.workout.update({
          where: { id: targetWorkout.id },
          data: updateData,
        });

        await db.auditLog.create({
          data: {
            userId: session.user.id,
            actorUserId: session.user.id,
            actionType: "AI_WORKOUT_ADAPTED",
            targetType: "WORKOUT",
            targetId: targetWorkout.id,
            summary: "Workout adapted based on check-in",
            detailsJson: JSON.stringify({
              before,
              after,
              recommendation: parsedRecommendation.recommendation_type,
            }),
          },
        });

        await db.dailyCheckIn.update({
          where: { id: checkInId },
          data: {
            userAccepted: true,
            userOverrideReason: null,
          },
        });

        revalidatePath("/dashboard");
        revalidatePath("/calendar");

        return { success: true, applied: true, workoutId: targetWorkout.id };
      }

      // Fallback to legacy deterministic behavior if recommendation JSON missing
      const decision = checkIn.aiDecision ? String(checkIn.aiDecision) : null;
      const confidence = typeof checkIn.aiConfidence === "number" ? checkIn.aiConfidence : null;
      const explanation = checkIn.aiExplanation ?? null;

      const baseDuration = targetWorkout.durationMin ?? 60;
      const baseTss = targetWorkout.tss ?? Math.round(baseDuration * 0.8);

      const basePatchUpdate: ProposalPatch["workout"]["update"] = {
        aiGenerated: true,
        aiReason: explanation || "Adapted from daily check-in",
        aiConfidence: typeof confidence === "number" ? confidence : null,
        source: "daily-checkin",
      };

      let updateData: Prisma.WorkoutUpdateInput = { ...basePatchUpdate };
      let patchUpdate: ProposalPatch["workout"]["update"] = { ...basePatchUpdate };

      if (decision === "SHORTEN") {
        const newDuration = Math.max(20, Math.round(baseDuration * 0.7));
        updateData = {
          ...updateData,
          durationMin: newDuration,
          tss: Math.max(1, Math.round(baseTss * 0.7)),
        };
        patchUpdate = {
          ...patchUpdate,
          durationMin: newDuration,
          tss: Math.max(1, Math.round(baseTss * 0.7)),
        };
      } else if (decision === "REDUCE_INTENSITY") {
        updateData = {
          ...updateData,
          tss: Math.max(1, Math.round(baseTss * 0.85)),
        };
        patchUpdate = {
          ...patchUpdate,
          tss: Math.max(1, Math.round(baseTss * 0.85)),
        };
      } else if (decision === "SWAP_RECOVERY") {
        updateData = {
          ...updateData,
          title: "Recovery Session",
          durationMin: Math.min(baseDuration, 40),
          tss: Math.max(1, Math.round(Math.min(baseTss, 30))),
        };
        patchUpdate = {
          ...patchUpdate,
          title: "Recovery Session",
          durationMin: Math.min(baseDuration, 40),
          tss: Math.max(1, Math.round(Math.min(baseTss, 30))),
        };
      } else if (decision === "REST") {
        updateData = {
          ...updateData,
          title: "Rest Day",
          type: "rest",
          durationMin: 0,
          tss: 0,
        };
        patchUpdate = {
          ...patchUpdate,
          title: "Rest Day",
          type: "rest",
          durationMin: 0,
          tss: 0,
        };
      }

      const locked = isWorkoutLocked({ workoutDate: new Date(targetWorkout.date), planRigidity });
      if (locked) {
        const patch: ProposalPatch = {
          workout: {
            id: targetWorkout.id,
            update: patchUpdate,
          },
        };

        const proposalRes = await createPlanChangeProposal({
          workoutId: targetWorkout.id,
          checkInId,
          sourceType: "DAILY_CHECKIN",
          confidence: typeof confidence === "number" ? confidence : undefined,
          summary: "Daily check-in recommends adapting a locked session.",
          patch,
        });

        if (!proposalRes.success || !proposalRes.proposalId) {
          logError("plan_proposal.create.failed", {
            requestId,
            action: "acceptAIRecommendation",
            checkInId,
            error: proposalRes.error || "Failed to create proposal",
          });
          await db.dailyCheckIn.update({
            where: { id: checkInId },
            data: {
              userAccepted: null,
              userOverrideReason: null,
            },
          });

          await db.auditLog.create({
            data: {
              userId: session.user.id,
              actorUserId: session.user.id,
              actionType: "CHECKIN_ACCEPTED_NEEDS_PROPOSAL",
              targetType: "CHECK_IN",
              targetId: checkInId,
              summary: "Acceptance created a proposal due to plan rigidity lock",
              detailsJson: JSON.stringify({
                decision: checkIn.aiDecision,
                confidence: checkIn.aiConfidence,
                planRigidity,
                proposalId: proposalRes.proposalId,
                workoutId: targetWorkout.id,
              }),
            },
          });

          revalidatePath("/dashboard");
          revalidatePath("/calendar");

          return { success: false, error: proposalRes.error || "Failed to create proposal" };
        }

        await track({
          name: "checkin_accepted",
          userId: session.user.id,
          requestId,
          route: "/calendar",
          source: "daily_checkin",
          properties: { checkInId, decision: checkIn.aiDecision, createdProposal: true },
        });

        await track({
          name: "plan_proposal_shown",
          userId: session.user.id,
          requestId,
          route: "/calendar",
          source: "daily_checkin",
          properties: { proposalId: proposalRes.proposalId, workoutId: targetWorkout.id },
        });

        return { success: true, proposalId: proposalRes.proposalId };
      }

      await db.workout.update({
        where: { id: targetWorkout.id },
        data: updateData,
      });
      appliedResult = { applied: true, workoutId: targetWorkout.id };
    }

    await db.dailyCheckIn.update({
      where: { id: checkInId },
      data: {
        userAccepted: true,
        userOverrideReason: null,
      },
    });

    // Log the decision for audit
    await db.auditLog.create({
      data: {
        userId: session.user.id,
        actorUserId: session.user.id,
        actionType: "CHECKIN_ACCEPTED",
        targetType: "CHECK_IN",
        targetId: checkInId,
        summary: `Accepted AI recommendation: ${checkIn.aiDecision}`,
        detailsJson: JSON.stringify({
          decision: checkIn.aiDecision,
          confidence: checkIn.aiConfidence,
          planRigidity,
        }),
      },
    });

    revalidatePath("/dashboard");
    revalidatePath("/calendar");

    await track({
      name: "checkin_accepted",
      userId: session.user.id,
      requestId,
      route: "/calendar",
      source: "daily_checkin",
      properties: { checkInId, decision: checkIn.aiDecision, createdProposal: false },
    });

    logInfo("checkin.accept.succeeded", {
      requestId,
      userId: session.user.id,
      action: "acceptAIRecommendation",
      checkInId,
      decision: checkIn.aiDecision,
    });

    return {
      success: true,
      applied: appliedResult?.applied ?? false,
      workoutId: appliedResult?.workoutId,
    };
  } catch (error) {
    logError("checkin.accept.failed", {
      requestId,
      action: "acceptAIRecommendation",
      checkInId,
      error: error instanceof Error ? error.message : String(error),
    });
    return { success: false, error: "Failed to accept recommendation" };
  }
}

/**
 * Override AI recommendation
 */
export async function overrideAIRecommendation(
  checkInId: string,
  reason?: string
): Promise<{ success: boolean; error?: string }> {
  const requestId = createRequestId();
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized" };
    }

    logInfo("checkin.override.started", {
      requestId,
      userId: session.user.id,
      action: "overrideAIRecommendation",
      checkInId,
      hasReason: typeof reason === "string" && reason.trim().length > 0,
    });

    const checkIn = await db.dailyCheckIn.findUnique({
      where: { id: checkInId },
    });

    if (!checkIn || checkIn.userId !== session.user.id) {
      return { success: false, error: "Check-in not found" };
    }

    if (checkIn.lockedAt) {
      return { success: false, error: "Check-in is locked" };
    }

    await db.dailyCheckIn.update({
      where: { id: checkInId },
      data: {
        userAccepted: false,
        userOverrideReason: reason || "Athlete chose to proceed with original plan",
      },
    });

    // Log the override for audit
    await db.auditLog.create({
      data: {
        userId: session.user.id,
        actorUserId: session.user.id,
        actionType: "CHECKIN_OVERRIDDEN",
        targetType: "CHECK_IN",
        targetId: checkInId,
        summary: `Overrode AI recommendation: ${checkIn.aiDecision}`,
        detailsJson: JSON.stringify({
          decision: checkIn.aiDecision,
          overrideReason: reason,
          readinessAtOverride: checkIn.aiConfidence,
        }),
      },
    });

    // Override behavior signal: if >= 3 overrides in last 7 days, persist a behavioral signal via AuditLog
    const since = new Date();
    since.setDate(since.getDate() - 7);
    const overrideCount = await db.auditLog.count({
      where: {
        userId: session.user.id,
        actionType: "CHECKIN_OVERRIDDEN",
        createdAt: { gte: since },
      },
    });
    if (overrideCount >= 3) {
      const existingSignal = await db.auditLog.findFirst({
        where: {
          userId: session.user.id,
          actionType: "OVERRIDE_BEHAVIOR_SIGNAL",
          createdAt: { gte: since },
        },
        orderBy: { createdAt: "desc" },
      });

      if (!existingSignal) {
        await db.auditLog.create({
          data: {
            userId: session.user.id,
            actorUserId: session.user.id,
            actionType: "OVERRIDE_BEHAVIOR_SIGNAL",
            targetType: "CHECK_IN",
            targetId: null,
            summary: `Override behavior signal: ${overrideCount} overrides in last 7 days`,
            detailsJson: JSON.stringify({ overrideCount7d: overrideCount }),
          },
        });
      }
    }

    revalidatePath("/dashboard");
    revalidatePath("/calendar");

    await track({
      name: "checkin_overridden",
      userId: session.user.id,
      requestId,
      route: "/calendar",
      source: "daily_checkin",
      properties: {
        checkInId,
        hasReason: typeof reason === "string" && reason.trim().length > 0,
      },
    });

    logInfo("checkin.override.succeeded", {
      requestId,
      userId: session.user.id,
      action: "overrideAIRecommendation",
      checkInId,
    });

    return { success: true };
  } catch (error) {
    logError("checkin.override.failed", {
      requestId,
      action: "overrideAIRecommendation",
      checkInId,
      error: error instanceof Error ? error.message : String(error),
    });
    return { success: false, error: "Failed to override recommendation" };
  }
}

/**
 * Undo an applied AI recommendation (restore original workout snapshot)
 */
export async function undoCheckInRecommendation(
  checkInId: string
): Promise<{ success: boolean; error?: string; workoutId?: string }> {
  const requestId = createRequestId();
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized" };
    }

    const checkIn = await db.dailyCheckIn.findUnique({
      where: { id: checkInId },
    });
    if (!checkIn || checkIn.userId !== session.user.id) {
      return { success: false, error: "Check-in not found" };
    }

    if (!checkIn.originalWorkoutJson) {
      return { success: false, error: "No original workout snapshot available" };
    }

    const original = JSON.parse(checkIn.originalWorkoutJson) as {
      id: string;
      title?: string | null;
      type?: string | null;
      durationMin?: number | null;
      distanceKm?: number | null;
      distanceM?: number | null;
      tss?: number | null;
      notes?: string | null;
      descriptionMd?: string | null;
      prescriptionJson?: string | null;
      aiGenerated?: boolean | null;
      aiReason?: string | null;
      aiConfidence?: number | null;
      source?: string | null;
    };

    const workoutId = checkIn.workoutId || original.id;
    if (!workoutId) {
      return { success: false, error: "Workout not found" };
    }

    const workout = await db.workout.findUnique({ where: { id: workoutId } });
    if (!workout || workout.userId !== session.user.id) {
      return { success: false, error: "Workout not found" };
    }

    const updateData: Prisma.WorkoutUpdateInput = {
      title: original.title ?? workout.title,
      type: original.type ?? workout.type,
      durationMin: original.durationMin ?? null,
      distanceKm: original.distanceKm ?? null,
      distanceM: original.distanceM ?? null,
      tss: original.tss ?? null,
      notes: original.notes ?? null,
      descriptionMd: original.descriptionMd ?? null,
      prescriptionJson: original.prescriptionJson ?? null,
      aiGenerated: original.aiGenerated ?? false,
      aiReason: original.aiReason ?? null,
      aiConfidence: original.aiConfidence ?? null,
      source: original.source ?? null,
    };

    await db.workout.update({
      where: { id: workoutId },
      data: updateData,
    });

    await db.dailyCheckIn.update({
      where: { id: checkInId },
      data: {
        userAccepted: false,
        userOverrideReason: "Undo AI adaptation",
      },
    });

    await db.auditLog.create({
      data: {
        userId: session.user.id,
        actorUserId: session.user.id,
        actionType: "CHECKIN_UNDONE",
        targetType: "WORKOUT",
        targetId: workoutId,
        summary: "Reverted workout adaptation from check-in",
        detailsJson: JSON.stringify({ checkInId }),
      },
    });

    revalidatePath("/dashboard");
    revalidatePath("/calendar");

    return { success: true, workoutId };
  } catch (error) {
    logError("checkin.undo.failed", {
      requestId,
      action: "undoCheckInRecommendation",
      checkInId,
      error: error instanceof Error ? error.message : String(error),
    });
    return { success: false, error: "Failed to undo recommendation" };
  }
}

/**
 * Lock check-in when workout starts (immutability)
 */
export async function lockCheckIn(checkInId: string): Promise<{ success: boolean; error?: string }> {
  const requestId = createRequestId();
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized" };
    }

    logInfo("checkin.lock", {
      requestId,
      userId: session.user.id,
      action: "lockCheckIn",
      checkInId,
    });

    await db.dailyCheckIn.update({
      where: { id: checkInId },
      data: {
        lockedAt: new Date(),
      },
    });

    return { success: true };
  } catch (error) {
    logError("checkin.lock_failed", {
      requestId,
      action: "lockCheckIn",
      checkInId,
      error: error instanceof Error ? error.message : String(error),
    });
    return { success: false, error: "Failed to lock check-in" };
  }
}

/**
 * Get weekly check-in summary with pattern detection
 */
export async function getWeeklyCheckInSummary(): Promise<{
  success: boolean;
  data?: {
    checkInCount: number;
    avgReadiness: number;
    avgSleepDuration: number;
    avgMotivation: number;
    avgStress: number;
    patterns: DetectedPattern[];
  };
  error?: string;
}> {
  const requestId = createRequestId();
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized" };
    }

    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);

    const checkIns = await checkInDb.dailyCheckIn.findMany({
      where: {
        userId: session.user.id,
        date: { gte: weekAgo },
      },
      orderBy: { date: "desc" },
    });

    if (checkIns.length === 0) {
      return {
        success: true,
        data: {
          checkInCount: 0,
          avgReadiness: 0,
          avgSleepDuration: 0,
          avgMotivation: 0,
          avgStress: 0,
          patterns: [],
        },
      };
    }

    // Convert to CheckInData for pattern detection
    const checkInData: CheckInData[] = checkIns.map((c) => ({
      sleepDuration: c.sleepDuration,
      sleepQuality: c.sleepQuality,
      physicalFatigue: c.physicalFatigue,
      mentalReadiness: c.mentalReadiness,
      motivation: c.motivation,
      muscleSoreness: c.muscleSoreness,
      stressLevel: c.stressLevel,
      notes: c.notes ?? undefined,
    }));

    // Calculate averages
    const avgSleepDuration = checkIns.reduce((sum, c) => sum + c.sleepDuration, 0) / checkIns.length;
    const avgMotivation = checkIns.reduce((sum, c) => sum + c.motivation, 0) / checkIns.length;
    const avgStress = checkIns.reduce((sum, c) => sum + c.stressLevel, 0) / checkIns.length;

    // Calculate average readiness
    const readinessScores = checkIns.map((c, idx) =>
      typeof c.readinessScore === "number"
        ? c.readinessScore
        : calculateReadinessScore(checkInData[idx])
    );
    const avgReadiness = readinessScores.reduce((sum: number, s: number) => sum + s, 0) / readinessScores.length;

    // Detect patterns
    const patterns = detectPatterns(checkInData);

    return {
      success: true,
      data: {
        checkInCount: checkIns.length,
        avgReadiness: Math.round(avgReadiness),
        avgSleepDuration: Math.round(avgSleepDuration * 10) / 10,
        avgMotivation: Math.round(avgMotivation * 10) / 10,
        avgStress: Math.round(avgStress * 10) / 10,
        patterns,
      },
    };
  } catch (error) {
    logError("checkin.weekly_summary.failed", {
      requestId,
      action: "getWeeklyCheckInSummary",
      error: error instanceof Error ? error.message : String(error),
    });
    return { success: false, error: "Failed to get weekly summary" };
  }
}

/**
 * Get check-in history
 */
export async function getCheckInHistory(days: number = 14) {
  const session = await auth();
  if (!session?.user?.id) {
    return [];
  }

  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const checkIns = await checkInDb.dailyCheckIn.findMany({
    where: {
      userId: session.user.id,
      date: { gte: startDate },
    },
    orderBy: { date: "desc" },
  });

  return checkIns.map((c) => ({
    id: c.id,
    date: c.date.toISOString(),
    sleepDuration: c.sleepDuration,
    sleepQuality: c.sleepQuality,
    physicalFatigue: c.physicalFatigue,
    mentalReadiness: c.mentalReadiness,
    motivation: c.motivation,
    muscleSoreness: c.muscleSoreness,
    stressLevel: c.stressLevel,
    notes: c.notes,
    aiDecision: c.aiDecision,
    aiExplanation: c.aiExplanation,
    userAccepted: c.userAccepted,
  }));
}

// ============================================
// OVERRIDE PATTERN TRACKING (Spec v1.0 §1.6)
// ============================================

export interface OverridePattern {
  id: string;
  date: Date;
  aiDecision: AIDecision;
  readinessScore: number;
  overrideReason: string | null;
}

export interface OverrideStats {
  totalCheckIns: number;
  totalOverrides: number;
  overrideRate: number; // 0-100%
  overridesByDecision: Record<AIDecision, number>;
  recentOverrides: OverridePattern[];
  behaviorInsight: string | null;
}

/**
 * Get override patterns for the last N days
 * Used by AI to learn athlete behavior
 */
export async function getOverridePatterns(days: number = 7): Promise<OverridePattern[]> {
  const session = await auth();
  if (!session?.user?.id) {
    return [];
  }

  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const overrides = await checkInDb.dailyCheckIn.findMany({
    where: {
      userId: session.user.id,
      date: { gte: startDate },
      userAccepted: false, // Only overrides
      aiDecision: { not: null },
    },
    orderBy: { date: "desc" },
  });

  return overrides.map((c) => ({
    id: c.id,
    date: c.date,
    aiDecision: c.aiDecision as AIDecision,
    readinessScore:
      typeof c.readinessScore === "number"
        ? c.readinessScore
        : calculateReadinessScore({
            sleepDuration: c.sleepDuration,
            sleepQuality: c.sleepQuality,
            physicalFatigue: c.physicalFatigue,
            mentalReadiness: c.mentalReadiness,
            motivation: c.motivation,
            muscleSoreness: c.muscleSoreness,
            stressLevel: c.stressLevel,
          }),
    overrideReason: c.userOverrideReason,
  }));
}

/**
 * Get override statistics for AI behavior adjustment
 */
export async function getOverrideStats(days: number = 30): Promise<OverrideStats> {
  const session = await auth();
  if (!session?.user?.id) {
    return {
      totalCheckIns: 0,
      totalOverrides: 0,
      overrideRate: 0,
      overridesByDecision: {} as Record<AIDecision, number>,
      recentOverrides: [],
      behaviorInsight: null,
    };
  }

  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const allCheckIns = await checkInDb.dailyCheckIn.findMany({
    where: {
      userId: session.user.id,
      date: { gte: startDate },
      aiDecision: { not: null },
    },
    orderBy: { date: "desc" },
  });

  const totalCheckIns = allCheckIns.length;
  const overrides = allCheckIns.filter((c) => c.userAccepted === false);
  const totalOverrides = overrides.length;
  const overrideRate = totalCheckIns > 0 ? Math.round((totalOverrides / totalCheckIns) * 100) : 0;

  // Count overrides by decision type
  const overridesByDecision: Record<string, number> = {};
  for (const o of overrides) {
    const decision = o.aiDecision as string;
    overridesByDecision[decision] = (overridesByDecision[decision] || 0) + 1;
  }

  // Get recent overrides with full pattern data
  const recentOverrides: OverridePattern[] = overrides.slice(0, 5).map((c) => ({
    id: c.id,
    date: c.date,
    aiDecision: c.aiDecision as AIDecision,
    readinessScore:
      typeof c.readinessScore === "number"
        ? c.readinessScore
        : calculateReadinessScore({
            sleepDuration: c.sleepDuration,
            sleepQuality: c.sleepQuality,
            physicalFatigue: c.physicalFatigue,
            mentalReadiness: c.mentalReadiness,
            motivation: c.motivation,
            muscleSoreness: c.muscleSoreness,
            stressLevel: c.stressLevel,
          }),
    overrideReason: c.userOverrideReason,
  }));

  // Generate behavior insight
  let behaviorInsight: string | null = null;
  if (totalOverrides >= 3 && overrideRate >= 50) {
    behaviorInsight = "Athlete frequently overrides AI recommendations. Consider adjusting thresholds or providing more context in explanations.";
  } else if (totalOverrides >= 3 && overridesByDecision["REST"] >= 2) {
    behaviorInsight = "Athlete tends to push through when rest is recommended. Be more cautious with future warnings.";
  } else if (totalOverrides >= 3 && overridesByDecision["REDUCE_INTENSITY"] >= 2) {
    behaviorInsight = "Athlete prefers full intensity. Consider raising the intensity reduction threshold.";
  } else if (overrideRate <= 20 && totalCheckIns >= 5) {
    behaviorInsight = "Athlete trusts AI recommendations. Current calibration is working well.";
  }

  return {
    totalCheckIns,
    totalOverrides,
    overrideRate,
    overridesByDecision: overridesByDecision as Record<AIDecision, number>,
    recentOverrides,
    behaviorInsight,
  };
}

export interface PremiumCheckinResult {
  id: string;
  date: string;
  sleepQuality: number;
  fatigue: number;
  motivation: number;
  soreness: number;
  stress: number;
  readinessScore: number;
  topFactor: string;
  recommendation: string;
  notes: string | null;
  notesVisibility: "FULL_AI_ACCESS" | "METRICS_ONLY" | "HIDDEN";
  hasConflict: boolean;
  conflictReason: string | null;
  suggestedChange: string | null;
  createdAt: string;
  updatedAt: string;
  planLocked: boolean;
}

/**
 * Compute readiness score from 0-100 scale inputs
 * Formula: 0.35*sleep + 0.25*(100-fatigue) + 0.20*motivation + 0.20*(100-soreness) - stress_penalty
 */
export async function computeReadiness100(input: PremiumCheckinInput): Promise<PremiumReadinessResult> {
  return calculatePremiumReadiness(input);
}

const INTENSIVE_KEYWORDS = [
  "interval",
  "intervals",
  "tempo",
  "race",
  "brick",
  "threshold",
  "vo2max",
  "hard",
];
const HARD_TSS_THRESHOLD = 80;
const MAX_HARD_SESSIONS_PER_WEEK = 3;

function matchesIntensiveKeyword(text: string | null | undefined): boolean {
  if (!text) return false;
  const normalized = text.toLowerCase();
  return INTENSIVE_KEYWORDS.some((keyword) => normalized.includes(keyword));
}

function isWorkoutIntense(workout: {
  type?: string | null;
  title?: string | null;
  tss?: number | null;
}): boolean {
  if (workout.tss && workout.tss > HARD_TSS_THRESHOLD) return true;
  if (workout.type && matchesIntensiveKeyword(workout.type)) return true;
  if (workout.title && matchesIntensiveKeyword(workout.title)) return true;
  return false;
}

/**
 * Check if there's a conflict between readiness and planned workout
 */
export async function detectWorkoutConflict(
  userId: string,
  readinessScore: number,
  fatigue: number,
  soreness: number
): Promise<{
  hasConflict: boolean;
  conflictReason: string | null;
  suggestedChange: string | null;
  todayWorkout: { id: string; title: string; type: string; tss: number | null } | null;
  planLocked: boolean;
}> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  // Get today's planned workout
  const todayWorkout = await db.workout.findFirst({
    where: {
      userId,
      date: { gte: today, lt: tomorrow },
      completed: false,
    },
    select: { id: true, title: true, type: true, tss: true, date: true },
  });

  if (!todayWorkout) {
    return { hasConflict: false, conflictReason: null, suggestedChange: null, todayWorkout: null, planLocked: false };
  }

  const isIntense = isWorkoutIntense({
    type: todayWorkout.type,
    title: todayWorkout.title,
    tss: todayWorkout.tss ?? null,
  });

  // Conflict detection rules
  let hasConflict = false;
  let conflictReason: string | null = null;
  let suggestedChange: string | null = null;
  let planLocked = false;

  const profile = await db.profile.findUnique({
    where: { userId },
    select: { planRigidity: true },
  });
  const planRigidity = (profile?.planRigidity as PlanRigiditySetting) || "LOCKED_1_DAY";
  planLocked = isWorkoutLocked({
    workoutDate: new Date(todayWorkout.date),
    planRigidity,
  });

  const weekStart = new Date(today);
  weekStart.setDate(weekStart.getDate() - 6);

  const recentWeekWorkouts = await db.workout.findMany({
    where: {
      userId,
      date: { gte: weekStart, lt: tomorrow },
    },
    select: {
      id: true,
      date: true,
      type: true,
      title: true,
      tss: true,
    },
  });

  const hardSessionsBeforeToday = recentWeekWorkouts.filter((workout) => {
    if (!isWorkoutIntense({ type: workout.type, title: workout.title, tss: workout.tss ?? null })) {
      return false;
    }
    const workoutDate = new Date(workout.date);
    const isTodayWorkout = todayWorkout && workout.id === todayWorkout.id;
    if (isTodayWorkout) return false;
    return workoutDate.getTime() < tomorrow.getTime();
  }).length;

  const guardrailExceeded =
    hardSessionsBeforeToday >= MAX_HARD_SESSIONS_PER_WEEK && isIntense;

  if (isIntense && readinessScore < 60) {
    hasConflict = true;
    conflictReason = "Low readiness for intense workout";
    suggestedChange = JSON.stringify({
      action: "swap_easy",
      reason: "Swap to easy Zone 2 session",
      newType: "easy",
      newTitle: "Easy Recovery Run",
    });
  } else if (soreness > 70) {
    hasConflict = true;
    conflictReason = "High muscle soreness";
    suggestedChange = JSON.stringify({
      action: "reduce_duration",
      reason: "Shorten session and focus on technique",
      durationFactor: 0.6,
    });
  } else if (fatigue > 75) {
    hasConflict = true;
    conflictReason = "High fatigue level";
    suggestedChange = JSON.stringify({
      action: "swap_recovery",
      reason: "Replace with recovery session",
      newType: "recovery",
      newTitle: "Recovery Session",
    });
  } else if (isIntense && readinessScore < 70) {
    // Warning but not full conflict
    hasConflict = true;
    conflictReason = "Moderate readiness for intense session";
    suggestedChange = JSON.stringify({
      action: "reduce_intensity",
      reason: "Reduce intensity by 15%",
      intensityFactor: 0.85,
    });
  }

  if (!hasConflict && guardrailExceeded) {
    hasConflict = true;
    conflictReason = "Weekly hard-session guardrail exceeded";
    suggestedChange = JSON.stringify({
      action: "swap_recovery",
      reason: "Respect the weekly guardrail and favor recovery",
      newType: "recovery",
      newTitle: "Recovery Session",
    });
  }

  return { hasConflict, conflictReason, suggestedChange, todayWorkout, planLocked };
}

/**
 * Save premium check-in (0-100 scale) for Dashboard Today
 */
export async function savePremiumCheckin(
  input: PremiumCheckinInput
): Promise<{ success: boolean; data?: PremiumCheckinResult; error?: string }> {
  const requestId = createRequestId();
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized" };
    }

    const userId = session.user.id;

    // Validate input
    if (input.sleepQuality < 0 || input.sleepQuality > 100) {
      return { success: false, error: "Sleep quality must be 0-100" };
    }
    if (input.fatigue < 0 || input.fatigue > 100) {
      return { success: false, error: "Fatigue must be 0-100" };
    }
    if (input.motivation < 0 || input.motivation > 100) {
      return { success: false, error: "Motivation must be 0-100" };
    }
    if (input.soreness < 0 || input.soreness > 100) {
      return { success: false, error: "Soreness must be 0-100" };
    }
    if (input.stress < 0 || input.stress > 100) {
      return { success: false, error: "Stress must be 0-100" };
    }
    if (input.notes && input.notes.length > 240) {
      return { success: false, error: "Notes must be 240 characters or less" };
    }

    logInfo("premium_checkin.save.started", {
      requestId,
      userId,
      action: "savePremiumCheckin",
    });

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Compute readiness
    const { readinessScore, topFactor, recommendation } = await computeReadiness100(input);

    // Detect conflicts
    const {
      hasConflict,
      conflictReason,
      suggestedChange,
      todayWorkout,
      planLocked,
    } = await detectWorkoutConflict(userId, readinessScore, input.fatigue, input.soreness);

    // Save check-in
    const checkIn = await db.dailyCheckIn.upsert({
      where: {
        userId_date: { userId, date: today },
      },
      update: {
        sleepQuality100: input.sleepQuality,
        fatigue100: input.fatigue,
        motivation100: input.motivation,
        soreness100: input.soreness,
        stress100: input.stress,
        readinessScore,
        topFactor,
        recommendation,
        notes: input.notes || null,
        notesVisibility: input.notesVisibility || "FULL_AI_ACCESS",
        hasConflict,
        conflictReason,
        suggestedChange,
        workoutId: todayWorkout?.id || null,
      },
      create: {
        userId,
        date: today,
        sleepQuality100: input.sleepQuality,
        fatigue100: input.fatigue,
        motivation100: input.motivation,
        soreness100: input.soreness,
        stress100: input.stress,
        readinessScore,
        topFactor,
        recommendation,
        notes: input.notes || null,
        notesVisibility: input.notesVisibility || "FULL_AI_ACCESS",
        hasConflict,
        conflictReason,
        suggestedChange,
        workoutId: todayWorkout?.id || null,
      },
    });

    // Track analytics
    await track({
      name: "premium_checkin_saved",
      userId,
      requestId,
      route: "/dashboard",
      source: "daily_checkin",
      properties: {
        readinessScore,
        topFactor,
        hasConflict,
        hasWorkout: !!todayWorkout,
      },
    });

    revalidatePath("/dashboard");
    revalidatePath("/calendar");

    logInfo("premium_checkin.save.succeeded", {
      requestId,
      userId,
      checkInId: checkIn.id,
      readinessScore,
      hasConflict,
    });

    return {
      success: true,
      data: {
        id: checkIn.id,
        date: checkIn.date.toISOString(),
        sleepQuality: input.sleepQuality,
        fatigue: input.fatigue,
        motivation: input.motivation,
        soreness: input.soreness,
        stress: input.stress,
        readinessScore,
        topFactor,
        recommendation,
        notes: checkIn.notes,
        notesVisibility: checkIn.notesVisibility ?? "FULL_AI_ACCESS",
        hasConflict,
        conflictReason,
        suggestedChange,
        planLocked,
        createdAt: checkIn.createdAt.toISOString(),
        updatedAt: checkIn.updatedAt.toISOString(),
      },
    };
  } catch (error) {
    logError("premium_checkin.save.failed", {
      requestId,
      action: "savePremiumCheckin",
      error: error instanceof Error ? error.message : String(error),
    });
    return { success: false, error: "Failed to save check-in" };
  }
}

/**
 * Get today's premium check-in for Dashboard
 */
export async function getTodayPremiumCheckin(): Promise<{
  success: boolean;
  data?: PremiumCheckinResult | null;
  status: "pending" | "completed" | "required";
  error?: string;
}> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, status: "pending", error: "Unauthorized" };
    }

  const userId = session.user.id;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  // Get today's check-in
  const checkIn = await db.dailyCheckIn.findUnique({
      where: { userId_date: { userId, date: today } },
    });

  // Check if there's a workout today
  const todayWorkout = await db.workout.findFirst({
    where: {
      userId,
        date: { gte: today, lt: tomorrow },
        completed: false,
    },
    select: { id: true, type: true, title: true, tss: true, date: true },
  });

  const profile = await db.profile.findUnique({
    where: { userId },
    select: { planRigidity: true },
  });

  const planRigidity = (profile?.planRigidity as PlanRigiditySetting) || "LOCKED_1_DAY";
  const planLocked =
    todayWorkout &&
    isWorkoutLocked({
      workoutDate: new Date(todayWorkout.date),
      planRigidity,
    });

    // Determine status
    let status: "pending" | "completed" | "required" = "pending";
    
    if (checkIn && checkIn.sleepQuality100 !== null) {
      status = "completed";
    } else if (todayWorkout) {
      // Check if workout is intense -> required
      const intensiveTypes = ["interval", "intervals", "tempo", "race", "brick", "threshold", "vo2max", "hard"];
      const isIntense = intensiveTypes.some(t => 
        todayWorkout.type.toLowerCase().includes(t) || 
        todayWorkout.title.toLowerCase().includes(t)
      ) || (todayWorkout.tss && todayWorkout.tss > 80);
      
      status = isIntense ? "required" : "pending";
    }

    if (!checkIn || checkIn.sleepQuality100 === null) {
      return { success: true, data: null, status };
    }

    return {
      success: true,
      status: "completed",
      data: {
        id: checkIn.id,
        date: checkIn.date.toISOString(),
        sleepQuality: checkIn.sleepQuality100 ?? 0,
        fatigue: checkIn.fatigue100 ?? 0,
        motivation: checkIn.motivation100 ?? 0,
        soreness: checkIn.soreness100 ?? 0,
        stress: checkIn.stress100 ?? 0,
        readinessScore: checkIn.readinessScore ?? 0,
        topFactor: checkIn.topFactor ?? "Unknown",
        recommendation: checkIn.recommendation ?? "",
        notes: checkIn.notes,
        notesVisibility: checkIn.notesVisibility ?? "FULL_AI_ACCESS",
        hasConflict: checkIn.hasConflict,
        conflictReason: checkIn.conflictReason,
        suggestedChange: checkIn.suggestedChange,
        createdAt: checkIn.createdAt.toISOString(),
        updatedAt: checkIn.updatedAt.toISOString(),
        planLocked: !!planLocked,
      },
    };
  } catch (error) {
    return { success: false, status: "pending", error: "Failed to get check-in" };
  }
}

export type TodayPremiumCheckinPayload = Awaited<ReturnType<typeof getTodayPremiumCheckin>>;

/**
 * Get check-in range for readiness trend
 */
export async function getCheckinRange(days: number = 14): Promise<{
  success: boolean;
  data?: Array<{
    date: string;
    readinessScore: number | null;
    topFactor: string | null;
  }>;
  error?: string;
}> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized" };
    }

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    startDate.setHours(0, 0, 0, 0);

    const checkIns = await db.dailyCheckIn.findMany({
      where: {
        userId: session.user.id,
        date: { gte: startDate },
      },
      select: {
        date: true,
        readinessScore: true,
        topFactor: true,
      },
      orderBy: { date: "asc" },
    });

    return {
      success: true,
      data: checkIns.map((c) => ({
        date: c.date.toISOString(),
        readinessScore: c.readinessScore,
        topFactor: c.topFactor,
      })),
    };
  } catch (error) {
    return { success: false, error: "Failed to get check-in range" };
  }
}

/**
 * Accept conflict suggestion (apply or create proposal)
 */
export async function acceptConflictSuggestion(
  checkInId: string
): Promise<{ success: boolean; proposalId?: string; applied?: boolean; error?: string }> {
  const requestId = createRequestId();
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized" };
    }

    const checkIn = await db.dailyCheckIn.findUnique({
      where: { id: checkInId },
    });

    if (!checkIn || checkIn.userId !== session.user.id) {
      return { success: false, error: "Check-in not found" };
    }

    if (!checkIn.hasConflict || !checkIn.suggestedChange) {
      return { success: false, error: "No conflict suggestion to accept" };
    }

    // Get user's plan rigidity
    const profile = await db.profile.findUnique({
      where: { userId: session.user.id },
      select: { planRigidity: true },
    });
    const planRigidity = (profile?.planRigidity as PlanRigiditySetting) || "LOCKED_1_DAY";

    // Get today's workout
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const workout = checkIn.workoutId
      ? await db.workout.findUnique({ where: { id: checkIn.workoutId } })
      : await db.workout.findFirst({
          where: {
            userId: session.user.id,
            date: { gte: today, lt: tomorrow },
            completed: false,
          },
        });

    if (!workout) {
      return { success: false, error: "No workout found to modify" };
    }

    // Parse suggested change
    const suggestion = JSON.parse(checkIn.suggestedChange);
    
    // Check if workout is locked
    const locked = isWorkoutLocked({ workoutDate: new Date(workout.date), planRigidity });

    if (locked) {
      // Create proposal instead of applying
      const patch: ProposalPatch = {
        workout: {
          id: workout.id,
          update: {
            aiGenerated: true,
            aiReason: checkIn.conflictReason || "Conflict detected from check-in",
            source: "daily-checkin-conflict",
            ...(suggestion.newTitle && { title: suggestion.newTitle }),
            ...(suggestion.newType && { type: suggestion.newType }),
            ...(suggestion.durationFactor && { durationMin: Math.round((workout.durationMin || 60) * suggestion.durationFactor) }),
            ...(suggestion.intensityFactor && workout.tss && { tss: Math.round(workout.tss * suggestion.intensityFactor) }),
          },
        },
      };

      const proposalRes = await createPlanChangeProposal({
        workoutId: workout.id,
        checkInId,
        sourceType: "DAILY_CHECKIN",
        confidence: 80,
        summary: `Check-in conflict: ${checkIn.conflictReason}`,
        patch,
      });

      if (!proposalRes.success) {
        return { success: false, error: proposalRes.error || "Failed to create proposal" };
      }

      await track({
        name: "conflict_suggestion_proposal",
        userId: session.user.id,
        requestId,
        route: "/dashboard",
        source: "daily_checkin",
        properties: { checkInId, proposalId: proposalRes.proposalId },
      });

      revalidatePath("/dashboard");
      revalidatePath("/calendar");

      return { success: true, proposalId: proposalRes.proposalId };
    }

    // Apply change directly
    const updateData: Prisma.WorkoutUpdateInput = {
      aiGenerated: true,
      aiReason: checkIn.conflictReason || "Adapted from check-in conflict",
      source: "daily-checkin-conflict",
    };

    if (suggestion.newTitle) updateData.title = suggestion.newTitle;
    if (suggestion.newType) updateData.type = suggestion.newType;
    if (suggestion.durationFactor) {
      updateData.durationMin = Math.round((workout.durationMin || 60) * suggestion.durationFactor);
    }
    if (suggestion.intensityFactor && workout.tss) {
      updateData.tss = Math.round(workout.tss * suggestion.intensityFactor);
    }

    await db.workout.update({
      where: { id: workout.id },
      data: updateData,
    });

    // Clear conflict flags
    await db.dailyCheckIn.update({
      where: { id: checkInId },
      data: {
        hasConflict: false,
        userAccepted: true,
      },
    });

    await db.auditLog.create({
      data: {
        userId: session.user.id,
        actorUserId: session.user.id,
        actionType: "CHECKIN_CONFLICT_ACCEPTED",
        targetType: "WORKOUT",
        targetId: workout.id,
        summary: `Applied conflict suggestion: ${suggestion.action}`,
        detailsJson: JSON.stringify({ checkInId, suggestion }),
      },
    });

    await track({
      name: "conflict_suggestion_applied",
      userId: session.user.id,
      requestId,
      route: "/dashboard",
      source: "daily_checkin",
      properties: { checkInId, workoutId: workout.id, action: suggestion.action },
    });

    revalidatePath("/dashboard");
    revalidatePath("/calendar");

    return { success: true, applied: true };
  } catch (error) {
    logError("conflict_suggestion.accept.failed", {
      requestId,
      action: "acceptConflictSuggestion",
      checkInId,
      error: error instanceof Error ? error.message : String(error),
    });
    return { success: false, error: "Failed to accept suggestion" };
  }
}

/**
 * Dismiss conflict suggestion
 */
export async function dismissConflictSuggestion(
  checkInId: string,
  reason?: string
): Promise<{ success: boolean; error?: string }> {
  const requestId = createRequestId();
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized" };
    }

    const checkIn = await db.dailyCheckIn.findUnique({
      where: { id: checkInId },
    });

    if (!checkIn || checkIn.userId !== session.user.id) {
      return { success: false, error: "Check-in not found" };
    }

    await db.dailyCheckIn.update({
      where: { id: checkInId },
      data: {
        hasConflict: false,
        userAccepted: false,
        userOverrideReason: reason || "User dismissed conflict suggestion",
      },
    });

    await db.auditLog.create({
      data: {
        userId: session.user.id,
        actorUserId: session.user.id,
        actionType: "CHECKIN_CONFLICT_DISMISSED",
        targetType: "CHECK_IN",
        targetId: checkInId,
        summary: "Dismissed conflict suggestion",
        detailsJson: JSON.stringify({ reason }),
      },
    });

    await track({
      name: "conflict_suggestion_dismissed",
      userId: session.user.id,
      requestId,
      route: "/dashboard",
      source: "daily_checkin",
      properties: { checkInId, hasReason: !!reason },
    });

    revalidatePath("/dashboard");

    return { success: true };
  } catch (error) {
    return { success: false, error: "Failed to dismiss suggestion" };
  }
}
