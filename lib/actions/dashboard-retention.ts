"use server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { createRequestId, logError, logInfo } from "@/lib/logger";

export type NextActionKind =
  | "DO_CHECKIN"
  | "COMPLETE_CHECKIN_OR_SKIP"
  | "START_WORKOUT"
  | "ADD_FEEDBACK"
  | "PLAN_WORKOUT";

export type DashboardNextAction = {
  kind: NextActionKind;
  title: string;
  subtitle: string;
  workout?: {
    id: string;
    title: string;
    type: string;
    date: string;
    durationMin: number | null;
    tss: number | null;
    completed: boolean;
  };
  gate?: {
    required: boolean;
    checkInDone: boolean;
    skipped: boolean;
  };
  todayCheckIn?: {
    id: string;
    aiDecision: string | null;
    userAccepted: boolean | null;
  };
};

export type DashboardStreaks = {
  checkInDayStreak: number;
  workoutWeekStreak: number;
  workoutWeekThreshold: number;
};

export type DashboardNudges = {
  showOverrideSignal: boolean;
  overrideCount7d: number;
  showPainSignal: boolean;
  painCount7d: number;
  // Noon nudge is evaluated client-side using local time.
  canShowNoonCheckInNudge: boolean;
};

export type WeeklyExportSummary = {
  filename: string;
  markdown: string;
};

export type DashboardRetentionSummary = {
  nextAction: DashboardNextAction;
  streaks: DashboardStreaks;
  nudges: DashboardNudges;
};

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function addDays(d: Date, days: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + days);
  return x;
}

function startOfWeekMonday(d: Date) {
  const x = startOfDay(d);
  const day = x.getDay();
  const diff = (day + 6) % 7; // Mon=0
  x.setDate(x.getDate() - diff);
  return x;
}

