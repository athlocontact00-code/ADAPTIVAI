"use client";

import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

interface SettingsAiSummaryPanelProps {
  profile: {
    sportPrimary?: string;
    experienceLevel?: string;
    weeklyHoursGoal?: string;
  };
  zonesSummary?: string;
  hasBenchmarks?: boolean;
  className?: string;
}

export function SettingsAiSummaryPanel({
  profile,
  zonesSummary,
  hasBenchmarks,
  className,
}: SettingsAiSummaryPanelProps) {
  return (
    <aside
      className={cn(
        "hidden xl:block w-[280px] shrink-0",
        "sticky top-[72px] self-start",
        "rounded-[18px] border border-white/[0.06] bg-card/40 backdrop-blur-sm p-4",
        className
      )}
    >
      <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground mb-3">
        <Sparkles className="h-3.5 w-3.5" />
        AI uses these settings
      </div>
      <dl className="space-y-2 text-sm">
        <div>
          <dt className="text-[11px] text-muted-foreground/80">Sport</dt>
          <dd className="font-medium capitalize">
            {profile.sportPrimary || "—"}
          </dd>
        </div>
        <div>
          <dt className="text-[11px] text-muted-foreground/80">Level</dt>
          <dd className="font-medium capitalize">
            {profile.experienceLevel || "—"}
          </dd>
        </div>
        <div>
          <dt className="text-[11px] text-muted-foreground/80">Weekly hours</dt>
          <dd className="font-medium">
            {profile.weeklyHoursGoal ? `${profile.weeklyHoursGoal}h` : "—"}
          </dd>
        </div>
        {zonesSummary && (
          <div>
            <dt className="text-[11px] text-muted-foreground/80">HR zones</dt>
            <dd className="font-medium text-muted-foreground">{zonesSummary}</dd>
          </div>
        )}
        <div>
          <dt className="text-[11px] text-muted-foreground/80">Benchmarks</dt>
          <dd className="font-medium">
            {hasBenchmarks ? "Configured" : "Not set"}
          </dd>
        </div>
      </dl>
    </aside>
  );
}
