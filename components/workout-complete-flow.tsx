"use client";

import { useState } from "react";
import { CheckCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { WorkoutFeedbackModal } from "@/components/workout-feedback-modal";
import confetti from "canvas-confetti";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { ViralShareCard } from "@/components/share-social-card";

interface WorkoutCompleteFlowProps {
  workoutId: string;
  workoutTitle: string;
  onWorkoutCompleted?: () => void;
  onComplete?: () => void;
}

export function WorkoutCompleteFlow({
  workoutId,
  workoutTitle,
  onWorkoutCompleted,
  onComplete,
}: WorkoutCompleteFlowProps) {
  const [isCompleting, setIsCompleting] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const [showViralModal, setShowViralModal] = useState(false);

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

      onWorkoutCompleted?.();
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

    // Trigger Gamification: Confetti explosion!
    const duration = 3000;
    const end = Date.now() + duration;

    const frame = () => {
      confetti({
        particleCount: 5,
        angle: 60,
        spread: 55,
        origin: { x: 0 },
        colors: ["#f97316", "#a855f7", "#3b82f6"]
      });
      confetti({
        particleCount: 5,
        angle: 120,
        spread: 55,
        origin: { x: 1 },
        colors: ["#f97316", "#a855f7", "#3b82f6"]
      });

      if (Date.now() < end) {
        requestAnimationFrame(frame);
      }
    };
    frame();

    toast.success("Workout completed! Great job.");
    setShowViralModal(true);
    onComplete?.();
  };

  if (isCompleted && !showViralModal) {
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

      <Dialog open={showViralModal} onOpenChange={setShowViralModal}>
        <DialogContent className="sm:max-w-md p-0 overflow-hidden bg-transparent border-0 shadow-none flex justify-center items-center isolate">
          <DialogTitle className="sr-only">Workout Complete</DialogTitle>
          <DialogDescription className="sr-only">Share your workout</DialogDescription>
          <div className="z-50">
            <ViralShareCard
              title="Workout Crushed 🔥"
              subtitle={workoutTitle}
              metrics={[
                { label: "Status", value: "Done" },
                { label: "Vibe", value: "+100%" }
              ]}
              ctaText="Join me"
            />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