export async function getDashboardRetentionSummary(): Promise<DashboardRetentionSummary> {
  const requestId = createRequestId();
  const session = await auth();
  if (!session?.user?.id) {
    return {
      nextAction: {
        kind: "PLAN_WORKOUT",
        title: "Plan your next workout",
        subtitle: "Sign in to see your plan.",
      },
      streaks: { checkInDayStreak: 0, workoutWeekStreak: 0, workoutWeekThreshold: 3 },
      nudges: {
        showOverrideSignal: false,
        overrideCount7d: 0,
        showPainSignal: false,
        painCount7d: 0,
        canShowNoonCheckInNudge: false,
      },
    };
  }

  const userId = session.user.id;

  try {
    const today = startOfDay(new Date());
    const tomorrow = addDays(today, 1);

    const [
      todayWorkouts,
      nextWorkout,
      todayCheckIn,
      todayCheckInForGate,
      skipAuditToday,
      latestOverrideSignal,
      painFeedback7d,
      recentCheckIns,
      recentCompletedWorkouts,
    ] = await Promise.all([
      db.workout.findMany({
        where: { userId, date: { gte: today, lt: tomorrow } },
        orderBy: { date: "asc" },
      }),
      db.workout.findFirst({
        where: { userId, completed: false, date: { gte: tomorrow } },
        orderBy: { date: "asc" },
      }),
      db.dailyCheckIn.findUnique({
        where: { userId_date: { userId, date: today } },
        select: { id: true, aiDecision: true, userAccepted: true },
      }),
      db.dailyCheckIn.findUnique({
        where: { userId_date: { userId, date: today } },
        select: { id: true },
      }),
      db.auditLog.findFirst({
        where: {
          userId,
          actionType: "PRETRAINING_SKIPPED",
          createdAt: { gte: today },
        },
        orderBy: { createdAt: "desc" },
      }),
      db.auditLog.findFirst({
        where: {
          userId,
          actionType: "OVERRIDE_BEHAVIOR_SIGNAL",
          createdAt: { gte: addDays(today, -7) },
        },
        orderBy: { createdAt: "desc" },
      }),
      db.postWorkoutFeedback.findMany({
        where: {
          userId,
          createdAt: { gte: addDays(today, -7) },
          discomfort: { in: ["MODERATE", "SEVERE"] },
        },
        select: { id: true },
      }),
      db.dailyCheckIn.findMany({
        where: { userId, date: { gte: addDays(today, -60), lte: today } },
        orderBy: { date: "desc" },
        select: { date: true },
      }),
      db.workout.findMany({
        where: { userId, completed: true, date: { gte: addDays(today, -140), lte: tomorrow } },
        orderBy: { date: "desc" },
        select: { date: true },
      }),
    ]);

    const workoutWeekThreshold = 3;

    // Check-in day streak
    let checkInDayStreak = 0;
    let cursor = today;
    for (const ci of recentCheckIns) {
      const d = startOfDay(ci.date);
      if (d.getTime() !== cursor.getTime()) {
        if (checkInDayStreak === 0) {
          cursor = addDays(cursor, -1);
          if (d.getTime() === cursor.getTime()) {
            checkInDayStreak += 1;
            cursor = addDays(cursor, -1);
            continue;
          }
        }
        break;
      }
      checkInDayStreak += 1;
      cursor = addDays(cursor, -1);
    }

    // Weekly workout streak
    const weekCounts = new Map<string, number>();
    for (const w of recentCompletedWorkouts) {
      const wk = startOfWeekMonday(w.date).toISOString();
      weekCounts.set(wk, (weekCounts.get(wk) || 0) + 1);
    }

    let workoutWeekStreak = 0;
    let weekCursor = startOfWeekMonday(today);
    for (let i = 0; i < 20; i++) {
      const key = weekCursor.toISOString();
      const c = weekCounts.get(key) || 0;
      if (c >= workoutWeekThreshold) {
        workoutWeekStreak += 1;
        weekCursor = addDays(weekCursor, -7);
      } else {
        break;
      }
    }

    // Next action logic
    const plannedToday = todayWorkouts.find((w) => w.planned && !w.completed) || null;
    const completedToday = todayWorkouts.find((w) => w.completed) || null;

    let nextAction: DashboardNextAction;

    if (completedToday) {
      const feedback = await db.postWorkoutFeedback.findUnique({
        where: { workoutId: completedToday.id },
        select: { id: true },
      });

      if (!feedback) {
        nextAction = {
          kind: "ADD_FEEDBACK",
          title: "Nice work. Log quick feedback",
          subtitle: "Your feedback helps keep training calibrated.",
          workout: {
            id: completedToday.id,
            title: completedToday.title,
            type: completedToday.type,
            date: completedToday.date.toISOString(),
            durationMin: completedToday.durationMin,
            tss: completedToday.tss,
            completed: true,
          },
        };
      } else {
        nextAction = {
          kind: "PLAN_WORKOUT",
          title: "Workout completed",
          subtitle: "Review your week or plan the next session.",
          workout: {
            id: completedToday.id,
            title: completedToday.title,
            type: completedToday.type,
            date: completedToday.date.toISOString(),
            durationMin: completedToday.durationMin,
            tss: completedToday.tss,
            completed: true,
          },
        };
      }
    } else if (plannedToday) {
      const gateRequired = true;
      const checkInDone = !!todayCheckInForGate;
      const skipped = !!skipAuditToday;

      if (gateRequired && !checkInDone && !skipped) {
        nextAction = {
          kind: "COMPLETE_CHECKIN_OR_SKIP",
          title: "Complete your pre-training check",
          subtitle: "Do the daily check-in (or skip with a reason) to unlock today.",
          workout: {
            id: plannedToday.id,
            title: plannedToday.title,
            type: plannedToday.type,
            date: plannedToday.date.toISOString(),
            durationMin: plannedToday.durationMin,
            tss: plannedToday.tss,
            completed: false,
          },
          gate: { required: true, checkInDone, skipped },
          todayCheckIn: todayCheckIn ?? undefined,
        };
      } else {
        nextAction = {
          kind: "START_WORKOUT",
          title: "Today’s workout is ready",
          subtitle: todayCheckIn?.aiDecision
            ? `Check-in decision: ${todayCheckIn.aiDecision}`
            : "Start when you’re ready.",
          workout: {
            id: plannedToday.id,
            title: plannedToday.title,
            type: plannedToday.type,
            date: plannedToday.date.toISOString(),
            durationMin: plannedToday.durationMin,
            tss: plannedToday.tss,
            completed: false,
          },
          gate: { required: true, checkInDone, skipped },
          todayCheckIn: todayCheckIn ?? undefined,
        };
      }
    } else if (nextWorkout) {
      nextAction = {
        kind: "DO_CHECKIN",
        title: "Next planned workout",
        subtitle: "Do a quick check-in when it’s training day.",
        workout: {
          id: nextWorkout.id,
          title: nextWorkout.title,
          type: nextWorkout.type,
          date: nextWorkout.date.toISOString(),
          durationMin: nextWorkout.durationMin,
          tss: nextWorkout.tss,
          completed: false,
        },
      };
    } else {
      nextAction = {
        kind: "PLAN_WORKOUT",
        title: "Plan your next workout",
        subtitle: "Add a session to your calendar to keep momentum.",
      };
    }

    const painCount7d = painFeedback7d.length;

    const nudges: DashboardNudges = {
      showOverrideSignal: !!latestOverrideSignal,
      overrideCount7d: latestOverrideSignal?.detailsJson
        ? (() => {
            try {
              const parsed = JSON.parse(latestOverrideSignal.detailsJson);
              return typeof parsed?.overrideCount7d === "number" ? parsed.overrideCount7d : 0;
            } catch {
              return 0;
            }
          })()
        : 0,
      showPainSignal: painCount7d >= 2,
      painCount7d,
      canShowNoonCheckInNudge: !!plannedToday && !todayCheckInForGate,
    };

    const streaks: DashboardStreaks = {
      checkInDayStreak,
      workoutWeekStreak,
      workoutWeekThreshold,
    };

    logInfo("dashboard.retention.loaded", {
      requestId,
      userId,
      action: "getDashboardRetentionSummary",
      nextAction: nextAction.kind,
      checkInDayStreak,
      workoutWeekStreak,
    });

    return { nextAction, streaks, nudges };
  } catch (error) {
    logError("dashboard.retention.failed", {
      requestId,
      userId,
      action: "getDashboardRetentionSummary",
      error: error instanceof Error ? error.message : String(error),
    });

    return {
      nextAction: {
        kind: "PLAN_WORKOUT",
        title: "Plan your next workout",
        subtitle: "Open Calendar to plan your next session.",
      },
      streaks: { checkInDayStreak: 0, workoutWeekStreak: 0, workoutWeekThreshold: 3 },
      nudges: {
        showOverrideSignal: false,
        overrideCount7d: 0,
        showPainSignal: false,
        painCount7d: 0,
        canShowNoonCheckInNudge: false,
      },
    };
  }
}

