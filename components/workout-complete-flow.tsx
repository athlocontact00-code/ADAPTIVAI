"use client";

import { useState } from "react";
import { CheckCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { WorkoutFeedbackModal } from "@/components/workout-feedback-modal";

interface WorkoutCompleteFlowProps {
  workoutId: string;
  workoutTitle: string;
  onComplete?: () => void;
}

export function WorkoutCompleteFlow({
  workoutId,
  workoutTitle,
  onComplete,
}: WorkoutCompleteFlowProps) {
  const [isCompleting, setIsCompleting] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);

  const handleComplete = async () => {
    setIsCompleting(true);
    try {
      const res = await fetch(`/api/workouts/${workoutId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ completed: true }),
      });

      if (!res.ok) {
        throw new Error("Failed to complete workout");
      }

      setShowFeedback(true);
    } catch (_error) {
      toast.error("Failed to complete workout");
    } finally {
      setIsCompleting(false);
    }
  };

  const handleFeedbackComplete = () => {
    setShowFeedback(false);
    setIsCompleted(true);
    toast.success("Workout completed! Great job.");
    onComplete?.();
  };

  if (isCompleted) {
    return (
      <Button variant="outline" disabled className="gap-2">
        <CheckCircle className="h-4 w-4 text-green-500" />
        Completed
      </Button>
    );
  }

  return (
    <>
      <Button
        onClick={handleComplete}
        disabled={isCompleting}
        className="gap-2"
      >
        {isCompleting ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <CheckCircle className="h-4 w-4" />
        )}
        Complete Workout
      </Button>

      <WorkoutFeedbackModal
        open={showFeedback}
        onOpenChange={setShowFeedback}
        workoutId={workoutId}
        workoutTitle={workoutTitle}
        onComplete={handleFeedbackComplete}
      />
    </>
  );
}
