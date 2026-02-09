"use server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { addDays, formatLocalDateInput, startOfWeek } from "@/lib/utils";
import {
  generateSeasonStructure,
  AutoSeasonConfig,
} from "@/lib/services/season.service";
import {
  generateWeeklyReport,
  generateMonthlyReport,
  getWeekStart,
  getMonthStart,
} from "@/lib/services/reports.service";
import { buildWeeklyNarrative, buildMonthlyNarrative } from "@/lib/services/progress-narrative.service";
import { getDashboardMetrics } from "@/lib/services/metrics";

// ============================================
// SEASON ACTIONS
// ============================================

export async function getSeasons() {
  const session = await auth();
  if (!session?.user?.id) return [];

  return (db as any).season.findMany({
    where: { userId: session.user.id },
    include: {
      trainingBlocks: { orderBy: { startDate: "asc" } },
      raceEvents: { orderBy: { date: "asc" } },
    },
    orderBy: { startDate: "desc" },
  });
}

export async function getActiveSeason() {
  const session = await auth();
  if (!session?.user?.id) return null;

  const today = new Date();
  today.setHours(12, 0, 0, 0);

  return (db as any).season.findFirst({
    where: {
      userId: session.user.id,
      startDate: { lte: today },
      endDate: { gte: today },
    },
    include: {
      trainingBlocks: { orderBy: { startDate: "asc" } },
      raceEvents: { orderBy: { date: "asc" } },
    },
  });
}

export async function createSeason(data: {
  name: string;
  startDate: string;
  endDate: string;
  primaryGoal?: string;
}) {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: "Unauthorized" };

  try {
    const season = await (db as any).season.create({
      data: {
        userId: session.user.id,
        name: data.name,
        startDate: new Date(data.startDate),
        endDate: new Date(data.endDate),
        primaryGoal: data.primaryGoal || null,
      },
    });

    return { success: true, data: season };
  } catch (error) {
    console.error("Error creating season:", error);
    return { success: false, error: "Failed to create season" };
  }
}

export async function autoCreateSeason(goalDate: string) {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: "Unauthorized" };

  try {
    // Get user profile for sport and level
    const profile = await db.profile.findFirst({
      where: { userId: session.user.id },
    });

    const config: AutoSeasonConfig = {
      goalDate: new Date(goalDate),
      experienceLevel: profile?.experienceLevel || "intermediate",
      sport: profile?.sportPrimary || "running",
      weeklyHoursGoal: profile?.weeklyHoursGoal || 8,
    };

    const structure = generateSeasonStructure(config);

    // Create season
    const season = await (db as any).season.create({
      data: {
        userId: session.user.id,
        name: structure.name,
        startDate: structure.startDate,
        endDate: structure.endDate,
        primaryGoal: structure.primaryGoal,
      },
    });

    // Create blocks
    for (const block of structure.blocks) {
      await (db as any).trainingBlock.create({
        data: {
          seasonId: season.id,
          userId: session.user.id,
          type: block.type,
          startDate: block.startDate,
          endDate: block.endDate,
          focus: block.focus,
          targetHours: block.targetHours,
        },
      });
    }

    return { success: true, data: season };
  } catch (error) {
    console.error("Error auto-creating season:", error);
    return { success: false, error: "Failed to create season" };
  }
}

export async function createTrainingBlock(data: {
  seasonId: string;
  type: string;
  startDate: string;
  endDate: string;
  focus?: string;
  targetHours?: number;
}) {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: "Unauthorized" };

  try {
    const block = await (db as any).trainingBlock.create({
      data: {
        seasonId: data.seasonId,
        userId: session.user.id,
        type: data.type,
        startDate: new Date(data.startDate),
        endDate: new Date(data.endDate),
        focus: data.focus || null,
        targetHours: data.targetHours || null,
      },
    });

    return { success: true, data: block };
  } catch (error) {
    console.error("Error creating block:", error);
    return { success: false, error: "Failed to create block" };
  }
}

