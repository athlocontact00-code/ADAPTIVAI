"use client";

import { WorkoutFeedbackModal } from "@/components/workout-feedback-modal";

interface PostWorkoutModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workout: {
    id: string;
    title: string;
    type: string;
  };
  existingFeedback?: {
    perceivedDifficulty: string;
    vsPlanned: string;
    enjoyment: number;
    painOrDiscomfort: string | null;
    comment: string | null;
    visibleToAI: boolean;
    visibleToFuturePlanning: boolean;
  } | null;
}

export function PostWorkoutModal({
  open,
  onOpenChange,
  workout,
}: PostWorkoutModalProps) {
  return (
    <WorkoutFeedbackModal
      open={open}
      onOpenChange={onOpenChange}
      workoutId={workout.id}
      workoutTitle={workout.title}
    />
  );
}
