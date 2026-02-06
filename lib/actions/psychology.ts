"use server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { addDays } from "@/lib/utils";
import {
  computeCompliance,
  formatComplianceReasonsJson,
  getComplianceNudge,
  ComplianceResult,
} from "@/lib/services/compliance.service";
import {
  computeBurnoutRisk,
  formatBurnoutDriversJson,
  getSimplifyAdjustments,
  getRecoveryMicrocycle,
  BurnoutResult,
} from "@/lib/services/burnout.service";
import {
  generateDailyInsight,
  formatInsightDriversJson,
  DailyInsightResult,
} from "@/lib/services/insights.service";
import { parseInsightDrivers } from "@/lib/parseDrivers";

export interface PsychologyData {
  compliance: {
    score: number;
    status: string;
    completionRate: number;
    currentStreak: number;
    plannedWorkouts: number;
    completedWorkouts: number;
    nudge: string | null;
  } | null;
  burnout: {
    risk: number;
    status: string;
    drivers: { driver: string; description: string }[];
    recommendation: string;
    actions: { id: string; label: string; description: string }[];
  } | null;
  insight: {
    text: string;
    type: string;
    drivers: { factor: string; value: string | number }[];
  } | null;
}

/**
 * Compute and store compliance metrics for a date
 */
export async function computeComplianceForDate(
  dateStr: string
): Promise<{ success: boolean; data?: ComplianceResult; error?: string }> {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, error: "Unauthorized" };
  }

  const userId = session.user.id;
  const date = new Date(dateStr);
  date.setHours(12, 0, 0, 0);

  try {
    // Get workouts from last 14 days
    const startDate = addDays(date, -14);
    const workouts = await db.workout.findMany({
      where: {
        userId,
        date: { gte: startDate, lte: date },
      },
      select: {
        date: true,
        planned: true,
        completed: true,
        type: true,
        tss: true,
        aiGenerated: true,
      },
    });

    const result = computeCompliance(workouts);

    // Update metric record
    await db.metricDaily.upsert({
      where: { userId_date: { userId, date } },
      create: {
        userId,
        date,
        complianceScore: result.score,
        complianceStatus: result.status,
        complianceReasonsJson: formatComplianceReasonsJson(result.reasons),
        plannedWorkouts: result.plannedWorkouts,
        completedWorkouts: result.completedWorkouts,
        currentStreak: result.currentStreak,
      },
      update: {
        complianceScore: result.score,
        complianceStatus: result.status,
        complianceReasonsJson: formatComplianceReasonsJson(result.reasons),
        plannedWorkouts: result.plannedWorkouts,
        completedWorkouts: result.completedWorkouts,
        currentStreak: result.currentStreak,
      },
    });

    return { success: true, data: result };
  } catch (error) {
    console.error("Error computing compliance:", error);
    return { success: false, error: "Failed to compute compliance" };
  }
}

/**
 * Compute and store burnout risk for a date
 */
export async function computeBurnoutForDate(
  dateStr: string
): Promise<{ success: boolean; data?: BurnoutResult; error?: string }> {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, error: "Unauthorized" };
  }

  const userId = session.user.id;
  const date = new Date(dateStr);
  date.setHours(12, 0, 0, 0);

  try {
    // Get today's diary entry
    const diary = await db.diaryEntry.findFirst({
      where: { userId, date },
    });

    // Get today's metrics
    const metric = await db.metricDaily.findFirst({
      where: { userId, date },
    });

    // Get last 7 days of diary for pattern analysis
    const weekAgo = addDays(date, -7);
    const recentDiary = await db.diaryEntry.findMany({
      where: { userId, date: { gte: weekAgo, lte: date } },
    });

    const lowMoodDays = recentDiary.filter((d) => d.mood != null && d.mood <= 2).length;
    const lowSleepDays = recentDiary.filter((d) => d.sleepQual != null && d.sleepQual <= 2).length;
    const highSorenessDays = recentDiary.filter((d) => d.soreness != null && d.soreness >= 4).length;

    const result = computeBurnoutRisk({
      mood: diary?.mood,
      sleepQual: diary?.sleepQual,
      soreness: diary?.soreness,
      stress: diary?.stress,
      fatigueType: metric?.fatigueType,
      readinessScore: metric?.readinessScore,
      complianceScore: metric?.complianceScore,
      complianceStatus: metric?.complianceStatus,
      lowMoodDays,
      lowSleepDays,
      highSorenessDays,
    });

    // Update metric record
    await db.metricDaily.upsert({
      where: { userId_date: { userId, date } },
      create: {
        userId,
        date,
        burnoutRisk: result.risk,
        burnoutStatus: result.status,
        burnoutDriversJson: formatBurnoutDriversJson(result.drivers),
      },
      update: {
        burnoutRisk: result.risk,
        burnoutStatus: result.status,
        burnoutDriversJson: formatBurnoutDriversJson(result.drivers),
      },
    });

    return { success: true, data: result };
  } catch (error) {
    console.error("Error computing burnout:", error);
    return { success: false, error: "Failed to compute burnout risk" };
  }
}

/**
 * Get or generate daily insight
 */
