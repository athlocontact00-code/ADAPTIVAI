"use server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import type { DailyCheckIn, MetricDaily } from "@prisma/client";
import { generateWeeklyPlan, AthleteContext } from "@/lib/services/coach-engine";
import { enhancePlanWithOpenAI, isOpenAIAvailable } from "@/lib/services/openai-coach";
import { addDays, startOfWeek } from "@/lib/utils";
import { calculateReadinessScore, type CheckInData } from "@/lib/services/daily-checkin.service";
import { getFeedbackPatterns } from "@/lib/actions/workout-feedback";
import { buildAIContextForUser } from "@/lib/services/ai-context.builder";

type BuiltAIContext = Awaited<ReturnType<typeof buildAIContextForUser>>;

export type { BuiltAIContext };

function hrTargetForIntensity(ctx: BuiltAIContext, intensity: string): string | null {
  const z = ctx.zones.hr;
  const fmt = (min: number | null, max: number | null) =>
    typeof min === "number" && typeof max === "number" ? `${min}–${max} bpm` : null;

  if (intensity === "recovery") return fmt(z.z1.min, z.z1.max);
  if (intensity === "easy") return fmt(z.z2.min, z.z2.max);
  if (intensity === "moderate") return fmt(z.z3.min, z.z3.max);
  if (intensity === "hard") return fmt(z.z4.min, z.z4.max);
  return null;
}

type WorkoutPrescriptionV1 = {
  version: 1;
  overview: {
    durationMin: number;
    intensity: string;
  };
  warmUp: { minutes: number; text: string };
  mainSet: { minutes: number; text: string };
  coolDown: { minutes: number; text: string };
  targets: Array<{ label: string; value: string }>;
  why: string;
  contextUsed?: Array<{ label: string; value: string }>;
};

export async function buildWorkoutPrescriptionJson(params: {
  workout: {
    title: string;
    type: string;
    durationMin: number;
    intensity: string;
    aiReason: string;
    warmUpText?: string | null;
    mainSetText?: string | null;
    coolDownText?: string | null;
    extraTargets?: Array<{ label: string; value: string }> | null;
  };
  aiContext: BuiltAIContext;
}): Promise<string> {
  const { workout, aiContext } = params;
  const warmup = Math.max(8, Math.round(workout.durationMin * 0.15));
  const cooldown = Math.max(5, Math.round(workout.durationMin * 0.1));
  const main = Math.max(10, workout.durationMin - warmup - cooldown);

  const hrTarget = hrTargetForIntensity(aiContext, workout.intensity);
  const pwrTarget = powerTargetForIntensity(aiContext, workout.intensity);
  const poolLen = aiContext.userProfile.swimPoolLengthM;

  const targets: Array<{ label: string; value: string }> = [];
  if (hrTarget) targets.push({ label: "HR target", value: hrTarget });
  if (pwrTarget && workout.type === "bike") targets.push({ label: "Power target", value: pwrTarget });

  const rpe =
    workout.intensity === "recovery"
      ? "2/10"
      : workout.intensity === "easy"
        ? "3/10"
        : workout.intensity === "moderate"
          ? "6/10"
          : workout.intensity === "hard"
            ? "8–9/10"
            : "6/10";
  targets.push({ label: "RPE", value: rpe });

  if (Array.isArray(workout.extraTargets)) {
    const seen = new Set(targets.map((t) => `${t.label}|${t.value}`));
    for (const t of workout.extraTargets) {
      if (!t || typeof t.label !== "string" || typeof t.value !== "string") continue;
      const label = t.label.trim();
      const value = t.value.trim();
      if (label.length < 1 || value.length < 1) continue;
      const key = `${label}|${value}`;
      if (seen.has(key)) continue;
      seen.add(key);
      targets.push({ label, value });
    }
  }

  const defaultMainSetText = (() => {
    if (workout.type === "run") {
      if (workout.intensity === "hard") {
        const reps = 6;
        return `${reps}x 2 min strong / 2 min easy jog. Fill remaining time with steady aerobic running.`;
      }
      if (workout.intensity === "moderate") {
        return `Steady tempo / “comfortably hard” effort. Keep it controlled and smooth.`;
      }
      return `Conversational aerobic running. Keep cadence relaxed and focus on form.`;
    }

    if (workout.type === "bike") {
      if (workout.intensity === "hard") {
        return `5x 3 min hard / 3 min easy spin. Stay seated, smooth power.`;
      }
      if (workout.intensity === "moderate") {
        return `Sustained steady pressure (threshold/tempo feel). Keep power smooth, no surges.`;
      }
      return `Endurance spin. Keep effort easy and cadence comfortable.`;
    }

    if (workout.type === "swim") {
      const pool = typeof poolLen === "number" && poolLen > 0 ? `${poolLen}m pool` : "pool";
      if (workout.intensity === "hard") {
        return `12x 50m strong on consistent rest (in a ${pool}). Focus on good turns and streamlined body position.`;
      }
      if (workout.intensity === "moderate") {
        return `8x 100m steady with smooth technique (in a ${pool}). Keep stroke long and relaxed.`;
      }
      return `Easy continuous swimming + technique drills. Prioritize rhythm and breathing.`;
    }

    if (workout.type === "strength") {
      return `4 rounds of: squat pattern, hinge pattern, push, pull, core. Keep loads moderate and form perfect.`;
    }

    return `Steady work at the planned effort.`;
  })();

  const mainSetText = workout.mainSetText && workout.mainSetText.trim().length > 0 ? workout.mainSetText.trim() : defaultMainSetText;
  const warmUpText = workout.warmUpText && workout.warmUpText.trim().length > 0 ? workout.warmUpText.trim() : "Easy build + mobility. Finish with 3 short pickups to open the legs/arms.";
  const coolDownText =
    workout.coolDownText && workout.coolDownText.trim().length > 0
      ? workout.coolDownText.trim()
      : "Easy effort. If time: light stretching and hydration.";

  const contextUsed: Array<{ label: string; value: string }> = [];
  if (aiContext.userProfile.equipmentNotes) {
    contextUsed.push({ label: "Equipment", value: aiContext.userProfile.equipmentNotes });
  }
  if (aiContext.userProfile.terrainNotes) {
    contextUsed.push({ label: "Terrain", value: aiContext.userProfile.terrainNotes });
  }
  if (aiContext.userProfile.availabilityNotes) {
    contextUsed.push({ label: "Availability", value: aiContext.userProfile.availabilityNotes });
  }
  if (typeof poolLen === "number" && poolLen > 0) {
    contextUsed.push({ label: "Pool length", value: `${poolLen}m` });
  }

  const prescription: WorkoutPrescriptionV1 = {
    version: 1,
    overview: {
      durationMin: workout.durationMin,
      intensity: workout.intensity,
    },
    warmUp: {
      minutes: warmup,
      text: warmUpText,
    },
    mainSet: {
      minutes: main,
      text: mainSetText,
    },
    coolDown: {
      minutes: cooldown,
      text: coolDownText,
    },
    targets,
    why: `Because ${workout.aiReason}.`,
    contextUsed: contextUsed.length > 0 ? contextUsed : undefined,
  };

  return JSON.stringify(prescription);
}

