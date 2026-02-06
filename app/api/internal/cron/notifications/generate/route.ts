import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { addDays, startOfDay } from "@/lib/utils";
import { Prisma } from "@prisma/client";

const LOW_READINESS_THRESHOLD = 40;

function getNotificationPrefs(prefs: unknown): {
  dailyReminders: boolean;
  lowReadinessAlerts: boolean;
  missedLogReminder: boolean;
} {
  if (!prefs || typeof prefs !== "object") {
    return { dailyReminders: true, lowReadinessAlerts: true, missedLogReminder: true };
  }
  const p = prefs as Record<string, unknown>;
  return {
    dailyReminders: p.enableDailyReminders !== false,
    lowReadinessAlerts: p.enableLowReadinessAlerts !== false,
    missedLogReminder: p.enableMissedLogReminder !== false,
  };
}

export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization");
  const secret = process.env.INTERNAL_CRON_SECRET;
  if (!secret || authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const today = startOfDay(new Date());
  const yesterday = addDays(today, -1);
  const created: string[] = [];

  const users = await db.user.findMany({
    where: { onboardingDone: true },
    select: {
      id: true,
      profile: { select: { preferences: true } },
    },
  });

  for (const user of users) {
    const prefs = getNotificationPrefs(user.profile?.preferences);
    const existingToday = await db.notification.count({
      where: {
        userId: user.id,
        createdAt: { gte: today },
      },
    });
    if (existingToday >= 2) continue;

    const notificationsToCreate: Prisma.NotificationCreateManyInput[] = [];

    if (prefs.dailyReminders) {
      const todayWorkouts = await db.workout.findMany({
        where: {
          userId: user.id,
          date: today,
          planned: true,
          completed: false,
        },
      });
      const todayCheckIn = await db.dailyCheckIn.findUnique({
        where: { userId_date: { userId: user.id, date: today } },
      });
      if (todayWorkouts.length > 0 && !todayCheckIn) {
        const w = todayWorkouts[0];
        notificationsToCreate.push({
          userId: user.id,
          type: "WORKOUT_TODAY_CHECKIN",
          title: "Log your pre-workout check-in",
          body: `You have ${todayWorkouts.length} planned session(s) today. Check in before you start.`,
          data: JSON.stringify({ workoutId: w.id, date: today.toISOString() }),
          status: "UNREAD",
        });
      }
    }

    if (prefs.lowReadinessAlerts && notificationsToCreate.length < 2) {
      const todayWorkouts = await db.workout.findMany({
        where: {
          userId: user.id,
          date: today,
          planned: true,
          type: { in: ["run", "bike", "swim"] },
        },
      });
      const hasHardSession = todayWorkouts.some((w) => {
        const pres = w.prescriptionJson as { overview?: { intensity?: string } } | null;
        return pres?.overview?.intensity === "hard" || pres?.overview?.intensity === "moderate";
      });
      const todayCheckIn = await db.dailyCheckIn.findUnique({
        where: { userId_date: { userId: user.id, date: today } },
        select: { readinessScore: true },
      });
      const readiness = todayCheckIn?.readinessScore ?? null;
      if (hasHardSession && typeof readiness === "number" && readiness < LOW_READINESS_THRESHOLD) {
        notificationsToCreate.push({
          userId: user.id,
          type: "LOW_READINESS_HARD_DAY",
          title: "Low readiness + hard session today",
          body: "Consider asking \"What should I do today?\" for an AI recommendation.",
          data: JSON.stringify({ date: today.toISOString() }),
          status: "UNREAD",
        });
      }
    }

    if (prefs.missedLogReminder && notificationsToCreate.length < 2) {
      const yesterdayWorkouts = await db.workout.findMany({
        where: {
          userId: user.id,
          date: yesterday,
          completed: true,
        },
      });
      const yesterdayFeedback = await db.postWorkoutFeedback.findMany({
        where: {
          workoutId: { in: yesterdayWorkouts.map((w) => w.id) },
        },
      });
      if (yesterdayWorkouts.length > 0 && yesterdayFeedback.length === 0) {
        notificationsToCreate.push({
          userId: user.id,
          type: "DIDNT_LOG_YESTERDAY",
          title: "You didn't log yesterday's session",
          body: "Add post-workout feedback to improve AI suggestions.",
          data: JSON.stringify({ date: yesterday.toISOString() }),
          status: "UNREAD",
        });
      }
    }

    const deduped = notificationsToCreate.slice(0, 2);
    for (const n of deduped) {
      try {
        await db.notification.create({ data: n });
        created.push(n.userId);
      } catch {
        // ignore duplicate
      }
    }
  }

  return NextResponse.json({ ok: true, created: created.length });
}