export async function createRaceEvent(data: {
  seasonId?: string;
  name: string;
  date: string;
  distance?: string;
  priority: string;
  goalTime?: string;
  notes?: string;
}) {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: "Unauthorized" };

  try {
    const race = await (db as any).raceEvent.create({
      data: {
        seasonId: data.seasonId || null,
        userId: session.user.id,
        name: data.name,
        date: new Date(data.date),
        distance: data.distance || null,
        priority: data.priority,
        goalTime: data.goalTime || null,
        notes: data.notes || null,
      },
    });

    return { success: true, data: race };
  } catch (error) {
    console.error("Error creating race:", error);
    return { success: false, error: "Failed to create race" };
  }
}

export async function deleteRaceEvent(id: string) {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: "Unauthorized" };

  try {
    await (db as any).raceEvent.delete({
      where: { id, userId: session.user.id },
    });
    return { success: true };
  } catch (error) {
    return { success: false, error: "Failed to delete race" };
  }
}

// ============================================
// PERSONAL BEST ACTIONS
// ============================================

export async function getPersonalBests() {
  const session = await auth();
  if (!session?.user?.id) return [];

  return (db as any).personalBest.findMany({
    where: { userId: session.user.id },
    orderBy: { date: "desc" },
  });
}

export async function createPersonalBest(data: {
  sport: string;
  discipline: string;
  valueNumber: number;
  valueUnit: string;
  date: string;
  notes?: string;
  source: string;
}) {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: "Unauthorized" };

  try {
    const pb = await (db as any).personalBest.create({
      data: {
        userId: session.user.id,
        sport: data.sport,
        discipline: data.discipline,
        valueNumber: data.valueNumber,
        valueUnit: data.valueUnit,
        date: new Date(data.date),
        notes: data.notes || null,
        source: data.source,
      },
    });

    return { success: true, data: pb };
  } catch (error) {
    console.error("Error creating PB:", error);
    return { success: false, error: "Failed to create personal best" };
  }
}

export async function deletePersonalBest(id: string) {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: "Unauthorized" };

  try {
    await (db as any).personalBest.delete({
      where: { id, userId: session.user.id },
    });
    return { success: true };
  } catch (error) {
    return { success: false, error: "Failed to delete PB" };
  }
}

// ============================================
// INJURY ACTIONS
// ============================================

export async function getInjuries() {
  const session = await auth();
  if (!session?.user?.id) return [];

  return (db as any).injuryEvent.findMany({
    where: { userId: session.user.id },
    orderBy: { startDate: "desc" },
  });
}

export async function createInjury(data: {
  startDate: string;
  endDate?: string;
  area: string;
  severity: string;
  status: string;
  notes?: string;
}) {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: "Unauthorized" };

  try {
    const injury = await (db as any).injuryEvent.create({
      data: {
        userId: session.user.id,
        startDate: new Date(data.startDate),
        endDate: data.endDate ? new Date(data.endDate) : null,
        area: data.area,
        severity: data.severity,
        status: data.status,
        notes: data.notes || null,
      },
    });

    return { success: true, data: injury };
  } catch (error) {
    console.error("Error creating injury:", error);
    return { success: false, error: "Failed to create injury" };
  }
}

export async function updateInjuryStatus(id: string, status: string, endDate?: string) {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: "Unauthorized" };

  try {
    await (db as any).injuryEvent.update({
      where: { id, userId: session.user.id },
      data: {
        status,
        endDate: endDate ? new Date(endDate) : null,
      },
    });
    return { success: true };
  } catch (error) {
    return { success: false, error: "Failed to update injury" };
  }
}

// ============================================
// REPORT ACTIONS
// ============================================

export async function getReports(type?: string) {
  const session = await auth();
  if (!session?.user?.id) return [];

  return (db as any).generatedReport.findMany({
    where: {
      userId: session.user.id,
      ...(type ? { type } : {}),
    },
    orderBy: { periodStart: "desc" },
    take: type === "WEEKLY" ? 8 : type === "MONTHLY" ? 6 : 12,
  });
}