function powerTargetForIntensity(ctx: BuiltAIContext, intensity: string): string | null {
  const ftp = ctx.zones.power.ftp;
  if (typeof ftp !== "number" || ftp <= 0) return null;

  const pct = (a: number, b: number) => `${Math.round(a * 100)}–${Math.round(b * 100)}% FTP (~${Math.round(ftp * a)}–${Math.round(ftp * b)} W)`;

  if (intensity === "recovery") return pct(0.5, 0.6);
  if (intensity === "easy") return pct(0.6, 0.75);
  if (intensity === "moderate") return pct(0.8, 0.9);
  if (intensity === "hard") return pct(0.95, 1.1);
  return null;
}

export async function buildWorkoutDescriptionMd(params: {
  workout: {
    title: string;
    type: string;
    durationMin: number;
    intensity: string;
    aiReason: string;
    warmUpText?: string | null;
    mainSetText?: string | null;
    coolDownText?: string | null;
    extraTargets?: Array<{ label: string; value: string }> | null;
  };
  aiContext: BuiltAIContext;
}): Promise<string> {
  const { workout, aiContext } = params;
  const warmup = Math.max(8, Math.round(workout.durationMin * 0.15));
  const cooldown = Math.max(5, Math.round(workout.durationMin * 0.1));
  const main = Math.max(10, workout.durationMin - warmup - cooldown);

  const hrTarget = hrTargetForIntensity(aiContext, workout.intensity);
  const pwrTarget = powerTargetForIntensity(aiContext, workout.intensity);
  const poolLen = aiContext.userProfile.swimPoolLengthM;

  const envLines: string[] = [];
  if (aiContext.userProfile.equipmentNotes) envLines.push(`- **Equipment:** ${aiContext.userProfile.equipmentNotes}`);
  if (aiContext.userProfile.terrainNotes) envLines.push(`- **Terrain:** ${aiContext.userProfile.terrainNotes}`);
  if (aiContext.userProfile.availabilityNotes) envLines.push(`- **Availability:** ${aiContext.userProfile.availabilityNotes}`);
  if (typeof poolLen === "number" && poolLen > 0) envLines.push(`- **Pool length:** ${poolLen}m`);

  const targets: string[] = [];
  if (hrTarget) targets.push(`- **HR target:** ${hrTarget}`);
  if (pwrTarget && workout.type === "bike") targets.push(`- **Power target:** ${pwrTarget}`);

  const rpe =
    workout.intensity === "recovery"
      ? "2/10"
      : workout.intensity === "easy"
        ? "3/10"
        : workout.intensity === "moderate"
          ? "6/10"
          : workout.intensity === "hard"
            ? "8–9/10"
            : "6/10";
  targets.push(`- **RPE:** ${rpe}`);

  if (Array.isArray(workout.extraTargets)) {
    const extra = workout.extraTargets
      .filter((t) => t && typeof t.label === "string" && typeof t.value === "string")
      .map((t) => ({ label: t.label.trim(), value: t.value.trim() }))
      .filter((t) => t.label.length > 0 && t.value.length > 0)
      .map((t) => `- **${t.label}:** ${t.value}`);

    for (const line of extra) {
      if (!targets.includes(line)) targets.push(line);
    }
  }

  const warmUpText = workout.warmUpText && workout.warmUpText.trim().length > 0 ? workout.warmUpText.trim() : "Easy build + mobility. Finish with 3 short pickups to open the legs/arms.";
  const coolDownText =
    workout.coolDownText && workout.coolDownText.trim().length > 0
      ? workout.coolDownText.trim()
      : "Easy effort. If time: light stretching and hydration.";

  const defaultMainSet = (() => {
    if (workout.type === "run") {
      if (workout.intensity === "hard") {
        const reps = 6;
        return `Main set (${main} min): ${reps}x 2 min strong / 2 min easy jog. Fill remaining time with steady aerobic running.`;
      }
      if (workout.intensity === "moderate") {
        return `Main set (${main} min): steady tempo / “comfortably hard” effort. Keep it controlled and smooth.`;
      }
      return `Main set (${main} min): conversational aerobic running. Keep cadence relaxed and focus on form.`;
    }

    if (workout.type === "bike") {
      if (workout.intensity === "hard") {
        return `Main set (${main} min): 5x 3 min hard / 3 min easy spin. Stay seated, smooth power.`;
      }
      if (workout.intensity === "moderate") {
        return `Main set (${main} min): sustained steady pressure (threshold/tempo feel). Keep power smooth, no surges.`;
      }
      return `Main set (${main} min): endurance spin. Keep effort easy and cadence comfortable.`;
    }

    if (workout.type === "swim") {
      const pool = typeof poolLen === "number" && poolLen > 0 ? `${poolLen}m pool` : "pool";
      if (workout.intensity === "hard") {
        return `Main set (${main} min): 12x 50m strong on consistent rest (in a ${pool}). Focus on good turns and streamlined body position.`;
      }
      if (workout.intensity === "moderate") {
        return `Main set (${main} min): 8x 100m steady with smooth technique (in a ${pool}). Keep stroke long and relaxed.`;
      }
      return `Main set (${main} min): easy continuous swimming + technique drills. Prioritize rhythm and breathing.`;
    }

    if (workout.type === "strength") {
      return `Main set (${main} min): 4 rounds of: squat pattern, hinge pattern, push, pull, core. Keep loads moderate and form perfect.`;
    }

    return `Main set (${main} min): steady work at the planned effort.`;
  })();

  const mainSet = (() => {
    const custom = workout.mainSetText && workout.mainSetText.trim().length > 0 ? workout.mainSetText.trim() : null;
    if (!custom) return defaultMainSet;
    if (/^main set\b/i.test(custom)) return custom;
    return `Main set (${main} min): ${custom}`;
  })();

  const md: string[] = [];
  md.push(`## Overview`);
  md.push(`- **Duration:** ${workout.durationMin} min`);
  md.push(`- **Intensity:** ${workout.intensity}`);
  md.push("");
  md.push(`## Warm-up (${warmup} min)`);
  md.push(warmUpText);
  md.push("");
  md.push(`## Main set`);
  md.push(mainSet);
  md.push("");
  md.push(`## Cool-down (${cooldown} min)`);
  md.push(coolDownText);
  md.push("");
  md.push(`## Targets`);
  md.push(targets.join("\n"));
  md.push("");
  md.push(`## Why`);
  md.push(`Because ${workout.aiReason}.`);
  if (envLines.length > 0) {
    md.push("");
    md.push(`## Context used`);
    md.push(envLines.join("\n"));
  }
  return md.join("\n");
}

