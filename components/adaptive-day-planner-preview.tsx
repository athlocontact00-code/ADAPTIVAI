"use client";

import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { getAdaptivePlannerPatchMeta, getAdaptivePlannerPreviewTitle } from "@/lib/product/adaptive-day-planner-ui";
import type { AdaptiveDayPlannerPayload, AdaptivePlannerPatchItem } from "@/lib/services/adaptive-day-planner.service";

export function AdaptiveDayPlannerReasonChips(props: {
  reasons?: string[] | null;
  limit?: number;
  className?: string;
}) {
  const reasons = props.reasons?.filter(Boolean).slice(0, props.limit ?? 4) ?? [];
  if (reasons.length === 0) return null;

  return (
    <div className={props.className ?? "flex flex-wrap gap-2"}>
      {reasons.map((reason) => (
        <Badge key={reason} variant="outline" className="h-6 px-2 text-2xs">
          {reason}
        </Badge>
      ))}
    </div>
  );
}

export function AdaptiveDayPlannerPreview(props: {
  preview?: AdaptiveDayPlannerPayload["patchPreview"] | null;
  title?: string;
  className?: string;
}) {
  const preview = props.preview;
  if (!preview || preview.items.length === 0) return null;

  return (
    <div className={props.className ?? "rounded-lg border border-border/60 bg-background/70 p-3"}>
      <div className="text-xs font-semibold">{props.title ?? getAdaptivePlannerPreviewTitle()}</div>
      <p className="mt-1 text-xs text-muted-foreground">{preview.summary}</p>
      <div className="mt-3 space-y-2">
        {preview.items.map((item) => (
          <AdaptiveDayPlannerPreviewItem key={`${item.date}-${item.title}`} item={item} />
        ))}
      </div>
    </div>
  );
}

function AdaptiveDayPlannerPreviewItem(props: { item: AdaptivePlannerPatchItem }) {
  const patchMeta = getAdaptivePlannerPatchMeta(props.item.change);

  return (
    <div className="rounded-md border border-border/50 p-2">
      <div className="flex items-center justify-between gap-2">
        <div className="text-xs font-medium">{props.item.title}</div>
        <Badge variant={patchMeta.variant} className="text-2xs">
          {patchMeta.label}
        </Badge>
      </div>
      <div className="mt-1 text-2xs text-muted-foreground">
        {props.item.date} • {props.item.type}
      </div>
      {(props.item.before || props.item.after) && (
        <div className="mt-2 space-y-1 text-2xs text-muted-foreground">
          {props.item.before ? <div>Before: {props.item.before}</div> : null}
          {props.item.after ? <div>After: {props.item.after}</div> : null}
        </div>
      )}
    </div>
  );
}
