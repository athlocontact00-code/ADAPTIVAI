"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AdaptivePlannerStatusCluster } from "@/components/adaptive-planner-status-cluster";
import { Loader2, RefreshCw, Zap, Sun, Moon } from "lucide-react";
import {
  AdaptiveDayPlannerPreview,
  AdaptiveDayPlannerReasonChips,
} from "@/components/adaptive-day-planner-preview";
import {
  getTodayDecisionStaleBadgeCopy,
  type TodayDecisionStaleReason,
} from "@/lib/product/today-decision-staleness";
import { cn } from "@/lib/utils";

export type TodayDecisionPayload = {
  decision: "CHECK_IN_FIRST" | "DO_THIS_WORKOUT" | "ADAPT_SESSION" | "RECOVER_AND_REPLAN" | "PLAN_NEXT";
  state: "NO_PLAN" | "CHECK_IN_REQUIRED" | "READY" | "ADAPT" | "FEEDBACK_REQUIRED" | "COMPLETE";
  generatedAt?: string;
  action: {
    title: string;
    details: string;
    targets?: {
      discipline?: string;
      paceRange?: string;
      powerRange?: string;
      hrRange?: string;
      durationMin?: number;
    };
    link?: {
      type: "workout" | "calendar_day" | "coach_chat";
      id?: string;
      date?: string;
    };
  };
  why: string;
  confidence: "LOW" | "MED" | "HIGH";
  reasons: string[];
  patchPreview?: {
    summary: string;
    horizonDays: number;
    items: Array<{
      date: string;
      title: string;
      type: string;
      change: "KEEP" | "ADAPT" | "RECOVER" | "REVIEW";
      before: string | null;
      after: string | null;
    }>;
  } | null;
};

export type TodayDecisionSnapshot = {
  decision: TodayDecisionPayload;
  cached: boolean;
  stale?: boolean;
  staleReason?: TodayDecisionStaleReason | null;
  changedAt?: string | null;
  date: string;
};

interface TodayDecisionSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  refreshKey?: number | string;
  initialData?: TodayDecisionSnapshot | null;
  onDataChange?: (data: TodayDecisionSnapshot | null) => void;
}