export interface GeneratePlanResult {
  success: boolean;
  error?: string;
  planLogId?: string;
  summaryMd?: string;
  workoutCount?: number;
  startDate?: string;
  endDate?: string;
  warnings?: string[];
}

export async function generateTrainingPlan(): Promise<GeneratePlanResult> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized" };
    }

    const userId = session.user.id;

    const aiContext = await buildAIContextForUser(userId);
    const ctxProfile = {
      sportPrimary: aiContext.userProfile.sportPrimary,
      experienceLevel: aiContext.userProfile.experienceLevel,
      weeklyHoursGoal: aiContext.goals.weeklyHoursGoal,
    };

    const [recentWorkouts, recentMetrics, recentCheckIns, feedbackPatterns] = await Promise.all([
      db.workout.findMany({
        where: {
          userId,
          date: { gte: addDays(new Date(), -14) },
        },
        orderBy: { date: "desc" },
      }),
      db.metricDaily.findMany({
        where: {
          userId,
          date: { gte: addDays(new Date(), -14) },
        },
        orderBy: { date: "desc" },
      }),
      db.dailyCheckIn.findMany({
        where: {
          userId,
          date: { gte: addDays(new Date(), -7) },
        },
        orderBy: { date: "desc" },
      }),
      getFeedbackPatterns(14),
    ]);

    const checkInReadinessScores: number[] = (recentCheckIns as DailyCheckIn[]).map((c) =>
      calculateReadinessScore({
        sleepDuration: c.sleepDuration,
        sleepQuality: c.sleepQuality,
        physicalFatigue: c.physicalFatigue,
        mentalReadiness: c.mentalReadiness,
        motivation: c.motivation,
        muscleSoreness: c.muscleSoreness,
        stressLevel: c.stressLevel,
        notes: c.notes ?? undefined,
      } as CheckInData)
    );
    const avgCheckInReadiness =
      checkInReadinessScores.length > 0
        ? Math.round(checkInReadinessScores.reduce((a, b) => a + b, 0) / checkInReadinessScores.length)
        : null;

    const context: AthleteContext = {
      profile: null,
      recentWorkouts,
      recentMetrics,
      weeklyHoursGoal: ctxProfile.weeklyHoursGoal ?? 6,
      sport: ctxProfile.sportPrimary ?? "running",
      experienceLevel: ctxProfile.experienceLevel ?? "intermediate",
      avgCheckInReadiness,
      feedbackPatterns,
    };

    let plan = generateWeeklyPlan(context);

    // Optionally enhance with OpenAI if available
    if (isOpenAIAvailable()) {
      plan = await enhancePlanWithOpenAI(plan, {
        sport: context.sport,
        level: context.experienceLevel,
        weeklyHoursGoal: context.weeklyHoursGoal,
      });
    }

    const existingWorkouts = await db.workout.findMany({
      where: {
        userId,
        date: {
          gte: plan.startDate,
          lte: plan.endDate,
        },
        planned: true,
        completed: false,
      },
    });

    if (existingWorkouts.length > 0) {
      await db.workout.deleteMany({
        where: {
          id: { in: existingWorkouts.map((w) => w.id) },
          aiGenerated: true,
        },
      });
    }

    const createdWorkouts = await Promise.all(
      plan.workouts.map(async (workout) => {
        const descriptionMd = await buildWorkoutDescriptionMd({ workout, aiContext });
        const prescriptionJson = await buildWorkoutPrescriptionJson({ workout, aiContext });
        return db.workout.create({
          data: {
            userId,
            title: workout.title,
            type: workout.type,
            date: workout.date,
            durationMin: workout.durationMin,
            tss: workout.estimatedTss,
            planned: true,
            completed: false,
            aiGenerated: true,
            aiReason: workout.aiReason,
            aiConfidence: workout.aiConfidence,
            descriptionMd,
            prescriptionJson,
            source: "rules",
          },
        });
      })
    );

    const planLog = await db.planGenerationLog.create({
      data: {
        userId,
        startDate: plan.startDate,
        endDate: plan.endDate,
        summaryMd: plan.summaryMd,
        constraintsJson: JSON.stringify(plan.constraints),
        warningsJson: plan.warnings.length > 0 ? JSON.stringify(plan.warnings) : null,
      },
    });

    return {
      success: true,
      planLogId: planLog.id,
      summaryMd: plan.summaryMd,
      workoutCount: createdWorkouts.length,
      startDate: plan.startDate.toISOString(),
      endDate: plan.endDate.toISOString(),
      warnings: plan.warnings,
    };
  } catch (error) {
    console.error("Generate plan error:", error);
    return { success: false, error: "Failed to generate training plan" };
  }
}

