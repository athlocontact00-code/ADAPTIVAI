import { addDays, startOfWeek } from "@/lib/utils";

export type CalendarWorkout = {
  id: string;
  date: Date | string;
  planned: boolean;
  completed: boolean;
  durationMin: number | null;
  tss: number | null;
};

export type CalendarCheckIn = {
  id: string;
  date: Date | string;
  readinessScore: number | null;
  aiDecision?: string | null;
};

export type ReadinessTrend = {
  direction: "UP" | "DOWN" | "FLAT";
  delta: number;
};

export type WeeklySummary = {
  weekStart: Date;
  weekEnd: Date;
  totalDurationMin: number;
  totalTss: number;
  plannedDurationMin: number;
  plannedTss: number;
  plannedCount: number;
  completedPlannedCount: number;
  compliancePercent: number;
  avgReadiness: number | null;
  readinessTrend: ReadinessTrend;
  narrative: string;
};

export type MonthlySummary = {
  monthStart: Date;
  monthEnd: Date;
  totalDurationMin: number;
  totalTss: number;
  plannedDurationMin: number;
  plannedTss: number;
  plannedCount: number;
  completedPlannedCount: number;
  compliancePercent: number;
  hardSessionsCount: number;
  restDaysCount: number;
  avgReadiness: number | null;
  readinessTrend: ReadinessTrend;
  narrative: string;
};

function toDate(d: Date | string): Date {
  return d instanceof Date ? d : new Date(d);
}

function startOfLocalDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function localDayKey(d: Date): string {
  const x = startOfLocalDay(d);
  const y = x.getFullYear();
  const m = String(x.getMonth() + 1).padStart(2, "0");
  const day = String(x.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function endExclusiveOfLocalDay(d: Date): Date {
  const x = startOfLocalDay(d);
  x.setDate(x.getDate() + 1);
  return x;
}

function withinRange(d: Date, start: Date, endExclusive: Date): boolean {
  return d >= start && d < endExclusive;
}

function computeReadinessTrend(current: number | null, previous: number | null): ReadinessTrend {
  if (typeof current !== "number" || typeof previous !== "number") {
    return { direction: "FLAT", delta: 0 };
  }
  const delta = Math.round(current - previous);
  const direction = delta >= 5 ? "UP" : delta <= -5 ? "DOWN" : "FLAT";
  return { direction, delta };
}

function summarizeReadiness(checkIns: CalendarCheckIn[]): number | null {
  const scores = checkIns
    .map((c) => c.readinessScore)
    .filter((n): n is number => typeof n === "number");
  if (scores.length === 0) return null;
  const avg = scores.reduce((sum: number, s: number) => sum + s, 0) / scores.length;
  return Math.round(avg);
}

function summarizeWorkouts(workouts: CalendarWorkout[]) {
  const completed = workouts.filter((w) => w.completed);
  const totalDurationMin = completed.reduce((sum: number, w) => sum + (w.durationMin || 0), 0);
  const totalTss = completed.reduce((sum: number, w) => sum + (w.tss || 0), 0);

  const planned = workouts.filter((w) => w.planned);
  const plannedDurationMin = planned.reduce((sum: number, w) => sum + (w.durationMin || 0), 0);
  const plannedTss = planned.reduce((sum: number, w) => sum + (w.tss || 0), 0);
  const plannedCount = planned.length;
  const completedPlannedCount = planned.filter((w) => w.completed).length;
  const compliancePercent = Math.round((completedPlannedCount / Math.max(1, plannedCount)) * 100);

  const hardSessionsCount = completed.filter((w) => typeof w.tss === "number" && w.tss >= 80).length;

  return {
    totalDurationMin,
    totalTss,
    plannedDurationMin,
    plannedTss,
    plannedCount,
    completedPlannedCount,
    compliancePercent,
    hardSessionsCount,
  };
}

function weeklyNarrative(params: {
  compliancePercent: number;
  totalDurationMin: number;
  readinessTrend: ReadinessTrend;
}): string {
  const hours = Math.round((params.totalDurationMin / 60) * 10) / 10;

  const readinessLine =
    params.readinessTrend.direction === "UP"
      ? `Readiness trended up (+${params.readinessTrend.delta}).`
      : params.readinessTrend.direction === "DOWN"
      ? `Readiness trended down (${params.readinessTrend.delta}).`
      : "Readiness was stable.";

  if (params.compliancePercent >= 85) {
    return `Strong week: ${hours}h completed with ${params.compliancePercent}% compliance. ${readinessLine}`;
  }
  if (params.compliancePercent >= 60) {
    return `Solid week: ${hours}h completed with ${params.compliancePercent}% compliance. ${readinessLine}`;
  }
  return `Light week: ${hours}h completed with ${params.compliancePercent}% compliance. ${readinessLine}`;
}

function monthlyNarrative(params: {
  compliancePercent: number;
  totalDurationMin: number;
  readinessTrend: ReadinessTrend;
}): string {
  const hours = Math.round((params.totalDurationMin / 60) * 10) / 10;

  const readinessLine =
    params.readinessTrend.direction === "UP"
      ? `Readiness improved (+${params.readinessTrend.delta}).`
      : params.readinessTrend.direction === "DOWN"
      ? `Readiness declined (${params.readinessTrend.delta}).`
      : "Readiness was steady.";

  if (params.compliancePercent >= 85) {
    return `High consistency month: ${hours}h completed with ${params.compliancePercent}% compliance. ${readinessLine}`;
  }
  if (params.compliancePercent >= 60) {
    return `Moderate consistency month: ${hours}h completed with ${params.compliancePercent}% compliance. ${readinessLine}`;
  }
  return `Low consistency month: ${hours}h completed with ${params.compliancePercent}% compliance. ${readinessLine}`;
}

export function computeWeeklySummary(params: {
  weekStart: Date;
  workouts: CalendarWorkout[];
  checkIns: CalendarCheckIn[];
}): WeeklySummary {
  const weekStart = startOfLocalDay(params.weekStart);
  const weekEnd = addDays(weekStart, 6);
  const endExclusive = endExclusiveOfLocalDay(weekEnd);

  const weekWorkouts = params.workouts
    .map((w) => ({ ...w, date: toDate(w.date) }))
    .filter((w) => withinRange(w.date as Date, weekStart, endExclusive));

  const weekCheckIns = params.checkIns
    .map((c) => ({ ...c, date: toDate(c.date) }))
    .filter((c) => withinRange(c.date as Date, weekStart, endExclusive));

  const prevWeekStart = addDays(weekStart, -7);
  const prevWeekEnd = addDays(prevWeekStart, 6);
  const prevEndExclusive = endExclusiveOfLocalDay(prevWeekEnd);

  const prevCheckIns = params.checkIns
    .map((c) => ({ ...c, date: toDate(c.date) }))
    .filter((c) => withinRange(c.date as Date, prevWeekStart, prevEndExclusive));

  const avgReadiness = summarizeReadiness(weekCheckIns);
  const prevAvgReadiness = summarizeReadiness(prevCheckIns);
  const readinessTrend = computeReadinessTrend(avgReadiness, prevAvgReadiness);

  const w = summarizeWorkouts(weekWorkouts);

  return {
    weekStart,
    weekEnd,
    totalDurationMin: w.totalDurationMin,
    totalTss: w.totalTss,
    plannedDurationMin: w.plannedDurationMin,
    plannedTss: w.plannedTss,
    plannedCount: w.plannedCount,
    completedPlannedCount: w.completedPlannedCount,
    compliancePercent: w.compliancePercent,
    avgReadiness,
    readinessTrend,
    narrative: weeklyNarrative({
      compliancePercent: w.compliancePercent,
      totalDurationMin: w.totalDurationMin,
      readinessTrend,
    }),
  };
}

export function computeMonthlySummary(params: {
  monthStart: Date;
  workouts: CalendarWorkout[];
  checkIns: CalendarCheckIn[];
}): MonthlySummary {
  const monthStart = startOfLocalDay(params.monthStart);
  const monthEnd = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0);
  monthEnd.setHours(0, 0, 0, 0);
  const endExclusive = endExclusiveOfLocalDay(monthEnd);

  const monthWorkouts = params.workouts
    .map((w) => ({ ...w, date: toDate(w.date) }))
    .filter((w) => withinRange(w.date as Date, monthStart, endExclusive));

  const monthCheckIns = params.checkIns
    .map((c) => ({ ...c, date: toDate(c.date) }))
    .filter((c) => withinRange(c.date as Date, monthStart, endExclusive));

  const prevMonthStart = new Date(monthStart.getFullYear(), monthStart.getMonth() - 1, 1);
  prevMonthStart.setHours(0, 0, 0, 0);
  const prevMonthEnd = new Date(prevMonthStart.getFullYear(), prevMonthStart.getMonth() + 1, 0);
  prevMonthEnd.setHours(0, 0, 0, 0);
  const prevEndExclusive = endExclusiveOfLocalDay(prevMonthEnd);

  const prevCheckIns = params.checkIns
    .map((c) => ({ ...c, date: toDate(c.date) }))
    .filter((c) => withinRange(c.date as Date, prevMonthStart, prevEndExclusive));

  const avgReadiness = summarizeReadiness(monthCheckIns);
  const prevAvgReadiness = summarizeReadiness(prevCheckIns);
  const readinessTrend = computeReadinessTrend(avgReadiness, prevAvgReadiness);

  const w = summarizeWorkouts(monthWorkouts);

  const completedByDay = new Set(
    monthWorkouts
      .filter((x) => x.completed)
      .map((x) => localDayKey(x.date as Date))
  );
  let restDaysCount = 0;
  for (let d = new Date(monthStart); d < endExclusive; d = addDays(d, 1)) {
    if (!completedByDay.has(localDayKey(d))) restDaysCount += 1;
  }

  return {
    monthStart,
    monthEnd,
    totalDurationMin: w.totalDurationMin,
    totalTss: w.totalTss,
    plannedDurationMin: w.plannedDurationMin,
    plannedTss: w.plannedTss,
    plannedCount: w.plannedCount,
    completedPlannedCount: w.completedPlannedCount,
    compliancePercent: w.compliancePercent,
    hardSessionsCount: w.hardSessionsCount,
    restDaysCount,
    avgReadiness,
    readinessTrend,
    narrative: monthlyNarrative({
      compliancePercent: w.compliancePercent,
      totalDurationMin: w.totalDurationMin,
      readinessTrend,
    }),
  };
}

export function getMonthGrid(params: { monthDate: Date }): {
  monthStart: Date;
  gridStart: Date;
  days: Date[];
  weeks: Date[][];
} {
  const monthStart = new Date(params.monthDate.getFullYear(), params.monthDate.getMonth(), 1);
  monthStart.setHours(0, 0, 0, 0);
  const gridStart = startOfWeek(monthStart);

  const days = Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
  const weeks = Array.from({ length: 6 }, (_, w) => days.slice(w * 7, w * 7 + 7));

  return { monthStart, gridStart, days, weeks };
}

export function getWeekStartForDate(d: Date): Date {
  return startOfWeek(d);
}
