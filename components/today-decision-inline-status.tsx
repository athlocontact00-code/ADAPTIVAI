import React from "react";
import {
  getTodayDecisionGeneratedLabel,
  getTodayDecisionStaleDetail,
  type TodayDecisionStaleReason,
} from "@/lib/product/today-decision-staleness";
import { cn } from "@/lib/utils";

export function TodayDecisionInlineStatus(props: {
  stale?: boolean;
  staleReason?: TodayDecisionStaleReason | null;
  changedAt?: string | null;
  generatedAt?: string | null;
  cached?: boolean;
  className?: string;
}) {
  const generatedLabel = getTodayDecisionGeneratedLabel({
    generatedAt: props.generatedAt,
    cached: props.cached,
  });
  const staleDetail = props.stale
    ? getTodayDecisionStaleDetail({
        reason: props.staleReason,
        changedAt: props.changedAt,
      })
    : null;

  if (!generatedLabel && !staleDetail) {
    return null;
  }

  return (
    <div className={cn("space-y-1", props.className)}>
      {staleDetail ? <div className="text-2xs text-amber-300">{staleDetail}</div> : null}
      {generatedLabel ? <div className="text-2xs text-muted-foreground">{generatedLabel}</div> : null}
    </div>
  );
}
