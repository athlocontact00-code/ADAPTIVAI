"use server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getRiskAssessment } from "@/lib/actions/decision";
import { addDays, formatLocalDateInput, isSameDay, parseDateToLocalNoon } from "@/lib/utils";

export type NotificationTone = "info" | "warning";

export type NotificationItem = {
  id: string;
  title: string;
  description: string;
  tone: NotificationTone;
  createdAt: string;
  href?: string;
  dbId?: string;
  read?: boolean; // for unread badge
};

function hrefForType(
  type: string,
  data: string | null
): string | undefined {
  try {
    const parsed = data ? (JSON.parse(data) as Record<string, unknown>) : {};
    const date = parsed.date as string | undefined;
    switch (type) {
      case "WORKOUT_TODAY_CHECKIN":
        return "/today?checkin=1";
      case "LOW_READINESS_HARD_DAY":
        return "/dashboard?whatToday=1";
      case "DIDNT_LOG_YESTERDAY":
        return date ? `/calendar?date=${date}` : "/calendar";
      default:
        return "/dashboard";
    }
  } catch {
    return "/dashboard";
  }
}

const LOW_READINESS_THRESHOLD = 45;

function getConsecutiveMissedDays(dates: Date[]): number {
  if (dates.length === 0) return 0;
  let streak = 1;
  let cursor = dates[0];
  for (let i = 1; i < dates.length; i += 1) {
    const candidate = dates[i];
    const prevDay = addDays(cursor, -1);
    if (isSameDay(candidate, prevDay)) {
      streak += 1;
      cursor = candidate;
    } else {
      break;
    }
  }
  return streak;
}

export async function markNotificationRead(dbId: string): Promise<void> {
  const session = await auth();
  if (!session?.user?.id) return;
  await db.notification.updateMany({
    where: { id: dbId, userId: session.user.id },
    data: { status: "READ", readAt: new Date() },
  });
}

export async function markAllNotificationsRead(): Promise<void> {
  const session = await auth();
  if (!session?.user?.id) return;
  await db.notification.updateMany({
    where: { userId: session.user.id, status: "UNREAD" },
    data: { status: "READ", readAt: new Date() },
  });
}

export async function getNotificationCenter(): Promise<{
  success: boolean;
  items?: NotificationItem[];
  error?: string;
}> {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, error: "Unauthorized" };
  }

  const userId = session.user.id;
  const now = new Date();
  const items: NotificationItem[] = [];

  const dbNotifications = await db.notification.findMany({
    where: { userId, status: { in: ["UNREAD", "READ"] } },
    orderBy: { createdAt: "desc" },
    take: 20,
  });
  for (const n of dbNotifications) {
    items.push({
      id: n.id,
      dbId: n.id,
      title: n.title,
      description: n.body,
      tone: n.type === "LOW_READINESS_HARD_DAY" ? "warning" : "info",
      createdAt: n.createdAt.toISOString(),
      href: hrefForType(n.type, n.data),
      read: n.status === "READ",
    });
  }

  const auditLogs = await db.auditLog.findMany({
    where: { userId, actionType: "AI_WORKOUT_ADAPTED" },
    orderBy: { createdAt: "desc" },
    take: 3,
  });

  for (const log of auditLogs) {
    items.push({
      id: `adapted-${log.id}`,
      title: "Workout adapted",
      description: log.summary || "Your workout was adapted based on your check-in.",
      tone: "info",
      createdAt: log.createdAt.toISOString(),
      href: log.targetId ? `/calendar?workoutId=${log.targetId}` : "/calendar",
    });
  }

  const risk = await getRiskAssessment();
  if (risk.success && risk.data && ["WARNING", "DANGER"].includes(risk.data.rampStatus)) {
    const firstWarning = risk.data.warnings?.[0]?.message;
    items.push({
      id: "ramp-risk",
      title: "High ramp rate risk",
      description: firstWarning || "Training load has spiked versus last week.",
      tone: "warning",
      createdAt: now.toISOString(),
      href: "/dashboard",
    });
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const missedWorkouts = await db.workout.findMany({
    where: {
      userId,
      planned: true,
      completed: false,
      date: { lt: today },
    },
    orderBy: { date: "desc" },
    take: 6,
  });

  if (missedWorkouts.length > 0) {
    const uniqueDates = Array.from(
      new Set(missedWorkouts.map((w) => formatLocalDateInput(w.date)))
    );
    const missedDates = uniqueDates
      .map((d) => parseDateToLocalNoon(d))
      .sort((a, b) => b.getTime() - a.getTime());
    const streak = getConsecutiveMissedDays(missedDates);
    if (streak >= 2) {
      items.push({
        id: `missed-${formatLocalDateInput(missedDates[0])}`,
        title: "Missed 2 sessions in a row",
        description: "Consider a lighter week or adjust your plan to recover.",
        tone: "warning",
        createdAt: now.toISOString(),
        href: "/calendar",
      });
    }
  }

  const recentCheckins = await db.dailyCheckIn.findMany({
    where: {
      userId,
      readinessScore: { not: null },
    },
    orderBy: { date: "desc" },
    take: 2,
    select: {
      id: true,
      date: true,
      readinessScore: true,
    },
  });

  if (
    recentCheckins.length === 2 &&
    recentCheckins.every((c) => typeof c.readinessScore === "number" && c.readinessScore <= LOW_READINESS_THRESHOLD)
  ) {
    items.push({
      id: `low-readiness-${recentCheckins[0].id}`,
      title: "Low readiness 2 days",
      description: "Plan extra recovery or reduce intensity for today.",
      tone: "warning",
      createdAt: now.toISOString(),
      href: "/today",
    });
  }

  const sorted = items.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  return { success: true, items: sorted };
}
