"use server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { addDays, parseDateToLocalNoon, startOfWeek } from "@/lib/utils";

const workoutDb = db as unknown as {
  workout: {
    findMany: (args: {
      where: {
        userId: string;
        date: { gte: Date; lt: Date };
      };
      orderBy: { date: "asc" | "desc" } | Array<{ date?: "asc" | "desc"; createdAt?: "asc" | "desc" }>;
      select: {
        id: true;
        date: true;
        title: true;
        type: true;
        planned: true;
        completed: true;
        durationMin: true;
        distanceKm: true;
        distanceM: true;
        tss: true;
        notes: true;
        descriptionMd: true;
        prescriptionJson: true;
        aiGenerated: true;
        aiReason: true;
        aiConfidence: true;
        source: true;
      };
    }) => Promise<
      Array<{
        id: string;
        date: Date;
        title: string;
        type: string;
        planned: boolean;
        completed: boolean;
        durationMin: number | null;
        distanceKm: number | null;
        distanceM: number | null;
        tss: number | null;
        notes: string | null;
        descriptionMd: string | null;
        prescriptionJson: string | null;
        aiGenerated: boolean;
        aiReason: string | null;
        aiConfidence: number | null;
        source: string | null;
      }>
    >;
  };
};

const feedbackDb = db as unknown as {
  postWorkoutFeedback: {
    findMany: (args: {
      where: {
        userId: string;
        workoutId: { in: string[] };
      };
      select: {
        workoutId: true;
      };
    }) => Promise<Array<{ workoutId: string }>>;
  };
};

const checkInDb = db as unknown as {
  dailyCheckIn: {
    findMany: (args: {
      where: {
        userId: string;
        date: { gte: Date; lt: Date };
      };
      orderBy: { date: "asc" | "desc" };
      select: {
        id: true;
        date: true;
        readinessScore: true;
        aiDecision: true;
        aiConfidence: true;
        aiExplanation: true;
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
        aiExplanation: string | null;
        workoutId: string | null;
        userAccepted: boolean | null;
      }>
    >;
  };
};

export async function getCalendarMonthData(monthDateStr?: string): Promise<{
  success: boolean;
  error?: string;
  data?: {
    monthStart: Date;
    gridStart: Date;
    gridEndExclusive: Date;
    workouts: Array<{
      id: string;
      date: Date;
      title: string;
      type: string;
      planned: boolean;
      completed: boolean;
      durationMin: number | null;
      distanceKm: number | null;
      distanceM: number | null;
      tss: number | null;
      notes: string | null;
      descriptionMd: string | null;
      prescriptionJson: string | null;
      aiGenerated: boolean;
      aiReason: string | null;
      aiConfidence: number | null;
      source: string | null;
    }>;
    feedbackWorkoutIds: string[];
    checkIns: Array<{
      id: string;
      date: Date;
      readinessScore: number | null;
      aiDecision: string | null;
      aiConfidence: number | null;
      aiExplanation: string | null;
      workoutId: string | null;
      userAccepted: boolean | null;
    }>;
  };
}> {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: "Unauthorized" };

  const base = monthDateStr ? parseDateToLocalNoon(monthDateStr) : (() => {
    const d = new Date();
    d.setHours(12, 0, 0, 0);
    return d;
  })();

  const monthStart = new Date(base.getFullYear(), base.getMonth(), 1);
  monthStart.setHours(0, 0, 0, 0);

  const gridStart = startOfWeek(monthStart);
  const gridEndExclusive = addDays(gridStart, 42);

  const [workouts, checkIns] = await Promise.all([
    workoutDb.workout.findMany({
      where: {
        userId: session.user.id,
        date: { gte: gridStart, lt: gridEndExclusive },
      },
      orderBy: [{ date: "asc" }, { createdAt: "asc" }],
      select: {
        id: true,
        date: true,
        title: true,
        type: true,
        planned: true,
        completed: true,
        durationMin: true,
        distanceKm: true,
        distanceM: true,
        tss: true,
        notes: true,
        descriptionMd: true,
        prescriptionJson: true,
        aiGenerated: true,
        aiReason: true,
        aiConfidence: true,
        source: true,
      },
    }),
    checkInDb.dailyCheckIn.findMany({
      where: {
        userId: session.user.id,
        date: { gte: gridStart, lt: gridEndExclusive },
      },
      orderBy: { date: "asc" },
      select: {
        id: true,
        date: true,
        readinessScore: true,
        aiDecision: true,
        aiConfidence: true,
        aiExplanation: true,
        workoutId: true,
        userAccepted: true,
      },
    }),
  ]);

  const feedbackRows =
    workouts.length > 0
      ? await feedbackDb.postWorkoutFeedback.findMany({
          where: {
            userId: session.user.id,
            workoutId: { in: workouts.map((w) => w.id) },
          },
          select: { workoutId: true },
        })
      : [];

  const feedbackWorkoutIds = feedbackRows.map((r) => String(r.workoutId));

  return {
    success: true,
    data: {
      monthStart,
      gridStart,
      gridEndExclusive,
      workouts,
      feedbackWorkoutIds,
      checkIns: checkIns.map((c) => ({
        id: String(c.id),
        date: new Date(c.date),
        readinessScore: typeof c.readinessScore === "number" ? c.readinessScore : null,
        aiDecision: c.aiDecision ? String(c.aiDecision) : null,
        aiConfidence: typeof c.aiConfidence === "number" ? c.aiConfidence : null,
        aiExplanation: c.aiExplanation ? String(c.aiExplanation) : null,
        workoutId: c.workoutId ? String(c.workoutId) : null,
        userAccepted: typeof c.userAccepted === "boolean" ? c.userAccepted : null,
      })),
    },
  };
}
