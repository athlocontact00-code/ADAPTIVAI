"use client";

import { Button } from "@/components/ui/button";

export type CoachCommandChip = {
  label: string;
  template: string;
};

const DEFAULT_CHIPS: CoachCommandChip[] = [
  {
    label: "Generate a workout…",
    template: "Generate a workout for: [sport] [duration] [intensity]",
  },
  {
    label: "Explain today’s workout",
    template: "Explain today’s workout",
  },
  {
    label: "Adjust my plan…",
    template: "Adjust my plan due to: [fatigue/soreness/time]",
  },
  {
    label: "Focus this week",
    template: "What should I focus on this week?",
  },
  {
    label: "Summarize last 7 days",
    template: "Summarize my last 7 days",
  },
];

export function CoachCommandChips({
  value,
  onChange,
  chips = DEFAULT_CHIPS,
}: {
  value: string;
  onChange: (next: string) => void;
  chips?: CoachCommandChip[];
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {chips.map((chip) => (
        <Button
          key={chip.label}
          type="button"
          variant="outline"
          size="sm"
          onClick={() => {
            const trimmed = value.trim();
            if (!trimmed) {
              onChange(chip.template);
              return;
            }
            onChange(`${trimmed}\n\n${chip.template}`);
          }}
        >
          {chip.label}
        </Button>
      ))}
    </div>
  );
}
