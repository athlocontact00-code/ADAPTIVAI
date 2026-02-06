"use client";

import { AlertCircle, Info, AlertTriangle, X, Plus, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { formatHours, formatTSS, formatPercent } from "@/lib/utils/format";
import type { SeasonAlertHQ, MilestoneHQ } from "@/lib/types/season";
import type { CurrentWeekStats } from "@/lib/actions/season";

const SEVERITY_CONFIG = {
  info: {
    icon: Info,
    badge: "Info",
    className: "border-l-blue-500 bg-blue-500/5 border-blue-500/20",
    badgeVariant: "info" as const,
  },
  warn: {
    icon: AlertTriangle,
    badge: "Caution",
    className: "border-l-amber-500 bg-amber-500/5 border-amber-500/20",
    badgeVariant: "warning" as const,
  },
  danger: {
    icon: AlertCircle,
    badge: "Attention",
    className: "border-l-red-500 bg-red-500/5 border-red-500/20",
    badgeVariant: "danger" as const,
  },
} as const;

interface SeasonIntelligenceProps {
  weekStats: CurrentWeekStats | null;
  alerts: SeasonAlertHQ[];
  milestones: MilestoneHQ[];
  onDismissAlert: (id: string) => void;
  onAddMilestone: () => void;
  onEditMilestone?: (m: MilestoneHQ) => void;
  onDeleteMilestone?: (id: string) => void;
}

export function SeasonIntelligence({
  weekStats,
  alerts,
  milestones,
  onDismissAlert,
  onAddMilestone,
  onEditMilestone,
  onDeleteMilestone,
}: SeasonIntelligenceProps) {
  return (
    <aside className="w-full shrink-0 space-y-5 lg:w-80">
      <h3 className="text-sm font-semibold text-foreground">Season Intelligence</h3>

      {/* This Week Snapshot */}
      <Card className="overflow-hidden border-border/50">
        <CardHeader className="border-b border-border/40 bg-muted/5 px-4 py-3">
          <CardTitle className="text-sm font-medium">This Week</CardTitle>
        </CardHeader>
        <CardContent className="p-4">
          {weekStats ? (
            <div className="space-y-3 text-sm">
              <p className="text-[11px] text-muted-foreground">
                {new Date(weekStats.weekStart).toLocaleDateString("en-US", { month: "short", day: "numeric" })} –{" "}
                {new Date(weekStats.weekEnd).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Hours</p>
                  <p className="mt-0.5 font-semibold tabular-nums">
                    {formatHours(weekStats.doneHours)} / {formatHours(weekStats.plannedHours)} h
                  </p>
                </div>
                <div>
                  <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">TSS</p>
                  <p className="mt-0.5 font-semibold tabular-nums">
                    {formatTSS(weekStats.doneTSS)} / {formatTSS(weekStats.plannedTSS)}
                  </p>
                </div>
              </div>
              <div className="flex items-center justify-between pt-1">
                <span className="text-[11px] text-muted-foreground">Compliance</span>
                <Badge
                  variant={
                    weekStats.compliancePercent >= 80 ? "success" : weekStats.compliancePercent >= 60 ? "warning" : "danger"
                  }
                  className="text-xs"
                >
                  {formatPercent(weekStats.compliancePercent)}
                </Badge>
              </div>
              {weekStats.rampRate != null && (
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-muted-foreground">Ramp Rate</span>
                  <span className="text-xs font-medium tabular-nums">
                    {weekStats.rampRate > 0 ? "+" : ""}{formatPercent(weekStats.rampRate)}
                  </span>
                </div>
              )}
              {weekStats.keySessionsCount > 0 && (
                <p className="text-[11px] text-muted-foreground pt-1">
                  {weekStats.keySessionsCount} key session{weekStats.keySessionsCount !== 1 ? "s" : ""} planned
                </p>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No data for this week.</p>
          )}
        </CardContent>
      </Card>

      {/* Alert Center */}
      <Card className="overflow-hidden border-border/50">
        <CardHeader className="border-b border-border/40 bg-muted/5 px-4 py-3">
          <CardTitle className="text-sm font-medium">Alert Center</CardTitle>
        </CardHeader>
        <CardContent className="p-4">
          {alerts.length === 0 ? (
            <p className="text-sm text-muted-foreground">No alerts.</p>
          ) : (
            <div className="space-y-2">
              {alerts.map((a) => {
                const config = SEVERITY_CONFIG[a.severity as keyof typeof SEVERITY_CONFIG] ?? SEVERITY_CONFIG.info;
                return (
                  <div
                    key={a.id}
                    className={cn(
                      "rounded-lg border-l-4 border p-3 transition-colors",
                      config.className
                    )}
                    role="alert"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <Badge variant={config.badgeVariant} className="text-[10px] font-medium">
                            {config.badge}
                          </Badge>
                          <p className="font-medium text-sm text-foreground">{a.title}</p>
                        </div>
                        <p className="mt-1 text-[11px] text-muted-foreground leading-snug">{a.message}</p>
                        {a.why && (
                          <p className="mt-1.5 text-[11px] text-muted-foreground/80 italic">Why: {a.why}</p>
                        )}
                        {a.ctaLabel && (
                          <Button
                            size="sm"
                            variant="secondary"
                            className="mt-2 h-7 text-xs"
                          >
                            {a.ctaLabel}
                          </Button>
                        )}
                      </div>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 shrink-0 rounded-md opacity-70 hover:opacity-100"
                        onClick={() => onDismissAlert(a.id)}
                        aria-label="Dismiss"
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Milestones */}
      <Card className="overflow-hidden border-border/50">
        <CardHeader className="flex flex-row items-center justify-between border-b border-border/40 bg-muted/5 px-4 py-3">
          <CardTitle className="text-sm font-medium">Milestones</CardTitle>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 gap-1.5 text-xs font-medium"
            onClick={onAddMilestone}
          >
            <Plus className="h-3.5 w-3.5" />
            Add
          </Button>
        </CardHeader>
        <CardContent className="p-4">
          {milestones.length === 0 ? (
            <p className="text-sm text-muted-foreground">No milestones yet.</p>
          ) : (
            <div className="space-y-2">
              {milestones.map((m) => (
                <div
                  key={m.id}
                  className="group flex items-center justify-between gap-2 rounded-lg border border-border/40 bg-muted/5 px-3 py-2.5 transition-colors hover:bg-muted/15 hover:border-border/60"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground truncate">{m.name}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {new Date(m.date).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                      {m.kind && ` • ${m.kind.replace("_", " ")}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
                    {onEditMilestone && (
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 rounded-md"
                        onClick={() => onEditMilestone(m)}
                        aria-label="Edit"
                      >
                        <Pencil className="h-3 w-3" />
                      </Button>
                    )}
                    {onDeleteMilestone && (
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 rounded-md text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={() => onDeleteMilestone(m.id)}
                        aria-label="Delete"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </aside>
  );
}