export async function generateWeeklyReportAction(weekStartStr?: string) {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: "Unauthorized" };

  const userId = session.user.id;
  const weekStart = weekStartStr ? new Date(weekStartStr) : getWeekStart(addDays(new Date(), -7));
  weekStart.setHours(0, 0, 0, 0);

  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);
  weekEnd.setHours(23, 59, 59, 999);

  try {
    // Check if report already exists
    const existing = await (db as any).generatedReport.findFirst({
      where: { userId, type: "WEEKLY", periodStart: weekStart },
    });

    if (existing) {
      return { success: true, data: existing, message: "Report already exists" };
    }

    // Get workouts and metrics
    const [workouts, metrics, feedbackQuotes] = await Promise.all([
      db.workout.findMany({
        where: { userId, date: { gte: weekStart, lte: weekEnd } },
      }),
      db.metricDaily.findMany({
        where: { userId, date: { gte: weekStart, lte: weekEnd } },
      }),
      db.postWorkoutFeedback.findMany({
        where: {
          userId,
          visibleToAI: true,
          comment: { not: null },
          createdAt: { gte: weekStart, lte: weekEnd },
        },
        orderBy: { createdAt: "desc" },
        take: 5,
        select: { comment: true },
      }),
    ]);

    const report = generateWeeklyReport(
      workouts.map(w => ({
        date: w.date,
        durationMin: w.durationMin,
        tss: w.tss,
        type: w.type,
        completed: w.completed,
      })),
      metrics.map((m: any) => ({
        date: m.date,
        readinessScore: m.readinessScore,
        complianceScore: m.complianceScore,
        fatigueType: m.fatigueType,
        burnoutRisk: m.burnoutRisk,
        tss: m.tss,
      })),
      weekStart
    );

    const plannedHours = workouts
      .filter((w) => w.planned)
      .reduce((sum: number, w) => sum + (w.durationMin || 0), 0)
      / 60;
    const completedHours = workouts
      .filter((w) => w.completed)
      .reduce((sum: number, w) => sum + (w.durationMin || 0), 0)
      / 60;

    const readinessScores = (metrics as any[])
      .filter((m) => m.readinessScore != null)
      .map((m) => m.readinessScore as number);
    const avgReadiness = readinessScores.length > 0 ? Math.round(readinessScores.reduce((a: number, b: number) => a + b, 0) / readinessScores.length) : null;

    // previous week readiness baseline
    const prevWeekStart = new Date(weekStart);
    prevWeekStart.setDate(prevWeekStart.getDate() - 7);
    const prevWeekEnd = new Date(prevWeekStart);
    prevWeekEnd.setDate(prevWeekEnd.getDate() + 6);
    prevWeekEnd.setHours(23, 59, 59, 999);
    const prevMetrics = await db.metricDaily.findMany({
      where: { userId, date: { gte: prevWeekStart, lte: prevWeekEnd } },
    });
    const prevReadinessScores = (prevMetrics as any[])
      .filter((m) => m.readinessScore != null)
      .map((m) => m.readinessScore as number);
    const prevAvgReadiness = prevReadinessScores.length > 0 ? Math.round(prevReadinessScores.reduce((a: number, b: number) => a + b, 0) / prevReadinessScores.length) : null;

    const compliancePercent = Math.round((workouts.filter((w) => w.planned && w.completed).length / Math.max(1, workouts.filter((w) => w.planned).length)) * 100);
    const quote = feedbackQuotes.map((f) => f.comment).find((c): c is string => typeof c === "string" && c.trim().length >= 3);

    const narrative = buildWeeklyNarrative({
      weekStart,
      weekEnd,
      plannedHours,
      completedHours,
      compliancePercent,
      avgReadiness,
      prevAvgReadiness,
      quote,
    });

    const saved = await (db as any).generatedReport.create({
      data: {
        userId,
        type: "WEEKLY",
        periodStart: report.periodStart,
        periodEnd: report.periodEnd,
        title: report.title,
        summaryMd: narrative.markdown,
        metricsJson: JSON.stringify(report.metrics),
      },
    });

    return { success: true, data: saved };
  } catch (error) {
    console.error("Error generating weekly report:", error);
    return { success: false, error: "Failed to generate report" };
  }
}

