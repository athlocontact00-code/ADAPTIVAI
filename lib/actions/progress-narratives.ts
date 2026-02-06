"use server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { addDays, startOfWeek } from "@/lib/utils";
import {
  buildMonthlyNarrative,
  buildWeeklyNarrative,
  type MonthlyNarrative,
  type WeeklyNarrative,
} from "@/lib/services/progress-narrative.service";

function startOfLocalDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function avg(numbers: Array<number | null | undefined>): number | null {
  const vals = numbers.filter((n): n is number => typeof n === "number");
  if (vals.length === 0) return null;
  return Math.round(vals.reduce((s, n) => s + n, 0) / vals.length);
}

export type DeterministicProgressNarratives = {
  weekly: WeeklyNarrative;
  monthly: MonthlyNarrative;
};

export async function getDeterministicProgressNarratives(): Promise<DeterministicProgressNarratives | null> {
  const session = await auth();
  if (!session?.user?.id) return null;

  const userId = session.user.id;

  const today = startOfLocalDay(new Date());
  const weekStart = startOfWeek(today);
  const weekEndExclusive = addDays(weekStart, 7);
  const prevWeekStart = addDays(weekStart, -7);

  const monthStart = startOfLocalDay(new Date(today.getFullYear(), today.getMonth(), 1));
  const monthEndExclusive = startOfLocalDay(new Date(today.getFullYear(), today.getMonth() + 1, 1));
  const prevMonthStart = startOfLocalDay(new Date(today.getFullYear(), today.getMonth() - 1, 1));

  const [
    weekWorkouts,
    monthWorkouts,
    weekMetrics,
    prevWeekMetrics,
    monthMetrics,
    prevMonthMetrics,
    weekQuote,
    monthQuote,
    prevMonthCompleted,
  ] = await Promise.all([
    db.workout.findMany({
      where: { userId, date: { gte: weekStart, lt: weekEndExclusive } },
      select: { planned: true, completed: true, durationMin: true, tss: true },
    }),
    db.workout.findMany({
      where: { userId, date: { gte: monthStart, lt: monthEndExclusive } },
      select: { planned: true, completed: true, durationMin: true, tss: true },
    }),
    db.metricDaily.findMany({
      where: { userId, date: { gte: weekStart, lt: weekEndExclusive } },
      select: { readinessScore: true },
    }),
    db.metricDaily.findMany({
      where: { userId, date: { gte: prevWeekStart, lt: weekStart } },
      select: { readinessScore: true },
    }),
    db.metricDaily.findMany({
      where: { userId, date: { gte: monthStart, lt: monthEndExclusive } },
      select: { readinessScore: true },
    }),
    db.metricDaily.findMany({
      where: { userId, date: { gte: prevMonthStart, lt: monthStart } },
      select: { readinessScore: true },
    }),
    db.postWorkoutFeedback.findFirst({
      where: {
        userId,
        visibleToAI: true,
        comment: { not: null },
        createdAt: { gte: weekStart, lt: weekEndExclusive },
      },
      orderBy: { createdAt: "asc" },
      select: { comment: true },
    }),
    db.postWorkoutFeedback.findFirst({
      where: {
        userId,
        visibleToAI: true,
        comment: { not: null },
        createdAt: { gte: monthStart, lt: monthEndExclusive },
      },
      orderBy: { createdAt: "asc" },
      select: { comment: true },
    }),
    db.workout.findMany({
      where: { userId, completed: true, date: { gte: prevMonthStart, lt: monthStart } },
      select: { tss: true },
    }),
  ]);

  const weekPlanned = weekWorkouts.filter((w) => w.planned);
  const weekCompletedPlanned = weekPlanned.filter((w) => w.completed);
  const weekPlannedMin = weekPlanned.reduce((s, w) => s + (w.durationMin || 0), 0);
  const weekCompletedMin = weekCompletedPlanned.reduce((s, w) => s + (w.durationMin || 0), 0);
  const weekCompliancePercent = Math.round(
    (weekCompletedPlanned.length / Math.max(1, weekPlanned.length)) * 100
  );

  const monthPlanned = monthWorkouts.filter((w) => w.planned);
  const monthCompletedPlanned = monthPlanned.filter((w) => w.completed);
  const monthCompletedAll = monthWorkouts.filter((w) => w.completed);
  const monthCompletedMin = monthCompletedAll.reduce((s, w) => s + (w.durationMin || 0), 0);
  const monthCompliancePercent = Math.round(
    (monthCompletedPlanned.length / Math.max(1, monthPlanned.length)) * 100
  );

  const monthTotalTss = monthCompletedAll.reduce((s, w) => s + (w.tss || 0), 0);
  const prevMonthTotalTss = prevMonthCompleted.reduce((s, w) => s + (w.tss || 0), 0);

  const weekly = buildWeeklyNarrative({
    weekStart,
    weekEnd: addDays(weekStart, 6),
    plannedHours: weekPlannedMin / 60,
    completedHours: weekCompletedMin / 60,
    compliancePercent: weekCompliancePercent,
    avgReadiness: avg(weekMetrics.map((m) => m.readinessScore)),
    prevAvgReadiness: avg(prevWeekMetrics.map((m) => m.readinessScore)),
    quote: weekQuote?.comment ? weekQuote.comment : undefined,
  });

  const monthly = buildMonthlyNarrative({
    monthStart,
    monthEnd: addDays(monthEndExclusive, -1),
    totalHours: monthCompletedMin / 60,
    compliancePercent: monthCompliancePercent,
    avgReadiness: avg(monthMetrics.map((m) => m.readinessScore)),
    prevAvgReadiness: avg(prevMonthMetrics.map((m) => m.readinessScore)),
    totalTss: monthTotalTss,
    prevTotalTss: prevMonthTotalTss,
    quote: monthQuote?.comment ? monthQuote.comment : undefined,
  });

  return { weekly, monthly };
}
