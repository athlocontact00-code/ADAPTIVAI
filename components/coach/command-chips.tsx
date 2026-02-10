"use client";

import { Button } from "@/components/ui/button";

export type CoachCommandChip = {
  label: string;
  template: string;
};

const DEFAULT_CHIPS: CoachCommandChip[] = [
  { label: "Generate today", template: "Generate today's workout" },
  { label: "Add swim", template: "Add a swim session to my plan" },
  { label: "Change tomorrow", template: "Change tomorrow's workout" },
  { label: "Plan week", template: "Generate a week training plan" },
  { label: "Strength", template: "Add strength session" },
  {
    label: "Explain today’s workout",
    template: "Explain today’s workout",
  },
  {
    label: "Adjust my plan…",
    template: "Adjust my plan due to: [fatigue/soreness/time]",
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