export async function getDailyInsight(): Promise<{
  success: boolean;
  data?: { text: string; type: string; drivers: { factor: string; value: string | number }[] } | null;
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
    // Check if insight already exists for today
    const existing = await db.dailyInsight.findFirst({
      where: { userId, date: today, dismissed: false },
    });

    if (existing) {
      return {
        success: true,
        data: {
          text: existing.insightText,
          type: existing.insightType,
          drivers: parseInsightDrivers(existing.driversJson),
        },
      };
    }

    // Get user settings
    const user = await db.user.findUnique({
      where: { id: userId },
      select: { identityMode: true },
    });

    // Get today's metrics
    const metric = await db.metricDaily.findFirst({
      where: { userId, date: today },
    });

    // Get today's diary
    const diary = await db.diaryEntry.findFirst({
      where: { userId, date: today },
    });

    // Check if there's a workout today
    const todayWorkout = await db.workout.findFirst({
      where: { userId, date: today, planned: true },
    });

    // Generate insight
    const result = generateDailyInsight({
      readinessScore: metric?.readinessScore,
      readinessStatus: metric?.readinessStatus,
      fatigueType: metric?.fatigueType,
      complianceScore: metric?.complianceScore,
      complianceStatus: metric?.complianceStatus,
      currentStreak: metric?.currentStreak,
      burnoutRisk: metric?.burnoutRisk,
      burnoutStatus: metric?.burnoutStatus,
      mood: diary?.mood,
      sleepQual: diary?.sleepQual,
      soreness: diary?.soreness,
      identityMode: user?.identityMode || "competitive",
      dayOfWeek: today.getDay(),
      hasWorkoutToday: !!todayWorkout,
    });

    if (!result) {
      return { success: true, data: null };
    }

    // Store the insight
    await db.dailyInsight.create({
      data: {
        userId,
        date: today,
        insightText: result.text,
        insightType: result.type,
        driversJson: formatInsightDriversJson(result.drivers),
      },
    });

    return {
      success: true,
      data: {
        text: result.text,
        type: result.type,
        drivers: result.drivers,
      },
    };
  } catch (error) {
    console.error("Error getting daily insight:", error);
    return { success: false, error: "Failed to get insight" };
  }
}

/**
 * Get all psychology data for dashboard
 */
export async function getPsychologyData(): Promise<{
  success: boolean;
  data?: PsychologyData;
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
    // Get user settings
    const user = await db.user.findUnique({
      where: { id: userId },
      select: { identityMode: true },
    });

    // Get today's metrics
    const metric = await db.metricDaily.findFirst({
      where: { userId, date: today },
    });

    // Build compliance data
    let compliance = null;
    if (metric?.complianceScore != null) {
      const nudge = getComplianceNudge(
        {
          score: metric.complianceScore,
          status: metric.complianceStatus as any,
          reasons: [],
          plannedWorkouts: metric.plannedWorkouts || 0,
          completedWorkouts: metric.completedWorkouts || 0,
          completionRate: metric.plannedWorkouts
            ? Math.round((metric.completedWorkouts || 0) / metric.plannedWorkouts * 100)
            : 100,
          currentStreak: metric.currentStreak || 0,
          missedKeySessionsCount: 0,
        },
        user?.identityMode || "competitive"
      );

      compliance = {
        score: metric.complianceScore,
        status: metric.complianceStatus || "STRONG",
        completionRate: metric.plannedWorkouts
          ? Math.round((metric.completedWorkouts || 0) / metric.plannedWorkouts * 100)
          : 100,
        currentStreak: metric.currentStreak || 0,
        plannedWorkouts: metric.plannedWorkouts || 0,
        completedWorkouts: metric.completedWorkouts || 0,
        nudge,
      };
    }

    // Build burnout data
    let burnout = null;
    if (metric?.burnoutRisk != null) {
      const drivers = metric.burnoutDriversJson
        ? Object.entries(JSON.parse(metric.burnoutDriversJson)).map(([driver, weight]) => ({
            driver,
            description: driver.replace(/_/g, " "),
          }))
        : [];

      const m = metric as any;
      const result = computeBurnoutRisk({
        fatigueType: m.fatigueType ?? null,
        readinessScore:
          typeof m.readinessScore === "number"
            ? m.readinessScore
            : typeof m.readiness === "number"
            ? m.readiness
            : null,
        complianceScore: m.complianceScore ?? null,
        complianceStatus: m.complianceStatus ?? null,
      });

      burnout = {
        risk: metric.burnoutRisk,
        status: metric.burnoutStatus || "LOW",
        drivers,
        recommendation: result.recommendation,
        actions: result.suggestedActions.map((a) => ({
          id: a.id,
          label: a.label,
          description: a.description,
        })),
      };
    }

    // Get insight
    const insightResult = await getDailyInsight();
    const insight = insightResult.success ? (insightResult.data ?? null) : null;

    return {
      success: true,
      data: { compliance, burnout, insight },
    };
  } catch (error) {
    console.error("Error getting psychology data:", error);
    return { success: false, error: "Failed to get psychology data" };
  }
}

