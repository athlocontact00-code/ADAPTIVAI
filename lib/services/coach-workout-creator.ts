import { db } from "@/lib/db";
import {
  buildWorkoutDescriptionMd,
  buildWorkoutPrescriptionJson,
  type BuiltAIContext,
} from "@/lib/actions/coach";
import { invalidateAdaptiveDayPlannerCacheForWorkoutDate } from "@/lib/services/adaptive-day-planner-cache.service";
import type { CoachCreatedWorkoutSummary, CoachManualWorkoutDraft } from "@/lib/services/coach-manual-add-handler";

export async function createWorkoutFromCoach(params: {
  userId: string;
  aiContext: BuiltAIContext;
  planned?: boolean;
  source?: string;
  draft: CoachManualWorkoutDraft;
}): Promise<CoachCreatedWorkoutSummary> {
  const aiReason = "Requested by athlete via AI Coach";

  const workoutForTemplate = {
    title: params.draft.title,
    type: params.draft.type,
    durationMin: params.draft.durationMin,
    intensity: params.draft.intensity,
    aiReason,
    warmUpText: params.draft.warmUpText ?? null,
    mainSetText: params.draft.mainSetText ?? null,
    coolDownText: params.draft.coolDownText ?? null,
    extraTargets: params.draft.extraTargets ?? null,
  };

  const descriptionMd = await buildWorkoutDescriptionMd({
    workout: workoutForTemplate,
    aiContext: params.aiContext,
  });
  const prescriptionJson = await buildWorkoutPrescriptionJson({
    workout: workoutForTemplate,
    aiContext: params.aiContext,
  });

  const created = await db.workout.create({
    data: {
      userId: params.userId,
      title: params.draft.title,
      type: params.draft.type,
      date: params.draft.date,
      durationMin: params.draft.durationMin,
      tss: params.draft.tss,
      planned: params.planned ?? true,
      completed: false,
      aiGenerated: true,
      aiReason,
      aiConfidence: 80,
      descriptionMd,
      prescriptionJson,
      source: params.source ?? "coach",
    },
    select: {
      id: true,
    },
  });

  await db.auditLog.create({
    data: {
      userId: params.userId,
      actorUserId: params.userId,
      actionType: "COACH_WORKOUT_CREATED",
      targetType: "WORKOUT",
      targetId: created.id,
      summary: "Created workout from AI Coach",
      detailsJson: JSON.stringify({
        workoutId: created.id,
        date: params.draft.date,
        title: params.draft.title,
      }),
    },
  });

  await invalidateAdaptiveDayPlannerCacheForWorkoutDate(params.userId, params.draft.date);

  return {
    id: created.id,
    date: params.draft.date,
    title: params.draft.title,
    descriptionMd,
  };
}
