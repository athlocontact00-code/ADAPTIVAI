"use client";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  CheckCircle2,
  Clock,
  AlertTriangle,
  ChevronRight,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { PremiumCheckinResult } from "@/lib/actions/daily-checkin";

export type CheckinStatus = "pending" | "completed" | "required";

interface DailyCheckinInlineProps {
  status: CheckinStatus;
  checkin: PremiumCheckinResult | null;
  onOpenCheckin: () => void;
  onViewCheckin?: () => void;
  onExplain?: () => void;
  className?: string;
}

const statusConfig = {
  pending: {
    icon: Clock,
    label: "Pending",
    variant: "muted" as const,
    description: "Confirm readiness for today.",
    buttonLabel: "Open check-in",
  },
  required: {
    icon: AlertTriangle,
    label: "Required",
    variant: "warning" as const,
    description: "Check-in required before intense session.",
    buttonLabel: "Open check-in",
  },
  completed: {
    icon: CheckCircle2,
    label: "Completed",
    variant: "success" as const,
    description: "",
    buttonLabel: "View",
  },
};

function getReadinessColor(score: number): string {
  if (score >= 75) return "text-emerald-400";
  if (score >= 60) return "text-amber-400";
  if (score >= 45) return "text-orange-400";
  return "text-red-400";
}

function getTopFactorLabel(factor: string): string {
  const labels: Record<string, string> = {
    Sleep: "Sleep quality",
    Fatigue: "Fatigue level",
    Motivation: "Motivation",
    Soreness: "Muscle soreness",
    Stress: "Stress level",
  };
  return labels[factor] || factor;
}

export function DailyCheckinInline({
  status,
  checkin,
  onOpenCheckin,
  onViewCheckin,
  onExplain,
  className,
}: DailyCheckinInlineProps) {
  const config = statusConfig[status];
  const Icon = config.icon;

  const handleClick = () => {
    if (status === "completed" && onViewCheckin) {
      onViewCheckin();
    } else {
      onOpenCheckin();
    }
  };

  return (
    <div
      className={cn(
        "flex items-center justify-between gap-3 p-3 rounded-control border border-border/50 bg-secondary/30 transition-all duration-150 hover:border-border/80",
        className
      )}
    >
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <div
          className={cn(
            "flex items-center justify-center w-8 h-8 rounded-full shrink-0",
            status === "completed" && "bg-emerald-500/10",
            status === "pending" && "bg-muted/50",
            status === "required" && "bg-amber-500/10"
          )}
        >
          <Icon
            className={cn(
              "h-4 w-4",
              status === "completed" && "text-emerald-400",
              status === "pending" && "text-muted-foreground",
              status === "required" && "text-amber-400"
            )}
          />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-xs font-medium text-foreground">
              Daily check-in
            </span>
            <Badge variant={config.variant} className="text-2xs px-1.5 py-0">
              {config.label}
            </Badge>
          </div>

          {status === "completed" && checkin ? (
            <>
              <p className="text-2xs text-muted-foreground truncate">
                <span className={cn("font-medium", getReadinessColor(checkin.readinessScore))}>
                  Readiness {checkin.readinessScore}/100
                </span>
                {checkin.topFactor && (
                  <span className="text-muted-foreground/70">
                    {" "}— {getTopFactorLabel(checkin.topFactor)}
                  </span>
                )}
              </p>
              <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                {checkin.updatedAt && (
                  <span>
                    Saved{" "}
                    {new Date(checkin.updatedAt).toLocaleTimeString(undefined, {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                )}
                {onExplain && (
                  <button
                    type="button"
                    onClick={onExplain}
                    className="text-[10px] font-semibold text-primary hover:text-primary/80 transition-colors"
                  >
                    Why?
                  </button>
                )}
              </div>
            </>
          ) : (
            <p className="text-2xs text-muted-foreground/80 truncate">
              {config.description}
            </p>
          )}
        </div>
      </div>

      <Button
        variant={status === "required" ? "default" : "ghost"}
        size="sm"
        onClick={handleClick}
        className={cn(
          "h-7 text-xs shrink-0",
          status === "required" && "bg-amber-500 hover:bg-amber-600 text-white"
        )}
      >
        {config.buttonLabel}
        <ChevronRight className="h-3 w-3 ml-0.5" />
      </Button>
    </div>
  );
}

interface ConflictBannerProps {
  conflictReason: string;
  onReview: () => void;
  className?: string;
}

export function ConflictBanner({
  conflictReason,
  onReview,
  className,
}: ConflictBannerProps) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-3 p-3 rounded-control border border-amber-500/30 bg-amber-500/5 transition-all duration-150",
        className
      )}
    >
      <div className="flex items-center gap-2.5 min-w-0 flex-1">
        <div className="flex items-center justify-center w-7 h-7 rounded-full bg-amber-500/10 shrink-0">
          <Sparkles className="h-3.5 w-3.5 text-amber-400" />
        </div>
        <div className="min-w-0">
          <p className="text-xs font-medium text-foreground">
            Coach suggests a safer option
          </p>
          <p className="text-2xs text-muted-foreground/80 truncate">
            {conflictReason}
          </p>
        </div>
      </div>

      <Button
        variant="outline"
        size="sm"
        onClick={onReview}
        className="h-7 text-xs shrink-0 border-amber-500/30 hover:bg-amber-500/10"
      >
        Review
        <ChevronRight className="h-3 w-3 ml-0.5" />
      </Button>
    </div>
  );
}