export async function getWeeklySummaryExport(): Promise<{ success: boolean; data?: WeeklyExportSummary; error?: string }> {
  const requestId = createRequestId();
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: "Unauthorized" };

  const userId = session.user.id;

  try {
    const today = startOfDay(new Date());
    const weekStart = startOfWeekMonday(today);
    const weekEnd = addDays(weekStart, 7);

    const [workouts, checkInsCount, feedbacks] = await Promise.all([
      db.workout.findMany({
        where: {
          userId,
          date: { gte: weekStart, lt: weekEnd },
        },
        orderBy: { date: "asc" },
      }),
      db.dailyCheckIn.count({
        where: { userId, date: { gte: weekStart, lt: weekEnd } },
      }),
      db.postWorkoutFeedback.findMany({
        where: {
          userId,
          createdAt: { gte: weekStart, lt: weekEnd },
        },
        select: {
          workoutId: true,
          comment: true,
          visibleToAI: true,
          enjoyment: true,
          discomfort: true,
          perceivedDifficulty: true,
        },
      }),
    ]);

    const completed = workouts.filter((w) => w.completed);
    const planned = workouts.filter((w) => w.planned);

    const feedbackByWorkoutId = new Map<string, (typeof feedbacks)[number]>();
    for (const f of feedbacks) feedbackByWorkoutId.set(f.workoutId, f);

    const lines: string[] = [];
    lines.push(`# Weekly Summary (${weekStart.toLocaleDateString()} – ${addDays(weekEnd, -1).toLocaleDateString()})`);
    lines.push("");
    lines.push(`- Planned workouts: ${planned.length}`);
    lines.push(`- Completed workouts: ${completed.length}`);
    lines.push(`- Check-ins completed: ${checkInsCount}`);
    lines.push("");

    lines.push("## Completed Workouts");
    if (completed.length === 0) {
      lines.push("No completed workouts logged this week.");
    } else {
      for (const w of completed) {
        const dateLabel = new Date(w.date).toLocaleDateString();
        const dur = typeof w.durationMin === "number" ? `${w.durationMin}min` : "—";
        const tss = typeof w.tss === "number" ? `TSS ${w.tss}` : "TSS —";
        lines.push(`- **${dateLabel}** — ${w.title} (${w.type}) · ${dur} · ${tss}`);

        const fb = feedbackByWorkoutId.get(w.id);
        if (fb && fb.visibleToAI && fb.comment && fb.comment.trim().length > 0) {
          const quote = fb.comment.trim().split(/\n/)[0].slice(0, 240);
          lines.push(`  - Quote: “${quote}”`);
        }
      }
    }

    lines.push("");
    lines.push("## Notes");
    lines.push("- This export intentionally excludes raw diary/check-in notes.");

    const filename = `weekly-summary-${weekStart.toISOString().slice(0, 10)}.md`;

    logInfo("dashboard.weekly_export.created", {
      requestId,
      userId,
      action: "getWeeklySummaryExport",
      weekStart: weekStart.toISOString(),
    });

    return { success: true, data: { filename, markdown: lines.join("\n") } };
  } catch (error) {
    logError("dashboard.weekly_export.failed", {
      requestId,
      userId,
      action: "getWeeklySummaryExport",
      error: error instanceof Error ? error.message : String(error),
    });
    return { success: false, error: "Failed to export weekly summary" };
  }
}
