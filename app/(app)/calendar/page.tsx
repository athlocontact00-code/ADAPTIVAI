import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { addDays, startOfWeek } from "@/lib/utils";
import { CalendarClient } from "./calendar-client";

export default async function CalendarPage({
  searchParams,
}: {
  searchParams?: Promise<{ workoutId?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const today = new Date();
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  monthStart.setHours(0, 0, 0, 0);

  const gridStart = startOfWeek(monthStart);
  const gridEndExclusive = addDays(gridStart, 42);

  const workouts = await db.workout.findMany({
    where: {
      userId: session.user.id,
      date: {
        gte: gridStart,
        lt: gridEndExclusive,
      },
    },
    orderBy: [{ date: "asc" }, { createdAt: "asc" }],
  });

  const feedbackRows =
    workouts.length > 0
      ? await db.postWorkoutFeedback.findMany({
          where: {
            userId: session.user.id,
            workoutId: { in: workouts.map((w) => w.id) },
          },
          select: { workoutId: true },
        })
      : [];

  const feedbackWorkoutIds = feedbackRows.map((r) => String(r.workoutId));

  const checkInDb = db as unknown as {
    dailyCheckIn: {
      findMany: (args: {
        where: {
          userId: string;
          date: {
            gte: Date;
            lt: Date;
          };
        };
        orderBy: { date: "asc" | "desc" };
        select: {
          id: true;
          date: true;
          readinessScore: true;
          aiDecision: true;
          aiConfidence: true;
          workoutId: true;
          userAccepted: true;
        };
      }) => Promise<
        Array<{
          id: string;
          date: Date;
          readinessScore: number | null;
          aiDecision: string | null;
          aiConfidence: number | null;
          workoutId: string | null;
          userAccepted: boolean | null;
        }>
      >;
    };
  };

  const checkIns = await checkInDb.dailyCheckIn.findMany({
    where: {
      userId: session.user.id,
      date: {
        gte: gridStart,
        lt: gridEndExclusive,
      },
    },
    orderBy: { date: "asc" },
    select: {
      id: true,
      date: true,
      readinessScore: true,
      aiDecision: true,
      aiConfidence: true,
      workoutId: true,
      userAccepted: true,
    },
  });

  const resolvedSearchParams = searchParams ? await searchParams : undefined;

  const initialOpenWorkoutId =
    typeof resolvedSearchParams?.workoutId === "string" && resolvedSearchParams.workoutId.length > 0
      ? resolvedSearchParams.workoutId
      : null;

  return (
    <CalendarClient
      initialWorkouts={workouts}
      initialCheckIns={checkIns}
      initialFeedbackWorkoutIds={feedbackWorkoutIds}
      initialMonthDate={monthStart}
      initialOpenWorkoutId={initialOpenWorkoutId}
    />
  );
}
