import React from "react";

import { Badge } from "@/components/ui/badge";
import { TodayDecisionInlineStatus } from "@/components/today-decision-inline-status";
import {
  getAdaptivePlannerDecisionMeta,
  getAdaptivePlannerStateMeta,
} from "@/lib/product/adaptive-day-planner-ui";
import type { AdaptiveDayPlannerPayload, AdaptiveDayPlannerState } from "@/lib/services/adaptive-day-planner.service";
import type { TodayDecisionStaleReason } from "@/lib/product/today-decision-staleness";
import { cn } from "@/lib/utils";

export function AdaptivePlannerStatusCluster(props: {
  decision?: AdaptiveDayPlannerPayload["decision"];
  state?: AdaptiveDayPlannerState;
  generatedAt?: string | null;
  cached?: boolean;
  stale?: boolean;
  staleReason?: TodayDecisionStaleReason | null;
  changedAt?: string | null;
  className?: string;
  badgesClassName?: string;
  extraBadges?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  const decisionMeta = getAdaptivePlannerDecisionMeta(props.decision);
  const stateMeta = getAdaptivePlannerStateMeta(props.state);
  const hasAnyBadge = props.decision || props.state || props.extraBadges;

  if (
    !hasAnyBadge &&
    !props.generatedAt &&
    !props.stale &&
    !props.actions
  ) {
    return null;
  }

  return (
    <div className={cn("space-y-2", props.className)}>
      {hasAnyBadge || props.actions ? (
        <div className={cn("flex items-center gap-2 flex-wrap", props.badgesClassName)}>
          {props.decision ? (
            <Badge variant={decisionMeta.variant} className="text-2xs">
              {decisionMeta.label}
            </Badge>
          ) : null}
          {props.state ? (
            <Badge variant={stateMeta.variant} className="text-2xs">
              {stateMeta.label}
            </Badge>
          ) : null}
          {props.extraBadges}
          {props.actions}
        </div>
      ) : null}
      <TodayDecisionInlineStatus
        stale={props.stale}
        staleReason={props.staleReason}
        changedAt={props.changedAt}
        generatedAt={props.generatedAt}
        cached={props.cached}
      />
    </div>
  );
}
