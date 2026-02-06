import { db } from "@/lib/db";
import { formatLocalDateInput } from "@/lib/utils";

export async function getDashboardMetrics(userId: string) {
  const today = new Date();
  const sevenDaysAgo = new Date(today);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const fourteenDaysAgo = new Date(today);
  fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);
  const thirtyDaysAgo = new Date(today);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const [latestMetric, weekWorkouts, lastWeekWorkouts, monthWorkouts, chartData, ctlHistory] = await Promise.all([
    db.metricDaily.findFirst({
      where: { userId },
      orderBy: { date: "desc" },
    }),
    db.workout.findMany({
      where: {
        userId,
        completed: true,
        date: { gte: sevenDaysAgo },
      },
    }),
    db.workout.findMany({
      where: {
        userId,
        completed: true,
        date: { gte: fourteenDaysAgo, lt: sevenDaysAgo },
      },
    }),
    db.workout.findMany({
      where: {
        userId,
        completed: true,
        date: { gte: thirtyDaysAgo },
      },
    }),
    db.metricDaily.findMany({
      where: {
        userId,
        date: { gte: thirtyDaysAgo },
      },
      orderBy: { date: "asc" },
    }),
    db.metricDaily.findMany({
      where: {
        userId,
        date: { gte: fourteenDaysAgo },
      },
      orderBy: { date: "asc" },
      select: { date: true, ctl: true },
    }),
  ]);

  const weeklyHours = weekWorkouts.reduce((sum, w) => sum + (w.durationMin || 0), 0) / 60;
  const weeklyTSS = weekWorkouts.reduce((sum, w) => sum + (w.tss || 0), 0);
  const lastWeekHours = lastWeekWorkouts.reduce((sum, w) => sum + (w.durationMin || 0), 0) / 60;
  const lastWeekTSS = lastWeekWorkouts.reduce((sum, w) => sum + (w.tss || 0), 0);
  const monthlyHours = monthWorkouts.reduce((sum, w) => sum + (w.durationMin || 0), 0) / 60;

  const weeklyHoursDelta = lastWeekHours > 0 ? Math.round(((weeklyHours - lastWeekHours) / lastWeekHours) * 100) : null;
  const weeklyTSSDelta = lastWeekTSS > 0 ? Math.round(((weeklyTSS - lastWeekTSS) / lastWeekTSS) * 100) : null;

  const ctlSparkline = ctlHistory.map((m) => m.ctl ?? 0);
  const ctlFirst = ctlSparkline[0] ?? 0;
  const ctlLast = ctlSparkline[ctlSparkline.length - 1] ?? 0;
  const ctlDelta = ctlFirst > 0 ? Math.round(((ctlLast - ctlFirst) / ctlFirst) * 100) : null;

  const readinessScore = (latestMetric as any)?.readinessScore;
  const legacyReadiness = (latestMetric as any)?.readiness;
  const readiness =
    typeof readinessScore === "number"
      ? readinessScore
      : typeof legacyReadiness === "number"
      ? legacyReadiness
      : null;

  return {
    ctl: latestMetric?.ctl ?? 0,
    atl: latestMetric?.atl ?? 0,
    tsb: latestMetric?.tsb ?? 0,
    readiness,
    weeklyHours: Math.round(weeklyHours * 10) / 10,
    weeklyTSS,
    lastWeekHours: Math.round(lastWeekHours * 10) / 10,
    lastWeekTSS,
    weeklyHoursDelta,
    weeklyTSSDelta,
    ctlDelta,
    ctlSparkline,
    monthlyHours: Math.round(monthlyHours * 10) / 10,
    workoutsThisWeek: weekWorkouts.length,
    chartData: chartData.map((m) => ({
      date: formatLocalDateInput(new Date(m.date)),
      ctl: m.ctl ?? 0,
      atl: m.atl ?? 0,
      tsb: m.tsb ?? 0,
    })),
  };
}

export async function getUpcomingWorkouts(userId: string, limit = 5) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return db.workout.findMany({
    where: {
      userId,
      date: { gte: today },
      planned: true,
      completed: false,
    },
    orderBy: { date: "asc" },
    take: limit,
  });
}

export async function getRecentWorkouts(userId: string, limit = 5) {
  return db.workout.findMany({
    where: {
      userId,
      completed: true,
    },
    orderBy: { date: "desc" },
    take: limit,
  });
}
