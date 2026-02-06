"use client";

import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { TrendingUp, TrendingDown, Minus, HelpCircle } from "lucide-react";
import { LineChart, Line, ResponsiveContainer } from "recharts";
import { cn } from "@/lib/utils";

interface KpiSignalCardProps {
  title: string;
  value: string | number;
  unit?: string;
  label?: string;
  delta?: number;
  deltaLabel?: string;
  sparklineData?: number[];
  tooltip?: string;
  variant?: "default" | "success" | "warning" | "danger";
}

const variantColors = {
  default: "text-foreground",
  success: "text-emerald-400",
  warning: "text-amber-400",
  danger: "text-red-400",
};

const sparklineColors = {
  default: "#71717a",
  success: "#34d399",
  warning: "#fbbf24",
  danger: "#f87171",
};

const variantBg = {
  default: "",
  success: "bg-emerald-500/5",
  warning: "bg-amber-500/5",
  danger: "bg-red-500/5",
};

export function KpiSignalCard({
  title,
  value,
  unit,
  label,
  delta,
  deltaLabel = "vs last week",
  sparklineData,
  tooltip,
  variant = "default",
}: KpiSignalCardProps) {
  const chartData = sparklineData?.map((v, i) => ({ idx: i, value: v })) || [];
  const hasSparkline = chartData.length >= 2;

  const renderDelta = () => {
    if (delta === undefined || delta === null) return null;
    
    const isPositive = delta > 0;
    const isNegative = delta < 0;
    const isNeutral = delta === 0;

    return (
      <div className="flex items-center gap-1.5 text-2xs">
        {isPositive && <TrendingUp className="h-3 w-3 text-emerald-400" />}
        {isNegative && <TrendingDown className="h-3 w-3 text-red-400" />}
        {isNeutral && <Minus className="h-3 w-3 text-muted-foreground" />}
        <span className={cn(
          "tabular-nums font-medium",
          isPositive ? "text-emerald-400" : isNegative ? "text-red-400" : "text-muted-foreground"
        )}>
          {isPositive ? "+" : ""}{delta}%
        </span>
        <span className="text-muted-foreground/70">{deltaLabel}</span>
      </div>
    );
  };

  return (
    <div className={cn(
      "rounded-card border border-border/50 p-4 h-full transition-all duration-150 hover:border-border/80",
      variantBg[variant]
    )}>
      <div className="flex flex-col h-full">
        <div className="flex items-start justify-between mb-2">
          <div className="flex items-center gap-1.5">
            <span className="text-2xs font-medium text-muted-foreground uppercase tracking-wider">
              {title}
            </span>
            {tooltip && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <HelpCircle className="h-3 w-3 text-muted-foreground/40 cursor-help hover:text-muted-foreground transition-colors" />
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-[200px] text-xs">
                    {tooltip}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
          {hasSparkline && (
            <div className="w-14 h-5 opacity-70">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <Line
                    type="monotone"
                    dataKey="value"
                    stroke={sparklineColors[variant]}
                    strokeWidth={1.5}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        <div className="flex items-baseline gap-1 mb-0.5">
          <span className={cn("text-2xl font-semibold tabular-nums tracking-tight", variantColors[variant])}>
            {value}
          </span>
          {unit && <span className="text-xs text-muted-foreground">{unit}</span>}
        </div>

        {label && (
          <p className="text-2xs text-muted-foreground/80 mb-1.5 line-clamp-1">{label}</p>
        )}

        {renderDelta()}
      </div>
    </div>
  );
}