export async function generateMonthlyReportAction(monthStartStr?: string) {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: "Unauthorized" };

  const userId = session.user.id;
  const monthStart = monthStartStr ? new Date(monthStartStr) : getMonthStart(addDays(new Date(), -30));
  monthStart.setHours(0, 0, 0, 0);

  const monthEnd = new Date(monthStart);
  monthEnd.setMonth(monthEnd.getMonth() + 1);
  monthEnd.setDate(0);
  monthEnd.setHours(23, 59, 59, 999);

  try {
    // Check if report already exists
    const existing = await (db as any).generatedReport.findFirst({
      where: { userId, type: "MONTHLY", periodStart: monthStart },
    });

    if (existing) {
      return { success: true, data: existing, message: "Report already exists" };
    }

    // Get workouts and metrics
    const [workouts, metrics, feedbackQuotes] = await Promise.all([
      db.workout.findMany({
        where: { userId, date: { gte: monthStart, lte: monthEnd } },
      }),
      db.metricDaily.findMany({
        where: { userId, date: { gte: monthStart, lte: monthEnd } },
      }),
      db.postWorkoutFeedback.findMany({
        where: {
          userId,
          visibleToAI: true,
          comment: { not: null },
          createdAt: { gte: monthStart, lte: monthEnd },
        },
        orderBy: { createdAt: "desc" },
        take: 5,
        select: { comment: true },
      }),
    ]);

    // Get previous month metrics for trends
    const prevMonthStart = new Date(monthStart);
    prevMonthStart.setMonth(prevMonthStart.getMonth() - 1);
    const prevMonthEnd = new Date(monthStart);
    prevMonthEnd.setDate(0);

    const prevWorkouts = await db.workout.findMany({
      where: { userId, date: { gte: prevMonthStart, lte: prevMonthEnd } },
    });

    const prevMetrics = await db.metricDaily.findMany({
      where: { userId, date: { gte: prevMonthStart, lte: prevMonthEnd } },
    });

    // Calculate previous month metrics for comparison
    const prevTotalTSS = prevWorkouts.filter(w => w.completed).reduce((sum, w) => sum + (w.tss || 0), 0);
    const prevReadiness = prevMetrics.filter((m: any) => m.readinessScore != null);
    const prevAvgReadiness = prevReadiness.length > 0
      ? Math.round(prevReadiness.reduce((a: number, b: any) => a + (b.readinessScore || 0), 0) / prevReadiness.length)
      : 0;
    const prevCompliance = prevMetrics.filter((m: any) => m.complianceScore != null);
    const prevAvgCompliance = prevCompliance.length > 0
      ? Math.round(prevCompliance.reduce((a: number, b: any) => a + (b.complianceScore || 0), 0) / prevCompliance.length)
      : 0;

    const report = generateMonthlyReport(
      workouts.map(w => ({
        date: w.date,
        durationMin: w.durationMin,
        tss: w.tss,
        type: w.type,
        completed: w.completed,
      })),
      metrics.map((m: any) => ({
        date: m.date,
        readinessScore: m.readinessScore,
        complianceScore: m.complianceScore,
        fatigueType: m.fatigueType,
        burnoutRisk: m.burnoutRisk,
        tss: m.tss,
      })),
      monthStart,
      {
        totalDuration: 0,
        totalTSS: prevTotalTSS,
        sessionsCount: 0,
        longestSession: 0,
        avgReadiness: prevAvgReadiness,
        avgCompliance: prevAvgCompliance,
        intensityDistribution: { easy: 0, moderate: 0, hard: 0 },
        fatigueTypes: {},
        complianceScore: prevAvgCompliance,
        burnoutRisk: 0,
      }
    );

    const totalHours = workouts.filter((w) => w.completed).reduce((sum: number, w) => sum + (w.durationMin || 0), 0) / 60;
    const totalTss = workouts.filter((w) => w.completed).reduce((sum: number, w) => sum + (w.tss || 0), 0);

    const readinessScores = (metrics as any[])
      .filter((m) => m.readinessScore != null)
      .map((m) => m.readinessScore as number);
    const avgReadiness = readinessScores.length > 0 ? Math.round(readinessScores.reduce((a: number, b: number) => a + b, 0) / readinessScores.length) : null;

    const prevMonthStart2 = new Date(monthStart);
    prevMonthStart2.setMonth(prevMonthStart2.getMonth() - 1);
    prevMonthStart2.setHours(0, 0, 0, 0);
    const prevMonthEnd2 = new Date(monthStart);
    prevMonthEnd2.setDate(0);
    prevMonthEnd2.setHours(23, 59, 59, 999);
    const prevMonthMetrics = await db.metricDaily.findMany({
      where: { userId, date: { gte: prevMonthStart2, lte: prevMonthEnd2 } },
    });
    const prevReadinessScores2 = (prevMonthMetrics as any[])
      .filter((m) => m.readinessScore != null)
      .map((m) => m.readinessScore as number);
    const prevAvgReadiness2 = prevReadinessScores2.length > 0 ? Math.round(prevReadinessScores2.reduce((a: number, b: number) => a + b, 0) / prevReadinessScores2.length) : null;

    const compliancePercent = Math.round((workouts.filter((w) => w.planned && w.completed).length / Math.max(1, workouts.filter((w) => w.planned).length)) * 100);
    const quote = feedbackQuotes.map((f) => f.comment).find((c): c is string => typeof c === "string" && c.trim().length >= 3);

    const narrative = buildMonthlyNarrative({
      monthStart,
      monthEnd,
      totalHours,
      compliancePercent,
      avgReadiness,
      prevAvgReadiness: prevAvgReadiness2,
      totalTss,
      prevTotalTss: prevTotalTSS,
      quote,
    });

    const saved = await (db as any).generatedReport.create({
      data: {
        userId,
        type: "MONTHLY",
        periodStart: report.periodStart,
        periodEnd: report.periodEnd,
        title: report.title,
        summaryMd: narrative.markdown,
        metricsJson: JSON.stringify(report.metrics),
      },
    });

    return { success: true, data: saved };
  } catch (error) {
    console.error("Error generating monthly report:", error);
    return { success: false, error: "Failed to generate report" };
  }
}

