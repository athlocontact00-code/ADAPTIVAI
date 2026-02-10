"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

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
    label: "Explain today's workout",
    template: "Explain today's workout",
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

const PRIMARY_COUNT = 3;

function ChipButton({
  chip,
  value,
  onChange,
  className,
  size = "default",
}: {
  chip: CoachCommandChip;
  value: string;
  onChange: (next: string) => void;
  className?: string;
  size?: "default" | "sm";
}) {
  return (
    <Button
      type="button"
      variant="outline"
      size={size}
      className={cn(
        "min-h-[44px] sm:min-h-0 border-border/70 bg-card/80 hover:bg-accent hover:border-border text-foreground font-medium",
        size === "default" && "px-4 py-2.5 text-sm",
        className
      )}
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
  );
}

export function CoachCommandChips({
  value,
  onChange,
  chips = DEFAULT_CHIPS,
  maxVisible = PRIMARY_COUNT,
}: {
  value: string;
  onChange: (next: string) => void;
  chips?: CoachCommandChip[];
  maxVisible?: number;
}) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const primary = chips.slice(0, maxVisible);
  const more = chips.slice(maxVisible);

  const pickChip = (template: string) => {
    const trimmed = value.trim();
    if (!trimmed) {
      onChange(template);
    } else {
      onChange(`${trimmed}\n\n${template}`);
    }
    setSheetOpen(false);
  };

  return (
    <div className="flex flex-wrap gap-2 min-w-0">
      {primary.map((chip) => (
        <ChipButton
          key={chip.label}
          chip={chip}
          value={value}
          onChange={onChange}
        />
      ))}
      {more.length > 0 && (
        <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
          <SheetTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="default"
              className="min-h-[44px] sm:min-h-0 border-border/70 bg-card/80 hover:bg-accent text-foreground font-medium px-4 py-2.5"
            >
              More actions
              <ChevronDown className="ml-1.5 h-4 w-4 opacity-70" />
            </Button>
          </SheetTrigger>
          <SheetContent
            side="bottom"
            className="rounded-t-2xl border-t border-border/50 max-h-[85vh] overflow-y-auto safe-area-inset-bottom"
          >
            <SheetHeader>
              <SheetTitle className="text-left">Commands</SheetTitle>
            </SheetHeader>
            <div className="grid gap-2 pt-4 pb-6">
              {more.map((chip) => (
                <button
                  key={chip.label}
                  type="button"
                  className="flex min-h-[44px] w-full items-center rounded-xl border border-border/70 bg-card/80 px-4 py-3 text-left text-sm font-medium text-foreground transition-colors hover:bg-accent active:bg-accent/80"
                  onClick={() => pickChip(chip.template)}
                >
                  {chip.label}
                </button>
              ))}
            </div>
          </SheetContent>
        </Sheet>
      )}
    </div>
  );
}
