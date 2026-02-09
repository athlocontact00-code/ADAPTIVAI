"use server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  computeReadiness,
  computeReadinessForUser,
  formatFactorsJson,
  DiarySignals,
  LoadSignals,
  ReadinessResult,
} from "@/lib/services/readiness.service";
import { 
  detectFatigueType, 
  formatFatigueReasonsJson,
  FatigueInputs,
  FatigueResult
} from "@/lib/services/fatigue.service";
import { 
  getLoadMetrics, 
  checkGuardrails, 
  applyDeload,
  DEFAULT_RAMP_THRESHOLD,
  LoadMetrics,
  GuardrailResult
} from "@/lib/services/guardrails.service";
import { addDays, formatLocalDateInput, parseDateToLocalNoon, startOfWeek } from "@/lib/utils";

export interface ReadinessData {
  score: number;
  status: string;
  factors: { factor: string; impact: number; description: string }[];
  confidence: number;
  fatigueType: string;
  fatigueRecommendation: string;
}

export interface RiskData {
  rampRate: number;
  rampStatus: string;
  weeklyLoad: number;
  previousWeekLoad: number;
  riskScore: number;
  warnings: { type: string; message: string; severity: string }[];
}

/**
 * Recompute readiness and fatigue for a specific date
 */
export async function recomputeReadinessForDate(
  dateStr: string
): Promise<{ success: boolean; data?: ReadinessData; error?: string }> {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, error: "Unauthorized" };
  }

  const userId = session.user.id;
  const date = parseDateToLocalNoon(dateStr);

  try {
    // Get diary entry for the date
    const diary = await db.diaryEntry.findFirst({
      where: { userId, date },
    });

    // Get recent metrics
    const metric = await db.metricDaily.findFirst({
      where: { userId, date },
    });

    // Get workouts from last 14 days for pattern analysis
    const twoWeeksAgo = addDays(date, -14);
    const recentWorkouts = await db.workout.findMany({
      where: {
        userId,
        date: { gte: twoWeeksAgo, lte: date },
        completed: true,
      },
      orderBy: { date: "desc" },
    });

    // Get diary entries for pattern analysis
    const recentDiary = await db.diaryEntry.findMany({
      where: {
        userId,
        date: { gte: addDays(date, -7), lte: date },
      },
      orderBy: { date: "desc" },
    });

    // Prepare signals for readiness calculation
    const diarySignals: DiarySignals = {
      mood: diary?.mood,
      energy: diary?.energy,
      sleepHrs: diary?.sleepHrs,
      sleepQual: diary?.sleepQual,
      stress: diary?.stress,
      soreness: diary?.soreness,
    };

    const loadSignals: LoadSignals = {
      atl: metric?.atl,
      ctl: metric?.ctl,
      tsb: metric?.tsb,
    };

    // Compute readiness
    const readinessResult = computeReadiness(diarySignals, loadSignals);

    // Compute fatigue
    const persistentFatigueDays = recentDiary.filter(
      (d) => d.energy != null && d.energy <= 2
    ).length;

    const recentHighIntensityDays = recentWorkouts.filter((w) => {
      const intensity = w.tss ? (w.tss > 80 ? 3 : w.tss > 50 ? 2 : 1) : 1;
      return intensity >= 3;
    }).length;

    // Count consecutive training days
    let consecutiveTrainingDays = 0;
    let currentDate = date;
    for (const w of recentWorkouts) {
      const wDate = new Date(w.date);
      wDate.setHours(12, 0, 0, 0);
      if (wDate.toDateString() === currentDate.toDateString()) {
        consecutiveTrainingDays++;
        currentDate = addDays(currentDate, -1);
      } else {
        break;
      }
    }

    const fatigueInputs: FatigueInputs = {
      ...diarySignals,
      atl: metric?.atl,
      ctl: metric?.ctl,
      tsb: metric?.tsb,
      recentHighIntensityDays,
      consecutiveTrainingDays,
      persistentFatigueDays,
    };

    const fatigueResult = detectFatigueType(fatigueInputs);

    // Calculate weekly load
    const weekStart = startOfWeek(date);
    const weekEnd = addDays(weekStart, 6);
    const thisWeekWorkouts = await db.workout.findMany({
      where: {
        userId,
        date: { gte: weekStart, lte: weekEnd },
        completed: true,
      },
    });

    const prevWeekStart = addDays(weekStart, -7);
    const prevWeekEnd = addDays(weekStart, -1);
    const prevWeekWorkouts = await db.workout.findMany({
      where: {
        userId,
        date: { gte: prevWeekStart, lte: prevWeekEnd },
        completed: true,
      },
    });

    const loadMetrics = getLoadMetrics(thisWeekWorkouts, prevWeekWorkouts);

    // Update or create metric record
    await (db as any).metricDaily.upsert({
      where: {
        userId_date: { userId, date },
      },
      create: {
        userId,
        date,
        readinessScore: readinessResult.score,
        readinessStatus: readinessResult.status,
        readinessFactorsJson: formatFactorsJson(readinessResult.factors),
        readinessConfidence: readinessResult.confidence,
        fatigueType: fatigueResult.type,
        fatigueReasonsJson: formatFatigueReasonsJson(fatigueResult.reasons),
        weeklyLoad: loadMetrics.currentWeekLoad,
        rampRate: loadMetrics.rampRate,
        rampStatus: loadMetrics.status,
        atl: metric?.atl,
        ctl: metric?.ctl,
        tsb: metric?.tsb,
      } as any,
      update: {
        readinessScore: readinessResult.score,
        readinessStatus: readinessResult.status,
        readinessFactorsJson: formatFactorsJson(readinessResult.factors),
        readinessConfidence: readinessResult.confidence,
        fatigueType: fatigueResult.type,
        fatigueReasonsJson: formatFatigueReasonsJson(fatigueResult.reasons),
        weeklyLoad: loadMetrics.currentWeekLoad,
        rampRate: loadMetrics.rampRate,
        rampStatus: loadMetrics.status,
      } as any,
    });

    return {
      success: true,
      data: {
        score: readinessResult.score,
        status: readinessResult.status,
        factors: readinessResult.factors,
        confidence: readinessResult.confidence,
        fatigueType: fatigueResult.type,
        fatigueRecommendation: fatigueResult.recommendation,
      },
    };
  } catch (error) {
    console.error("Error computing readiness:", error);
    return { success: false, error: "Failed to compute readiness" };
  }
}