// ============================================
// TIMELINE DATA
// ============================================

export async function getTimelineData() {
  const session = await auth();
  if (!session?.user?.id) return { blocks: [], races: [], injuries: [], pbs: [], peakWeeks: [] };

  const userId = session.user.id;

  const [blocks, races, injuries, pbs, metrics] = await Promise.all([
    (db as any).trainingBlock.findMany({
      where: { userId },
      orderBy: { startDate: "desc" },
    }),
    (db as any).raceEvent.findMany({
      where: { userId },
      orderBy: { date: "desc" },
      include: { season: { select: { id: true, name: true } } },
    }),
    (db as any).injuryEvent.findMany({
      where: { userId },
      orderBy: { startDate: "desc" },
    }),
    (db as any).personalBest.findMany({
      where: { userId },
      orderBy: { date: "desc" },
    }),
    db.metricDaily.findMany({
      where: { userId, tss: { not: null } },
      orderBy: { tss: "desc" },
      take: 5,
    }),
  ]);

  // Peak weeks (top TSS days)
  const peakWeeks = metrics
    .filter((m: any) => m.tss && m.tss > 100)
    .map((m: any) => ({ date: m.date, tss: m.tss! }));

  return { blocks, races, injuries, pbs, peakWeeks };
}

// ============================================
// PROGRESS TRENDS (for charts)
// ============================================

export type ProgressTrendsData = {
  performanceData: { date: string; ctl: number; atl: number; tsb: number }[];
  weeklyLoad: { weekStart: string; tss: number; hours: number }[];
  readiness14d: { date: string; value: number }[];
  disciplineSplit: { name: string; value: number }[];
};

