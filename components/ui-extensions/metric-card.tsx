"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { HelpCircle, TrendingDown, TrendingUp, Minus } from "lucide-react";
import { Sparkline } from "./sparkline";

type Tone = "neutral" | "success" | "warning" | "danger" | "info";

const toneValueClass: Record<Tone, string> = {
  neutral: "text-foreground",
  success: "text-emerald-400",
  warning: "text-amber-400",
  danger: "text-red-400",
  info: "text-blue-400",
};

export function MetricCard({
  title,
  value,
  unit,
  hint,
  tooltip,
  tone = "neutral",
  delta,
  deltaLabel,
  sparkline,
  density = "default",
  className,
}: {
  title: string;
  value: string | number;
  unit?: string;
  hint?: string | null;
  tooltip?: string | null;
  tone?: Tone;
  delta?: number | null;
  deltaLabel?: string | null;
  sparkline?: number[] | null;
  density?: "default" | "compact";
  className?: string;
}) {
  const pad = density === "compact" ? "p-3" : "p-4";
  const hasSparkline = Array.isArray(sparkline) && sparkline.length >= 2;

  const deltaView = (() => {
    if (delta === undefined || delta === null) return null;
    const isPositive = delta > 0;
    const isNegative = delta < 0;
    const _isNeutral = delta === 0;
    const Icon = isPositive ? TrendingUp : isNegative ? TrendingDown : Minus;
    const color = isPositive ? "text-emerald-400" : isNegative ? "text-red-400" : "text-muted-foreground";
    const sign = isPositive ? "+" : "";
    return (
      <div className="flex items-center gap-1.5 text-2xs">
        <Icon className={cn("h-3 w-3", color)} />
        <span className={cn("tabular-nums font-medium", color)}>
          {sign}
          {delta}%
        </span>
        {deltaLabel ? <span className="text-muted-foreground/70">{deltaLabel}</span> : null}
      </div>
    );
  })();

  return (
    <Card className={cn("h-full", className)}>
      <div className={cn("flex h-full flex-col", pad)}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-1.5 min-w-0">
            <div className="text-2xs font-medium text-muted-foreground uppercase tracking-wider truncate">
              {title}
            </div>
            {tooltip ? (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <HelpCircle className="h-3 w-3 text-muted-foreground/40 cursor-help hover:text-muted-foreground transition-colors" />
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-[220px] text-xs">
                    {tooltip}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            ) : null}
          </div>

          {hasSparkline ? (
            <div className={cn("shrink-0 text-muted-foreground/70", toneValueClass[tone])}>
              <Sparkline values={sparkline!} />
            </div>
          ) : null}
        </div>

        <div className="mt-2 flex items-baseline gap-1">
          <div className={cn("text-2xl font-semibold tabular-nums tracking-tight", toneValueClass[tone])}>
            {value}
          </div>
          {unit ? <div className="text-xs text-muted-foreground">{unit}</div> : null}
        </div>

        {hint ? <div className="mt-0.5 text-2xs text-muted-foreground/80 line-clamp-1">{hint}</div> : null}

        <div className="mt-2 flex items-center justify-between gap-2">
          {deltaView}
          {tone !== "neutral" ? (
            <Badge
              variant={
                tone === "success"
                  ? "success"
                  : tone === "warning"
                    ? "warning"
                    : tone === "danger"
                      ? "danger"
                      : "info"
              }
              className="h-5 px-2"
            >
              {tone === "success"
                ? "Good"
                : tone === "warning"
                  ? "Caution"
                  : tone === "danger"
                    ? "Low"
                    : "Info"}
            </Badge>
          ) : (
            <div className="h-5" />
          )}
        </div>
      </div>
    </Card>
  );
}

