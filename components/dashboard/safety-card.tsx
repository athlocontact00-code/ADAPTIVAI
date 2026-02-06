"use client";

import { AlertTriangle, TrendingUp, Shield, Info } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

type RiskLevel = "low" | "moderate" | "high" | "danger";

interface SafetyCardProps {
  show: boolean;
  riskLevel: RiskLevel;
  riskScore?: number;
  currentWeekLoad: number;
  previousWeekLoad: number;
  rampRate?: number;
  warnings?: string[];
  recommendations?: string[];
}

const riskConfig: Record<RiskLevel, { color: string; bgColor: string; borderColor: string; icon: typeof Shield }> = {
  low: {
    color: "text-emerald-400",
    bgColor: "bg-emerald-500/5",
    borderColor: "border-emerald-500/20",
    icon: Shield,
  },
  moderate: {
    color: "text-amber-400",
    bgColor: "bg-amber-500/5",
    borderColor: "border-amber-500/20",
    icon: Info,
  },
  high: {
    color: "text-orange-400",
    bgColor: "bg-orange-500/5",
    borderColor: "border-orange-500/20",
    icon: AlertTriangle,
  },
  danger: {
    color: "text-red-400",
    bgColor: "bg-red-500/5",
    borderColor: "border-red-500/20",
    icon: AlertTriangle,
  },
};

const riskLabels: Record<RiskLevel, string> = {
  low: "Safe",
  moderate: "Moderate",
  high: "Elevated",
  danger: "High Risk",
};

function formatRampRate(currentLoad: number, previousLoad: number, rampRate?: number): { display: string; note?: string } {
  if (previousLoad === 0) {
    return {
      display: "N/A",
      note: `No baseline last week. This week: ${currentLoad} load.`,
    };
  }
  
  if (rampRate !== undefined) {
    const sign = rampRate >= 0 ? "+" : "";
    return { display: `${sign}${rampRate.toFixed(0)}%` };
  }
  
  const calculated = ((currentLoad - previousLoad) / previousLoad) * 100;
  const sign = calculated >= 0 ? "+" : "";
  return { display: `${sign}${calculated.toFixed(0)}%` };
}

export function SafetyCard({
  show,
  riskLevel,
  riskScore,
  currentWeekLoad,
  previousWeekLoad,
  rampRate,
  warnings = [],
  recommendations = [],
}: SafetyCardProps) {
  if (!show) return null;

  const config = riskConfig[riskLevel];
  const Icon = config.icon;
  const rampDisplay = formatRampRate(currentWeekLoad, previousWeekLoad, rampRate);
  const noBaseline = previousWeekLoad === 0;

  return (
    <div className={cn(
      "rounded-card border bg-card transition-all duration-150",
      config.borderColor,
      config.bgColor
    )}>
      <div className="p-5 pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className={cn("rounded-full p-1.5", config.bgColor)}>
              <Icon className={cn("h-4 w-4", config.color)} />
            </div>
            <h3 className="text-sm font-medium tracking-tight">Training Load Safety</h3>
          </div>
          <span className={cn(
            "inline-flex items-center rounded-pill px-2 py-0.5 text-2xs font-medium border",
            config.color,
            config.borderColor,
            config.bgColor
          )}>
            {riskLabels[riskLevel]}
          </span>
        </div>
      </div>
      <div className="px-5 pb-5">
        <div className="grid grid-cols-3 gap-4 mb-4">
          <div>
            <p className="text-2xs text-muted-foreground mb-1">This Week</p>
            <p className="text-xl font-semibold tabular-nums tracking-tight">{currentWeekLoad}</p>
          </div>
          <div>
            <p className="text-2xs text-muted-foreground mb-1">Last Week</p>
            <p className="text-xl font-semibold tabular-nums tracking-tight">
              {previousWeekLoad === 0 ? "—" : previousWeekLoad}
            </p>
          </div>
          <div>
            <div className="flex items-center gap-1 mb-1">
              <p className="text-2xs text-muted-foreground">Ramp Rate</p>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-3 w-3 text-muted-foreground/40 cursor-help hover:text-muted-foreground transition-colors" />
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-[200px] text-xs">
                    Week-over-week load change. Healthy ramp: ±10%. Above 20% increases injury risk.
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <div className="flex items-center gap-1">
              {!noBaseline && <TrendingUp className={cn("h-4 w-4", config.color)} />}
              <p className={cn(
                "text-xl font-semibold tabular-nums tracking-tight",
                noBaseline ? "text-muted-foreground" : ""
              )}>
                {rampDisplay.display}
              </p>
            </div>
          </div>
        </div>

        {rampDisplay.note && (
          <div className="rounded-control bg-muted/30 p-3 mb-3">
            <p className="text-xs text-muted-foreground/80">{rampDisplay.note}</p>
          </div>
        )}

        {noBaseline && currentWeekLoad > 0 && (
          <div className="rounded-control bg-amber-500/5 border border-amber-500/20 p-3 mb-3">
            <p className="text-xs text-amber-400">
              Load increased from 0 last week. Be conservative and monitor how you feel.
            </p>
          </div>
        )}

        {warnings.length > 0 && (
          <div className="space-y-1.5 mb-3">
            {warnings.map((warning, i) => (
              <div key={i} className="flex items-start gap-2">
                <AlertTriangle className={cn("h-3.5 w-3.5 mt-0.5 flex-shrink-0", config.color)} />
                <p className="text-xs text-muted-foreground/80">{warning}</p>
              </div>
            ))}
          </div>
        )}

        {recommendations.length > 0 && (
          <div className="border-t border-border/30 pt-3 mt-3">
            <p className="text-2xs font-medium mb-2">Recommendations</p>
            <ul className="space-y-1">
              {recommendations.map((rec, i) => (
                <li key={i} className="text-xs text-muted-foreground/80 flex items-start gap-2">
                  <span className="text-muted-foreground/40">•</span>
                  {rec}
                </li>
              ))}
            </ul>
          </div>
        )}

        {riskScore !== undefined && (
          <div className="border-t border-border/30 pt-3 mt-3">
            <div className="flex items-center justify-between">
              <p className="text-2xs text-muted-foreground">Risk Score</p>
              <p className={cn("text-sm font-semibold tabular-nums", config.color)}>{riskScore}/100</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