export async function getProgressTrends(): Promise<ProgressTrendsData | null> {
  const session = await auth();
  if (!session?.user?.id) return null;

  const userId = session.user.id;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const ninetyDaysAgo = addDays(today, -90);

  const [metrics90d, workouts90d] = await Promise.all([
    db.metricDaily.findMany({
      where: { userId, date: { gte: ninetyDaysAgo, lte: today } },
      orderBy: { date: "asc" },
    }),
    db.workout.findMany({
      where: { userId, date: { gte: ninetyDaysAgo, lte: today }, completed: true },
      select: { date: true, tss: true, durationMin: true, type: true },
    }),
  ]);

  const performanceData = metrics90d
    .filter((m: { ctl?: number | null; atl?: number | null; tsb?: number | null }) =>
      m.ctl != null || m.atl != null || m.tsb != null
    )
    .map((m: { date: Date; ctl?: number | null; atl?: number | null; tsb?: number | null }) => ({
      date: formatLocalDateInput(new Date(m.date)),
      ctl: Number(m.ctl) || 0,
      atl: Number(m.atl) || 0,
      tsb: Number(m.tsb) || 0,
    }));

  const weekMap = new Map<string, { tss: number; hours: number }>();
  for (const w of workouts90d) {
    const d = new Date(w.date);
    const wk = startOfWeek(d);
    const key = formatLocalDateInput(wk);
    const cur = weekMap.get(key) ?? { tss: 0, hours: 0 };
    cur.tss += Number(w.tss) || 0;
    cur.hours += (Number(w.durationMin) || 0) / 60;
    weekMap.set(key, cur);
  }
  const weeklyLoad = Array.from(weekMap.entries())
    .map(([weekStart, v]) => ({ weekStart, tss: Math.round(v.tss), hours: Math.round(v.hours * 10) / 10 }))
    .sort((a, b) => a.weekStart.localeCompare(b.weekStart));

  const fourteenDaysAgo = addDays(today, -14);
  const metrics14d = metrics90d.filter((m: { date: Date }) => new Date(m.date) >= fourteenDaysAgo);
  const readiness14d = metrics14d
    .filter((m: { readinessScore?: number | null }) => m.readinessScore != null)
    .map((m) => ({
      date: formatLocalDateInput(new Date(m.date)),
      value: m.readinessScore as number,
    }));

  const discMap = new Map<string, number>();
  for (const w of workouts90d) {
    const t = String(w.type || "other").toUpperCase();
    const key = t === "RUN" || t === "BIKE" || t === "SWIM" ? t : "STRENGTH";
    discMap.set(key, (discMap.get(key) ?? 0) + ((Number(w.durationMin) || 0) / 60));
  }
  const disciplineSplit = Array.from(discMap.entries())
    .filter(([, v]) => v > 0)
    .map(([name, value]) => ({ name, value: Math.round(value * 10) / 10 }))
    .sort((a, b) => b.value - a.value);

  return { performanceData, weeklyLoad, readiness14d, disciplineSplit };
}

// ============================================
// PROGRESS SUMMARY
// ============================================

