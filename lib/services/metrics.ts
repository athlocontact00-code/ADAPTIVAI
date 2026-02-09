import { db } from "@/lib/db";
import { addDays, formatLocalDateInput, startOfDay } from "@/lib/utils";

const CTL_TAU = 42;
const ATL_TAU = 7;

/**
 * Exponential moving average of daily TSS. Returns latest CTL, ATL, TSB and full series for sparkline/chart.
 * When no TSS data, returns null.
 */
export function computeLoadFromDailyTSS(
  dailyTSS: { date: string; tss: number }[]
): { ctl: number; atl: number; tsb: number; series: { date: string; ctl: number; atl: number; tsb: number }[] } | null {
  if (dailyTSS.length === 0) return null;
  const hasAnyTSS = dailyTSS.some((d) => d.tss > 0);
  if (!hasAnyTSS) return null;
  const alphaCtl = 1 - Math.exp(-1 / CTL_TAU);
  const alphaAtl = 1 - Math.exp(-1 / ATL_TAU);
  let ctl = dailyTSS[0].tss;
  let atl = dailyTSS[0].tss;
  const series: { date: string; ctl: number; atl: number; tsb: number }[] = [];
  for (let i = 0; i < dailyTSS.length; i++) {
    const tss = dailyTSS[i].tss;
    ctl = ctl + alphaCtl * (tss - ctl);
    atl = atl + alphaAtl * (tss - atl);
    const tsb = ctl - atl;
    series.push({ date: dailyTSS[i].date, ctl, atl, tsb });
  }
  return { ctl, atl, tsb: ctl - atl, series };
}

export type DashboardMetrics = {
  ctl: number | null;
  atl: number | null;
  tsb: number | null;
  readiness: number | null;
  weeklyHours: number | null;
  weeklyTSS: number | null;
  lastWeekHours: number | null;
  lastWeekTSS: number | null;
  weeklyHoursDelta: number | null;
  weeklyTSSDelta: number | null;
  ctlDelta: number | null;
  ctlSparkline: number[];
  monthlyHours: number | null;
  workoutsThisWeek: number;
  chartData: Array<{ date: string; ctl: number; atl: number; tsb: number }>;
};

export async function getDashboardMetrics(userId: string): Promise<DashboardMetrics> {
  const today = new Date();
  const sevenDaysAgo = new Date(today);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const fourteenDaysAgo = new Date(today);
  fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);
  const thirtyDaysAgo = new Date(today);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const fortyTwoDaysAgo = addDays(today, -42);

  const [latestMetric, weekWorkouts, lastWeekWorkouts, monthWorkouts, chartData, ctlHistory, workouts42] =
    await Promise.all([
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
      db.workout.findMany({
        where: {
          userId,
          completed: true,
          date: { gte: fortyTwoDaysAgo },
        },
        select: { date: true, tss: true },
      }),
    ]);

  const weeklyHoursSum = weekWorkouts.reduce((sum, w) => sum + (w.durationMin || 0), 0) / 60;
  const weeklyTSSSum = weekWorkouts.reduce((sum, w) => sum + (w.tss || 0), 0);
  const lastWeekHoursSum = lastWeekWorkouts.reduce((sum, w) => sum + (w.durationMin || 0), 0) / 60;
  const lastWeekTSSSum = lastWeekWorkouts.reduce((sum, w) => sum + (w.tss || 0), 0);
  const monthlyHoursSum = monthWorkouts.reduce((sum, w) => sum + (w.durationMin || 0), 0) / 60;

  const weeklyHours =
    weekWorkouts.length > 0 ? Math.round(weeklyHoursSum * 10) / 10 : null;
  const weeklyTSS = weekWorkouts.length > 0 ? weeklyTSSSum : null;
  const lastWeekHours =
    lastWeekWorkouts.length > 0 ? Math.round(lastWeekHoursSum * 10) / 10 : null;
  const lastWeekTSS = lastWeekWorkouts.length > 0 ? lastWeekTSSSum : null;
  const monthlyHours =
    monthWorkouts.length > 0 ? Math.round(monthlyHoursSum * 10) / 10 : null;

  const weeklyHoursDelta =
    lastWeekHours != null &&
    lastWeekHours > 0 &&
    weeklyHours != null
      ? Math.round(((weeklyHours - lastWeekHours) / lastWeekHours) * 100)
      : null;
  const weeklyTSSDelta =
    lastWeekTSS != null &&
    lastWeekTSS > 0 &&
    weeklyTSS != null
      ? Math.round(((weeklyTSS - lastWeekTSS) / lastWeekTSS) * 100)
      : null;

  const dailyTSSMap = new Map<string, number>();
  for (const w of workouts42) {
    const key = formatLocalDateInput(new Date(w.date));
    const tss = w.tss ?? 0;
    dailyTSSMap.set(key, (dailyTSSMap.get(key) ?? 0) + tss);
  }
  const sortedDates: string[] = [];
  for (let d = 0; d < 42; d++) {
    const date = addDays(fortyTwoDaysAgo, d);
    sortedDates.push(formatLocalDateInput(date));
  }
  const dailyTSS = sortedDates.map((date) => ({
    date,
    tss: dailyTSSMap.get(date) ?? 0,
  }));

  const computedLoad = computeLoadFromDailyTSS(dailyTSS);
  const hasMetricLoad =
    latestMetric &&
    latestMetric.ctl != null &&
    latestMetric.atl != null &&
    latestMetric.tsb != null;

  let ctl: number | null;
  let atl: number | null;
  let tsb: number | null;
  let ctlSparkline: number[];
  let chartDataMapped: Array<{ date: string; ctl: number; atl: number; tsb: number }>;

  if (hasMetricLoad && chartData.length > 0) {
    ctl = latestMetric.ctl;
    atl = latestMetric.atl;
    tsb = latestMetric.tsb;
    ctlSparkline = ctlHistory.map((m) => m.ctl ?? 0);
    chartDataMapped = chartData.map((m) => ({
      date: formatLocalDateInput(new Date(m.date)),
      ctl: m.ctl ?? 0,
      atl: m.atl ?? 0,
      tsb: m.tsb ?? 0,
    }));
  } else if (computedLoad) {
    ctl = computedLoad.ctl;
    atl = computedLoad.atl;
    tsb = computedLoad.tsb;
    ctlSparkline = computedLoad.series.map((s) => s.ctl);
    chartDataMapped = computedLoad.series;
  } else {
    ctl = null;
    atl = null;
    tsb = null;
    ctlSparkline = [];
    chartDataMapped = [];
  }

  const ctlFirst = ctlSparkline[0] ?? 0;
  const ctlLast = ctlSparkline[ctlSparkline.length - 1] ?? 0;
  const ctlDelta =
    ctlFirst > 0 && ctlLast != null
      ? Math.round(((ctlLast - ctlFirst) / ctlFirst) * 100)
      : null;

  const readinessScore = (latestMetric as { readinessScore?: number; readiness?: number })?.readinessScore;
  const legacyReadiness = (latestMetric as { readinessScore?: number; readiness?: number })?.readiness;
  const readiness =
    typeof readinessScore === "number"
      ? readinessScore
      : typeof legacyReadiness === "number"
        ? legacyReadiness
        : null;

  return {
    ctl,
    atl,
    tsb,
    readiness,
    weeklyHours,
    weeklyTSS,
    lastWeekHours,
    lastWeekTSS,
    weeklyHoursDelta,
    weeklyTSSDelta,
    ctlDelta,
    ctlSparkline,
    monthlyHours,
    workoutsThisWeek: weekWorkouts.length,
    chartData: chartDataMapped,
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