/**
 * Get today's readiness data. Uses computeReadinessForUser (real data only; no mock).
 * When no check-in/diary/metrics -> data is null so UI shows "Complete check-in" CTA.
 */
export async function getTodayReadiness(): Promise<{
  success: boolean;
  data?: ReadinessData | null;
  error?: string;
}> {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, error: "Unauthorized" };
  }
  const today = new Date();
  today.setHours(12, 0, 0, 0);
  try {
    const result = await computeReadinessForUser(session.user.id, today);
    if (result.score == null) {
      return { success: true, data: null };
    }
    const factors = Object.entries(result.factors).map(([factor, v]) => ({
      factor,
      impact: typeof v?.value === "number" ? v.value : 0,
      description: v?.description ?? factor,
    }));
    return {
      success: true,
      data: {
        score: result.score,
        status: result.status ?? "CAUTION",
        factors,
        confidence: result.confidence === "high" ? 85 : result.confidence === "medium" ? 60 : 40,
        fatigueType: "NONE",
        fatigueRecommendation: "",
      },
    };
  } catch (err) {
    console.error("getTodayReadiness failed:", err);
    return { success: false, error: "Failed to load readiness" };
  }
}

/**
 * Get readiness trend for last N days
 */
export async function getReadinessTrend(
  days: number = 14
): Promise<{ date: string; score: number; status: string }[]> {
  const session = await auth();
  if (!session?.user?.id) return [];

  const userId = session.user.id;
  const today = new Date();
  today.setHours(12, 0, 0, 0);
  const startDate = addDays(today, -days);

  const metrics = await (db as any).metricDaily.findMany({
    where: {
      userId,
      date: { gte: startDate, lte: today },
      readinessScore: { not: null },
    } as any,
    orderBy: { date: "asc" },
    select: {
      date: true,
      readinessScore: true,
      readinessStatus: true,
    } as any,
  });

  return metrics.map((m: { date: Date }) => ({
    date: formatLocalDateInput(new Date(m.date)),
    score: (m as any).readinessScore || 0,
    status: (m as any).readinessStatus || "CAUTION",
  }));
}

/**
 * Get risk assessment for current/planned week
 */
