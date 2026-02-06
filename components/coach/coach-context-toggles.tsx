"use client";

import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export interface CoachContextPayload {
  useCheckInData: boolean;
  useDiaryNotes: boolean;
  useSeasonGoals: boolean;
  timeBudgetHours: number;
}

interface CoachContextTogglesProps {
  value: CoachContextPayload;
  onChange: (v: CoachContextPayload) => void;
  className?: string;
}

export function CoachContextToggles({ value, onChange, className }: CoachContextTogglesProps) {
  return (
    <div className={cn("flex flex-wrap gap-4 items-center text-sm", className)}>
      <label className="flex items-center gap-2 cursor-pointer">
        <Switch
          checked={value.useCheckInData}
          onCheckedChange={(c) => onChange({ ...value, useCheckInData: c })}
        />
        <span className="text-muted-foreground">Use check-in data</span>
      </label>
      <label className="flex items-center gap-2 cursor-pointer">
        <Switch
          checked={value.useDiaryNotes}
          onCheckedChange={(c) => onChange({ ...value, useDiaryNotes: c })}
        />
        <span className="text-muted-foreground">Use diary notes</span>
      </label>
      <label className="flex items-center gap-2 cursor-pointer">
        <Switch
          checked={value.useSeasonGoals}
          onCheckedChange={(c) => onChange({ ...value, useSeasonGoals: c })}
        />
        <span className="text-muted-foreground">Use season goals</span>
      </label>
      <div className="flex items-center gap-2">
        <Label htmlFor="time-budget" className="text-muted-foreground text-xs whitespace-nowrap">
          Time budget (h/week)
        </Label>
        <Input
          id="time-budget"
          type="number"
          min={1}
          max={30}
          step={0.5}
          value={value.timeBudgetHours}
          onChange={(e) => {
            const v = parseFloat(e.target.value);
            if (!Number.isNaN(v)) onChange({ ...value, timeBudgetHours: Math.max(0, Math.min(30, v)) });
          }}
          className="h-7 w-16 text-xs"
        />
      </div>
    </div>
  );
}
