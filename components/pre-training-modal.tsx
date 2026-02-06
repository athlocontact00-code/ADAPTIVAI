"use client";

import { DailyCheckInModal } from "@/components/daily-checkin-modal";

interface PreTrainingModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workout: {
    id: string;
    title: string;
    type: string;
    durationMin?: number | null;
    tss?: number | null;
  };
  existingCheckIn?: {
    id: string;
    mood: number;
    energy: number;
    stress: number;
    sorenessAreasJson: string | null;
    notes: string | null;
    aiDecision: string | null;
    aiReasonJson: string | null;
    aiConfidence: number | null;
    userAccepted: boolean | null;
  } | null;
}

export function PreTrainingModal({
  open,
  onOpenChange,
  workout,
}: PreTrainingModalProps) {
  return (
    <DailyCheckInModal
      open={open}
      onOpenChange={onOpenChange}
      workout={{
        id: workout.id,
        title: workout.title,
        type: workout.type,
        duration: workout.durationMin ?? 60,
        tss: workout.tss ?? 50,
      }}
    />
  );
}
