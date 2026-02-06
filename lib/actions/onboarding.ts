"use server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { addDays, startOfMonth, endOfMonth, startOfWeek } from "@/lib/utils";

export type OnboardingStatus = {
  hasProfileConfigured: boolean;
  hasSeason: boolean;
  hasPlannedWorkoutsThisWeek: boolean;
  hasCheckInToday: boolean;
  hasDiaryEntryThisMonth: boolean;
  hasPostWorkoutFeedbackLast7d: boolean;
};

/** Computes onboarding progress from existing DB data. */
export async function getOnboardingStatus(): Promise<OnboardingStatus | null> {
  try {
    const session = await auth();
    if (!session?.user?.id) return null;

    const userId = session.user.id;
    const now = new Date();
    now.setHours(12, 0, 0, 0);
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = addDays(todayStart, 1);
    const weekStart = startOfWeek(now);
    const weekEnd = addDays(weekStart, 7);
    const monthStart = startOfMonth(now);
    const monthEnd = endOfMonth(now);
    const sevenDaysAgo = addDays(now, -7);

    const [
      profile,
      seasonCount,
      plannedWorkoutsThisWeek,
      checkInToday,
      diaryThisMonth,
      feedbackLast7d,
    ] = await Promise.all([
      db.profile.findUnique({
        where: { userId },
        select: {
          sportPrimary: true,
          weeklyHoursGoal: true,
          ftp: true,
          zone1Min: true,
          restingHR: true,
          maxHR: true,
        },
      }),
      db.season.count({ where: { userId } }),
      db.workout.count({
        where: {
          userId,
          planned: true,
          date: { gte: weekStart, lt: weekEnd },
        },
      }),
      db.dailyCheckIn.findFirst({
        where: {
          userId,
          date: { gte: todayStart, lt: todayEnd },
        },
      }),
      db.diaryEntry.findFirst({
        where: {
          userId,
          date: { gte: monthStart, lte: monthEnd },
        },
      }),
      db.postWorkoutFeedback.findFirst({
        where: {
          userId,
          createdAt: { gte: sevenDaysAgo },
        },
      }),
    ]);

    const hasProfileConfigured = !!(
      profile &&
      (profile.sportPrimary ||
        (typeof profile.weeklyHoursGoal === "number" && profile.weeklyHoursGoal > 0) ||
        (typeof profile.ftp === "number" && profile.ftp > 0) ||
        (typeof profile.zone1Min === "number") ||
        (typeof profile.restingHR === "number") ||
        (typeof profile.maxHR === "number"))
    );

    return {
      hasProfileConfigured,
      hasSeason: seasonCount > 0,
      hasPlannedWorkoutsThisWeek: plannedWorkoutsThisWeek > 0,
      hasCheckInToday: !!checkInToday,
      hasDiaryEntryThisMonth: !!diaryThisMonth,
      hasPostWorkoutFeedbackLast7d: !!feedbackLast7d,
    };
  } catch (e) {
    console.error("[Onboarding] getOnboardingStatus error:", e);
    return null;
  }
}

/** Dev-only: returns a sample status for UI testing. Never used in production. */
export async function getSampleOnboardingStatusForDev(): Promise<OnboardingStatus | null> {
  if (process.env.NODE_ENV !== "development") return null;
  return {
    hasProfileConfigured: true,
    hasSeason: true,
    hasPlannedWorkoutsThisWeek: true,
    hasCheckInToday: false,
    hasDiaryEntryThisMonth: false,
    hasPostWorkoutFeedbackLast7d: false,
  };
}