export async function getRecentPlanLogs() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return [];
    }

    return db.planGenerationLog.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
      take: 5,
    });
  } catch (error) {
    console.error("Get plan logs error:", error);
    return [];
  }
}

export async function getCoachContext() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return null;
    }

    const userId = session.user.id;

    const [profile, latestMetric, weekWorkouts] = await Promise.all([
      db.profile.findUnique({ where: { userId } }),
      db.metricDaily.findFirst({
        where: { userId },
        orderBy: { date: "desc" },
      }),
      db.workout.findMany({
        where: {
          userId,
          date: { gte: addDays(new Date(), -7) },
          completed: true,
        },
      }),
    ]);

    const weeklyHours = weekWorkouts.reduce((sum, w) => sum + (w.durationMin || 0), 0) / 60;
    const weeklyTss = weekWorkouts.reduce((sum, w) => sum + (w.tss || 0), 0);

    const metric = latestMetric as MetricDaily | null;
    const readinessScore = metric?.readinessScore;
    const legacyReadiness = ((latestMetric as unknown as { readiness?: unknown } | null) ?? null)?.readiness;
    const readiness =
      typeof readinessScore === "number"
        ? readinessScore
        : typeof legacyReadiness === "number"
        ? legacyReadiness
        : 0;

    return {
      sport: profile?.sportPrimary || "running",
      experienceLevel: profile?.experienceLevel || "intermediate",
      weeklyHoursGoal: profile?.weeklyHoursGoal || 6,
      currentCtl: latestMetric?.ctl || 0,
      currentAtl: latestMetric?.atl || 0,
      currentTsb: latestMetric?.tsb || 0,
      readiness,
      lastWeekHours: Math.round(weeklyHours * 10) / 10,
      lastWeekTss: weeklyTss,
      workoutsLastWeek: weekWorkouts.length,
    };
  } catch (error) {
    console.error("Get coach context error:", error);
    return null;
  }
}

