"use client";

import { Sparkles, Pencil, Plus, Target } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { formatHours, formatTSS, formatPercent } from "@/lib/utils/format";
import type { SeasonHQ, BlockHQ } from "@/lib/types/season";
import type { CurrentWeekStats } from "@/lib/actions/season";

function getCurrentPhase(blocks: BlockHQ[]): string | null {
  const now = new Date();
  now.setHours(12, 0, 0, 0);
  for (const b of blocks) {
    const start = new Date(b.startDate);
    const end = new Date(b.endDate);
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);
    if (now >= start && now <= end) return b.type;
  }
  return null;
}

interface SeasonHeaderProps {
  season: SeasonHQ;
  weekStats: CurrentWeekStats | null;
  hasBlocks: boolean;
  onAutoCreateBlocks: () => void;
  onEditBlocks: () => void;
  onAddMilestone: () => void;
}

const KPI_ITEMS = [
  { key: "hours", label: "Hours", render: (s: CurrentWeekStats) => `${formatHours(s.doneHours)} / ${formatHours(s.plannedHours)} h` },
  { key: "tss", label: "TSS", render: (s: CurrentWeekStats) => `${formatTSS(s.doneTSS)} / ${formatTSS(s.plannedTSS)}` },
  { key: "compliance", label: "Compliance", render: (s: CurrentWeekStats) => formatPercent(s.compliancePercent) },
  { key: "ramp", label: "Ramp", render: (s: CurrentWeekStats) => s.rampRate != null ? `${s.rampRate > 0 ? "+" : ""}${Math.round(s.rampRate)}%` : "—" },
  { key: "keySess", label: "Key Sess.", render: (s: CurrentWeekStats) => String(s.keySessionsCount ?? 0) },
] as const;

export function SeasonHeader({
  season,
  weekStats,
  hasBlocks,
  onAutoCreateBlocks,
  onEditBlocks,
  onAddMilestone,
}: SeasonHeaderProps) {
  const phase = getCurrentPhase(season.trainingBlocks);
  const goalRace = season.raceEvents.find((r) => r.kind === "A_RACE" || r.priority === "A") || season.raceEvents[0];
  const goalDate = goalRace ? new Date(goalRace.date) : season.goalRaceDate ? new Date(season.goalRaceDate) : null;
  const daysToRace = goalDate
    ? Math.ceil((goalDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : null;
  const seasonStart = new Date(season.startDate).getTime();
  const today = Date.now();
  const progressToGoal =
    goalDate && today >= seasonStart
      ? Math.min(100, Math.max(0, ((today - seasonStart) / (goalDate.getTime() - seasonStart)) * 100))
      : null;

  return (
    <header className="space-y-4">
      {/* Title row */}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">{season.name}</h1>
        {/* Status line: phase + countdown + sport */}
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
          <span className="text-muted-foreground">
            {new Date(season.startDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })} –{" "}
            {new Date(season.endDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
          </span>
          <Badge variant="muted" className="font-normal">{season.sport}</Badge>
          {phase && <Badge variant="outline">{phase}</Badge>}
          {goalRace && daysToRace != null && daysToRace > 0 && (
            <span className="inline-flex items-center gap-1.5 text-muted-foreground">
              <Target className="h-3.5 w-3.5" />
              {goalRace.name} in {daysToRace}d
            </span>
          )}
        </div>
        {progressToGoal != null && goalDate && (
          <div className="mt-3 space-y-1">
            <div className="flex justify-between text-[11px] text-muted-foreground">
              <span>Today</span>
              <span>{daysToRace != null && daysToRace > 0 ? `${daysToRace} days to goal` : "Goal"}</span>
            </div>
            <Progress value={progressToGoal} className="h-1.5" />
          </div>
        )}
      </div>

      {/* KPI cards + CTAs */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2 sm:gap-3">
          {weekStats
            ? KPI_ITEMS.map((item) => (
                <div
                  key={item.key}
                  className="flex h-14 min-w-0 flex-col justify-center rounded-lg border border-border/50 bg-muted/10 px-3 py-2 transition-colors hover:bg-muted/20"
                >
                  <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground truncate">
                    {item.label}
                  </p>
                  <p className="mt-0.5 text-sm font-semibold tabular-nums tracking-tight text-foreground">
                    {item.render(weekStats)}
                  </p>
                </div>
              ))
            : null}
        </div>
        <div className="flex shrink-0 gap-2">
          {!hasBlocks ? (
            <Button onClick={onAutoCreateBlocks} size="sm" className="gap-2 shadow-sm">
              <Sparkles className="h-3.5 w-3.5" />
              Auto-Create Blocks
            </Button>
          ) : (
            <Button variant="outline" size="sm" onClick={onEditBlocks} className="gap-2">
              <Pencil className="h-3.5 w-3.5" />
              Edit Blocks
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={onAddMilestone} className="gap-2">
            <Plus className="h-3.5 w-3.5" />
            Add Milestone
          </Button>
        </div>
      </div>
    </header>
  );
}