export function TodayDecisionSheet({
  open,
  onOpenChange,
  refreshKey,
  initialData = null,
  onDataChange,
}: TodayDecisionSheetProps) {
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const autoRefreshKeyRef = useRef<string | null>(null);
  const externalRefreshKeyRef = useRef<number | string | undefined>(refreshKey);
  const [data, setData] = useState<TodayDecisionSnapshot | null>(initialData);

  useEffect(() => {
    setData(initialData);
  }, [initialData]);

  useEffect(() => {
    if (!open) {
      autoRefreshKeyRef.current = null;
      return;
    }
    if (!data?.stale) return;
    const refreshKey = [data.date, data.staleReason ?? "", data.changedAt ?? ""].join(":");
    if (autoRefreshKeyRef.current === refreshKey) return;
    autoRefreshKeyRef.current = refreshKey;
    void fetchDecision({ force: true, preserveData: true });
  }, [open, data?.stale, data?.date, data?.staleReason, data?.changedAt]);

  useEffect(() => {
    if (typeof refreshKey === "undefined") return;
    if (typeof externalRefreshKeyRef.current === "undefined") {
      externalRefreshKeyRef.current = refreshKey;
      return;
    }
    if (externalRefreshKeyRef.current === refreshKey) return;
    externalRefreshKeyRef.current = refreshKey;
    void fetchDecision({ force: true, preserveData: true });
  }, [refreshKey]);

  async function fetchDecision(options?: { force?: boolean; preserveData?: boolean }) {
    const force = options?.force ?? false;
    const preserveData = options?.preserveData ?? false;
    if (force) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);
    if (!preserveData && !initialData) {
      setData(null);
    }
    try {
      const res = await fetch("/api/ai/today-decision", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(force ? { force: true } : {}),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j?.error ?? "Failed to get recommendation");
      }
      const j = await res.json();
      const nextData: TodayDecisionSnapshot = {
        decision: j.decision,
        cached: j.cached ?? false,
        stale: j.stale ?? false,
        staleReason: j.staleReason ?? null,
        changedAt: j.changedAt ?? null,
        date: j.date ?? new Date().toISOString(),
      };
      setData(nextData);
      onDataChange?.(nextData);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  function handleOpenChange(next: boolean) {
    if (next && !data && !loading) {
      fetchDecision();
    }
    if (!next) {
      setError(null);
    }
    onOpenChange(next);
  }

  const decisionVariant =
    data?.decision.decision === "DO_THIS_WORKOUT"
      ? "primary"
      : data?.decision.decision === "ADAPT_SESSION" || data?.decision.decision === "CHECK_IN_FIRST"
      ? "neutral"
      : "caution";

  const DecisionIcon =
    data?.decision.decision === "DO_THIS_WORKOUT"
      ? Zap
      : data?.decision.decision === "ADAPT_SESSION" || data?.decision.decision === "CHECK_IN_FIRST"
      ? Sun
      : Moon;

  const ctaHref = (() => {
    const link = data?.decision.action?.link;
    if (!link) return null;
    if (link.type === "workout" && link.id)
      return `/calendar?workoutId=${encodeURIComponent(link.id)}`;
    if (link.type === "calendar_day" && link.date)
      return `/calendar?date=${link.date}`;
    if (link.type === "coach_chat") return "/coach";
    return null;
  })();

  const ctaLabel = (() => {
    const link = data?.decision.action?.link;
    if (!link) return "Open details";
    if (link.type === "workout") return "Open workout";
    if (link.type === "calendar_day") return "Review in calendar";
    if (link.type === "coach_chat") return "Open coach";
    return "Open details";
  })();

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent side="bottom" className="rounded-t-2xl max-h-[85dvh] overflow-y-auto safe-area-inset-bottom scroll-touch">
        <SheetHeader>
          <SheetTitle>Today&apos;s recommendation</SheetTitle>
        </SheetHeader>
        <div className="mt-4 space-y-4">
          {loading && (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Getting your recommendation…</p>
            </div>
          )}
          {error && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
              {error}
            </div>
          )}
          {data && !loading && (
            <div
              className={cn(
                "rounded-xl border p-4",
                decisionVariant === "primary" && "border-primary/40 bg-primary/5",
                decisionVariant === "neutral" && "border-muted bg-muted/20",
                decisionVariant === "caution" && "border-amber-500/30 bg-amber-500/5"
              )}
            >
              <div className="flex items-start gap-3">
                <div
                  className={cn(
                    "rounded-full p-2",
                    decisionVariant === "primary" && "bg-primary/20",
                    decisionVariant === "neutral" && "bg-muted",
                    decisionVariant === "caution" && "bg-amber-500/20"
                  )}
                >
                  <DecisionIcon
                    className={cn(
                      "h-5 w-5",
                      decisionVariant === "primary" && "text-primary",
                      decisionVariant === "neutral" && "text-muted-foreground",
                      decisionVariant === "caution" && "text-amber-600"
                    )}
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold">
                      {data.decision.action.title}
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2 text-2xs"
                      onClick={() => fetchDecision({ force: true, preserveData: true })}
                      disabled={loading || refreshing}
                    >
                      {refreshing ? (
                        <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                      ) : (
                        <RefreshCw className="mr-1 h-3 w-3" />
                      )}
                      Refresh
                    </Button>
                  </div>
                  <AdaptivePlannerStatusCluster
                    className="mt-1"
                    decision={data.decision.decision}
                    state={data.decision.state}
                    generatedAt={data.decision.generatedAt}
                    cached={data.cached}
                    stale={data.stale}
                    staleReason={data.staleReason}
                    changedAt={data.changedAt}
                    extraBadges={
                      <>
                        <Badge variant="secondary" className="text-2xs">
                          {data.decision.confidence} confidence
                        </Badge>
                        {data.stale ? (
                          <Badge variant="warning" className="text-2xs">
                            {getTodayDecisionStaleBadgeCopy(data.staleReason)}
                          </Badge>
                        ) : null}
                      </>
                    }
                    actions={null}
                  />
                  <p className="text-sm text-muted-foreground mt-1">
                    {data.decision.action.details}
                  </p>
                  <p className="text-xs text-muted-foreground/80 mt-2 italic">
                    {data.decision.why}
                  </p>
                  <AdaptiveDayPlannerReasonChips reasons={data.decision.reasons} className="mt-3 flex flex-wrap gap-2" />
                  <AdaptiveDayPlannerPreview preview={data.decision.patchPreview} className="mt-4 rounded-lg border border-border/60 bg-background/70 p-3" />
                  {ctaHref && (
                    <Link href={ctaHref} className="block mt-3">
                      <Button size="sm" className="w-full sm:w-auto">
                        {ctaLabel}
                      </Button>
                    </Link>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
