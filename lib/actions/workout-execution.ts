"use server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { track } from "@/lib/analytics/events";
import { createRequestId } from "@/lib/logger";
import { lockCheckIn } from "@/lib/actions/daily-checkin";

export async function startWorkout(params: {
  workoutId: string;
  checkInId?: string | null;
}): Promise<{ success: boolean; error?: string }> {
  const requestId = createRequestId();
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: "Unauthorized" };

  const workout = await db.workout.findFirst({
    where: { id: params.workoutId, userId: session.user.id },
    select: { id: true, date: true, completed: true },
  });

  if (!workout) return { success: false, error: "Workout not found" };
  if (workout.completed) return { success: true };

  if (params.checkInId) {
    await lockCheckIn(params.checkInId);
  }

  await db.auditLog.create({
    data: {
      userId: session.user.id,
      actorUserId: session.user.id,
      actionType: "WORKOUT_STARTED",
      targetType: "WORKOUT",
      targetId: workout.id,
      summary: "Workout started",
      detailsJson: JSON.stringify({ workoutId: workout.id, date: workout.date }),
    },
  });

  await track({
    name: "workout_started",
    userId: session.user.id,
    requestId,
    route: "/today",
    source: "today",
    properties: { workoutId: workout.id, hadCheckIn: !!params.checkInId },
  });

  return { success: true };
}