export async function getProgressSummary() {
  const session = await auth();
  if (!session?.user?.id) return null;

  const userId = session.user.id;
  const today = new Date();
  today.setHours(23, 59, 59, 999);
  const weekAgo = addDays(today, -7);
  const fortnightAgo = addDays(today, -14);

  const [dashboardMetrics, latestMetric, weekMetrics, fortnightMetrics, activeSeason, upcomingRaces] = await Promise.all([
    getDashboardMetrics(userId),
    db.metricDaily.findFirst({
      where: { userId },
      orderBy: { date: "desc" },
    }),
    db.metricDaily.findMany({
      where: { userId, date: { gte: weekAgo, lte: today } },
      orderBy: { date: "asc" },
    }),
    db.metricDaily.findMany({
      where: { userId, date: { gte: fortnightAgo, lte: today } },
      orderBy: { date: "asc" },
    }),
    (db as any).season.findFirst({
      where: {
        userId,
        startDate: { lte: today },
        endDate: { gte: today },
      },
      include: { trainingBlocks: true },
    }),
    (db as any).raceEvent.findMany({
      where: { userId, date: { gte: today } },
      orderBy: { date: "asc" },
      take: 3,
      include: { season: { select: { id: true, name: true } } },
    }),
  ]);

  // Calculate trends
  const readinessTrend = weekMetrics
    .filter((m: any) => m.readinessScore != null)
    .map((m: any) => ({ date: formatLocalDateInput(new Date(m.date)), value: m.readinessScore! }));

  const complianceTrend = weekMetrics
    .filter((m: any) => m.complianceScore != null)
    .map((m: any) => ({ date: formatLocalDateInput(new Date(m.date)), value: m.complianceScore! }));

  // CTL sparkline from shared metrics service (real data from workouts)
  const ctlTrend = dashboardMetrics.ctlSparkline?.length >= 2 ? dashboardMetrics.ctlSparkline : undefined;

  // Delta: current 14d avg vs prev 14d avg
  const curr14 = fortnightMetrics;
  const prev14Start = addDays(fortnightAgo, -14) as Date;

  // Current block
  let currentBlock = null;
  if (activeSeason) {
    const todayNorm = new Date(today);
    todayNorm.setHours(12, 0, 0, 0);
    currentBlock = (activeSeason as any).trainingBlocks.find((b: any) => {
      const start = new Date(b.startDate);
      const end = new Date(b.endDate);
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
      return todayNorm >= start && todayNorm <= end;
    });
  }

  // Fetch prev 14d for delta
  const prev14Metrics = await db.metricDaily.findMany({
    where: { userId, date: { gte: prev14Start, lt: fortnightAgo } },
    orderBy: { date: "asc" },
  });

  const currCtlAvg = curr14.filter((m: any) => m.ctl != null).length
    ? Math.round((curr14.reduce((s: number, m: any) => s + (m.ctl ?? 0), 0) / curr14.filter((m: any) => m.ctl != null).length) * 10) / 10
    : null;
  const prevCtlAvg = prev14Metrics.filter((m: any) => m.ctl != null).length
    ? Math.round((prev14Metrics.reduce((s: number, m: any) => s + ((m as any).ctl ?? 0), 0) / prev14Metrics.filter((m: any) => (m as any).ctl != null).length) * 10) / 10
    : null;
  const deltaCtl = currCtlAvg != null && prevCtlAvg != null && prevCtlAvg > 0
    ? Math.round(((currCtlAvg - prevCtlAvg) / prevCtlAvg) * 100)
    : null;

  const currReadinessAvg = curr14.filter((m: any) => m.readinessScore != null).length
    ? Math.round(curr14.reduce((s: number, m: any) => s + (m.readinessScore ?? 0), 0) / curr14.filter((m: any) => m.readinessScore != null).length)
    : null;
  const prevReadinessAvg = prev14Metrics.filter((m: any) => (m as any).readinessScore != null).length
    ? Math.round(prev14Metrics.reduce((s: number, m: any) => s + ((m as any).readinessScore ?? 0), 0) / prev14Metrics.filter((m: any) => (m as any).readinessScore != null).length)
    : null;
  const deltaReadiness = currReadinessAvg != null && prevReadinessAvg != null ? currReadinessAvg - prevReadinessAvg : null;

  const currComplianceAvg = curr14.filter((m: any) => m.complianceScore != null).length
    ? Math.round(curr14.reduce((s: number, m: any) => s + (m.complianceScore ?? 0), 0) / curr14.filter((m: any) => m.complianceScore != null).length)
    : null;
  const prevComplianceAvg = prev14Metrics.filter((m: any) => (m as any).complianceScore != null).length
    ? Math.round(prev14Metrics.reduce((s: number, m: any) => s + ((m as any).complianceScore ?? 0), 0) / prev14Metrics.filter((m: any) => (m as any).complianceScore != null).length)
    : null;
  const deltaCompliance = currComplianceAvg != null && prevComplianceAvg != null ? currComplianceAvg - prevComplianceAvg : null;

  const activeSeasonName = activeSeason ? (activeSeason as any).name : null;

  return {
    ctl: dashboardMetrics.ctl ?? null,
    atl: dashboardMetrics.atl ?? null,
    tsb: dashboardMetrics.tsb ?? null,
    readiness: dashboardMetrics.readiness ?? null,
    compliance: (latestMetric as any)?.complianceScore ?? 0,
    burnoutRisk: (latestMetric as any)?.burnoutRisk ?? 0,
    readinessTrend,
    complianceTrend,
    ctlTrend,
    deltaCtl,
    deltaReadiness,
    deltaCompliance,
    currentBlock: currentBlock ? { type: currentBlock.type, focus: currentBlock.focus } : null,
    activeSeasonName,
    upcomingRaces: (upcomingRaces as any[]).map((r: any) => ({
      name: r.name,
      date: r.date,
      priority: r.priority,
      daysUntil: Math.ceil((r.date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)),
      seasonId: r.season?.id ?? null,
      seasonName: r.season?.name ?? null,
    })),
  };
}
