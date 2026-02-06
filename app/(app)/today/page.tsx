import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { needsCheckIn, getTodayCheckIn } from "@/lib/actions/daily-checkin";
import { TodayClient } from "./today-client";

export default async function TodayPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const [workouts, checkInStatus, todayCheckIn] = await Promise.all([
    db.workout.findMany({
      where: {
        userId: session.user.id,
        date: { gte: today, lt: tomorrow },
      },
      orderBy: { date: "asc" },
      select: {
        id: true,
        title: true,
        type: true,
        date: true,
        durationMin: true,
        tss: true,
        planned: true,
        completed: true,
        aiGenerated: true,
        aiReason: true,
        source: true,
      },
    }),
    needsCheckIn(),
    getTodayCheckIn(),
  ]);

  const checkIn = todayCheckIn as unknown as null | {
    id: string;
    readinessScore?: number | null;
    aiDecision?: string | null;
    aiConfidence?: number | null;
    workoutId?: string | null;
    lockedAt?: Date | null;
    sleepDuration?: number | null;
    sleepQuality?: number | null;
    physicalFatigue?: number | null;
    motivation?: number | null;
  };

  return (
    <TodayClient
      workouts={workouts.map((w) => ({
        ...w,
        date: w.date.toISOString(),
      }))}
      checkInRequired={checkInStatus.required}
      checkInWorkout={checkInStatus.workout}
      todayCheckIn={
        checkIn
          ? {
              id: checkIn.id,
              workoutId: checkIn.workoutId ?? null,
              readinessScore: typeof checkIn.readinessScore === "number" ? checkIn.readinessScore : null,
              aiDecision: typeof checkIn.aiDecision === "string" ? checkIn.aiDecision : null,
              aiConfidence: typeof checkIn.aiConfidence === "number" ? checkIn.aiConfidence : null,
              lockedAt: checkIn.lockedAt instanceof Date ? checkIn.lockedAt.toISOString() : null,
              sleepDuration: typeof checkIn.sleepDuration === "number" ? checkIn.sleepDuration : null,
              sleepQuality: typeof checkIn.sleepQuality === "number" ? checkIn.sleepQuality : null,
              physicalFatigue: typeof checkIn.physicalFatigue === "number" ? checkIn.physicalFatigue : null,
              motivation: typeof checkIn.motivation === "number" ? checkIn.motivation : null,
            }
          : null
      }
    />
  );
}