/** Extended data for Coach page: today's workout, week metrics, last check-in */
export async function getCoachPageData() {
  try {
    const session = await auth();
    if (!session?.user?.id) return null;

    const userId = session.user.id;
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = addDays(todayStart, 1);
    const weekStart = startOfWeek(todayStart);
    const weekEnd = addDays(weekStart, 7);

    const [todayWorkouts, weekWorkouts, lastCheckIn, latestMetric] = await Promise.all([
      db.workout.findMany({
        where: { userId, date: { gte: todayStart, lt: todayEnd } },
        orderBy: { date: "asc" },
      }),
      db.workout.findMany({
        where: { userId, date: { gte: weekStart, lt: weekEnd }, planned: true },
      }),
      db.dailyCheckIn.findFirst({
        where: { userId },
        orderBy: { date: "desc" },
        select: { date: true },
      }),
      db.metricDaily.findFirst({
        where: { userId },
        orderBy: { date: "desc" },
      }),
    ]);

    const plannedHours = weekWorkouts.reduce((s, w) => s + (w.durationMin || 0) / 60, 0);
    const plannedTss = weekWorkouts.reduce((s, w) => s + (w.tss || 0), 0);
    const completedCount = weekWorkouts.filter((w) => w.completed).length;
    const plannedCount = weekWorkouts.length;
    const compliancePercent = plannedCount > 0 ? Math.round((completedCount / plannedCount) * 100) : 0;

    const metric = latestMetric as { atl?: number | null } | null;
    const atl = metric?.atl ?? 0;

    return {
      todayWorkout: todayWorkouts.length > 0 ? todayWorkouts[0] : null,
      todayTss: todayWorkouts.reduce((s, w) => s + (w.tss || 0), 0),
      weekPlannedHours: Math.round(plannedHours * 10) / 10,
      weekPlannedTss: Math.round(plannedTss),
      weekCompliancePercent: compliancePercent,
      rampStatus: "stable" as "rising" | "stable" | "spiking",
      lastCheckInDate: lastCheckIn?.date ?? null,
      atl,
    };
  } catch (error) {
    console.error("Get coach page data error:", error);
    return null;
  }
}