/**
 * Apply simplify action for next 7 days
 */
export async function applySimplifyWeek(): Promise<{
  success: boolean;
  message?: string;
  error?: string;
}> {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, error: "Unauthorized" };
  }

  const userId = session.user.id;
  const today = new Date();
  today.setHours(12, 0, 0, 0);
  const endDate = addDays(today, 7);

  try {
    // Get planned workouts for next 7 days
    const workouts = await db.workout.findMany({
      where: {
        userId,
        date: { gte: today, lte: endDate },
        planned: true,
        completed: false,
      },
    });

    if (workouts.length === 0) {
      return { success: false, error: "No planned workouts to simplify" };
    }

    // Apply simplify adjustments
    for (const workout of workouts) {
      const newDuration = Math.round((workout.durationMin || 45) * 0.7);
      const newTss = workout.tss ? Math.round(workout.tss * 0.6) : null;

      await db.workout.update({
        where: { id: workout.id },
        data: {
          durationMin: Math.max(20, newDuration),
          tss: newTss,
          aiReason: "Simplified for recovery—keeping the habit, lowering the load",
          aiGenerated: true,
          source: "burnout_prevention",
        },
      });
    }

    // Log the action
    await db.planGenerationLog.create({
      data: {
        userId,
        startDate: today,
        endDate,
        summaryMd: `## Week Simplified\n\n${workouts.length} workouts adjusted:\n- Duration reduced by ~30%\n- Intensity lowered\n- Focus: maintain habit, reduce load`,
        constraintsJson: JSON.stringify({ action: "simplify", reason: "burnout_prevention" }),
        warningsJson: null,
      },
    });

    return {
      success: true,
      message: `Simplified ${workouts.length} workouts for the next 7 days`,
    };
  } catch (error) {
    console.error("Error applying simplify:", error);
    return { success: false, error: "Failed to simplify week" };
  }
}

/**
 * Apply recovery microcycle
 */
export async function applyRecoveryMicrocycle(): Promise<{
  success: boolean;
  message?: string;
  error?: string;
}> {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, error: "Unauthorized" };
  }

  const userId = session.user.id;
  const today = new Date();
  today.setHours(12, 0, 0, 0);
  const endDate = addDays(today, 7);

  try {
    // Get user's sport
    const profile = await db.profile.findFirst({
      where: { userId },
      select: { sportPrimary: true },
    });

    const sport = profile?.sportPrimary || "running";

    // Delete existing planned workouts for next 7 days
    await db.workout.deleteMany({
      where: {
        userId,
        date: { gte: today, lte: endDate },
        planned: true,
        completed: false,
      },
    });

    // Generate recovery microcycle
    const recoveryWorkouts = getRecoveryMicrocycle(today, sport);

    // Create new workouts
    for (const w of recoveryWorkouts) {
      await db.workout.create({
        data: {
          userId,
          title: w.title,
          type: w.type,
          date: w.date,
          planned: true,
          completed: false,
          durationMin: w.durationMin,
          tss: Math.round(w.durationMin * 0.4),
          aiGenerated: true,
          aiReason: w.reason,
          aiConfidence: 90,
          source: "burnout_prevention",
        },
      });
    }

    // Log the action
    await db.planGenerationLog.create({
      data: {
        userId,
        startDate: today,
        endDate,
        summaryMd: `## Recovery Microcycle\n\n${recoveryWorkouts.length} gentle sessions scheduled:\n- Easy movement only\n- Focus on mental and physical reset\n- Rest days built in`,
        constraintsJson: JSON.stringify({ action: "recovery_microcycle", sport }),
        warningsJson: null,
      },
    });

    return {
      success: true,
      message: `Recovery microcycle created with ${recoveryWorkouts.length} easy sessions`,
    };
  } catch (error) {
    console.error("Error applying recovery microcycle:", error);
    return { success: false, error: "Failed to create recovery microcycle" };
  }
}

/**
 * Update user's identity mode
 */
export async function updateIdentityMode(
  mode: "competitive" | "longevity" | "comeback" | "busy_pro"
): Promise<{ success: boolean; error?: string }> {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, error: "Unauthorized" };
  }

  try {
    await db.user.update({
      where: { id: session.user.id },
      data: { identityMode: mode },
    });

    return { success: true };
  } catch (error) {
    console.error("Error updating identity mode:", error);
    return { success: false, error: "Failed to update identity mode" };
  }
}

/**
 * Get user's identity mode
 */
export async function getIdentityMode(): Promise<string> {
  const session = await auth();
  if (!session?.user?.id) return "competitive";

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { identityMode: true },
  });

  return user?.identityMode || "competitive";
}

/**
 * Dismiss today's insight
 */
export async function dismissInsight(): Promise<{ success: boolean }> {
  const session = await auth();
  if (!session?.user?.id) return { success: false };

  const today = new Date();
  today.setHours(12, 0, 0, 0);

  try {
    await db.dailyInsight.updateMany({
      where: {
        userId: session.user.id,
        date: today,
      },
      data: { dismissed: true },
    });

    return { success: true };
  } catch {
    return { success: false };
  }
}