export async function getRiskAssessment(): Promise<{
  success: boolean;
  data?: RiskData;
  error?: string;
}> {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, error: "Unauthorized" };
  }

  const userId = session.user.id;
  const today = new Date();
  today.setHours(12, 0, 0, 0);

  try {
    const weekStart = startOfWeek(today);
    const weekEnd = addDays(weekStart, 6);

    // Get this week's workouts (completed + planned)
    const thisWeekWorkouts = await db.workout.findMany({
      where: {
        userId,
        date: { gte: weekStart, lte: weekEnd },
      },
    });

    // Get previous week's workouts
    const prevWeekStart = addDays(weekStart, -7);
    const prevWeekEnd = addDays(weekStart, -1);
    const prevWeekWorkouts = await db.workout.findMany({
      where: {
        userId,
        date: { gte: prevWeekStart, lte: prevWeekEnd },
        completed: true,
      },
    });

    const loadMetrics = getLoadMetrics(thisWeekWorkouts, prevWeekWorkouts);

    // Check guardrails for planned workouts
    const plannedWorkouts = thisWeekWorkouts
      .filter((w) => w.planned && !w.completed)
      .map((w) => ({
        date: w.date,
        durationMin: w.durationMin || 45,
        intensity: (w.tss && w.tss > 80 ? "hard" : w.tss && w.tss > 50 ? "moderate" : "easy") as "easy" | "moderate" | "hard",
        tss: w.tss || undefined,
      }));

    const recentWorkouts = thisWeekWorkouts
      .filter((w) => w.completed)
      .map((w) => ({
        date: w.date,
        intensity: w.tss && w.tss > 80 ? "hard" : w.tss && w.tss > 50 ? "moderate" : "easy",
        durationMin: w.durationMin,
      }));

    const guardrailResult = checkGuardrails(
      plannedWorkouts,
      loadMetrics.previousWeekLoad,
      recentWorkouts
    );

    return {
      success: true,
      data: {
        rampRate: loadMetrics.rampRate ?? 0,
        rampStatus: loadMetrics.status,
        weeklyLoad: loadMetrics.currentWeekLoad,
        previousWeekLoad: loadMetrics.previousWeekLoad,
        riskScore: guardrailResult.riskScore,
        warnings: guardrailResult.warnings.map((w) => ({
          type: w.type,
          message: w.message,
          severity: w.severity,
        })),
      },
    };
  } catch (error) {
    console.error("Error getting risk assessment:", error);
    return { success: false, error: "Failed to get risk assessment" };
  }
}

/**
 * Apply deload week
 */
export async function applyDeloadWeek(
  startDateStr: string
): Promise<{ success: boolean; message?: string; error?: string }> {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, error: "Unauthorized" };
  }

  const userId = session.user.id;
  const startDate = parseDateToLocalNoon(startDateStr);
  const endDate = addDays(startDate, 6);

  try {
    // Get planned workouts for the week
    const plannedWorkouts = await db.workout.findMany({
      where: {
        userId,
        date: { gte: startDate, lte: endDate },
        planned: true,
        completed: false,
      },
    });

    if (plannedWorkouts.length === 0) {
      return { success: false, error: "No planned workouts found for this week" };
    }

    // Apply deload adjustments
    const workoutsForDeload = plannedWorkouts.map((w) => ({
      date: w.date,
      durationMin: w.durationMin || 45,
      intensity: (w.tss && w.tss > 80 ? "hard" : w.tss && w.tss > 50 ? "moderate" : "easy") as "easy" | "moderate" | "hard",
      tss: w.tss || undefined,
    }));

    const { adjusted, description } = applyDeload(workoutsForDeload, 40);

    // Update workouts in database
    for (let i = 0; i < plannedWorkouts.length; i++) {
      const original = plannedWorkouts[i];
      const adj = adjusted[i];

      await db.workout.update({
        where: { id: original.id },
        data: {
          durationMin: adj.durationMin,
          tss: adj.tss || Math.round(adj.durationMin * 0.6),
          aiReason: (original as any).aiReason
            ? `${(original as any).aiReason} | Deload applied`
            : "Deload week: reduced volume and intensity",
          aiGenerated: true,
          source: "guardrails",
        } as any,
      });
    }

    // Log the deload action
    await (db as any).planGenerationLog.create({
      data: {
        userId,
        startDate,
        endDate,
        summaryMd: `## Deload Week Applied\n\n${description}\n\n${plannedWorkouts.length} workouts adjusted for recovery.`,
        constraintsJson: JSON.stringify({ action: "deload", percent: 40 }),
        warningsJson: null,
      } as any,
    });

    return {
      success: true,
      message: description,
    };
  } catch (error) {
    console.error("Error applying deload:", error);
    return { success: false, error: "Failed to apply deload" };
  }
}

/**
 * Update user's explainLevel setting
 */
export async function updateExplainLevel(
  level: "minimal" | "standard" | "deep"
): Promise<{ success: boolean; error?: string }> {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, error: "Unauthorized" };
  }

  try {
    await (db as any).user.update({
      where: { id: session.user.id },
      data: { explainLevel: level } as any,
    });

    return { success: true };
  } catch (error) {
    console.error("Error updating explain level:", error);
    return { success: false, error: "Failed to update setting" };
  }
}

/**
 * Get user's explainLevel setting
 */
export async function getExplainLevel(): Promise<"minimal" | "standard" | "deep"> {
  const session = await auth();
  if (!session?.user?.id) return "standard";

  const user = await (db as any).user.findUnique({
    where: { id: session.user.id },
    select: { explainLevel: true } as any,
  });

  return ((user as any)?.explainLevel as "minimal" | "standard" | "deep") || "standard";
}
