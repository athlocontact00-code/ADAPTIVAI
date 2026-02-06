"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Zap, Sun, Moon } from "lucide-react";
import { cn } from "@/lib/utils";

export type TodayDecisionPayload = {
  decision: "DO_THIS_WORKOUT" | "LIGHT_ALTERNATIVE" | "REST_TODAY";
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
};

interface TodayDecisionSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function TodayDecisionSheet({ open, onOpenChange }: TodayDecisionSheetProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<{
    decision: TodayDecisionPayload;
    cached: boolean;
    date: string;
  } | null>(null);

  async function fetchDecision() {
    setLoading(true);
    setError(null);
    setData(null);
    try {
      const res = await fetch("/api/ai/today-decision", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j?.error ?? "Failed to get recommendation");
      }
      const j = await res.json();
      setData({
        decision: j.decision,
        cached: j.cached ?? false,
        date: j.date ?? new Date().toISOString(),
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  function handleOpenChange(next: boolean) {
    if (next && !data && !loading) {
      fetchDecision();
    }
    if (!next) {
      setData(null);
      setError(null);
    }
    onOpenChange(next);
  }

  const decisionVariant =
    data?.decision.decision === "DO_THIS_WORKOUT"
      ? "primary"
      : data?.decision.decision === "LIGHT_ALTERNATIVE"
      ? "neutral"
      : "caution";

  const DecisionIcon =
    data?.decision.decision === "DO_THIS_WORKOUT"
      ? Zap
      : data?.decision.decision === "LIGHT_ALTERNATIVE"
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

  const ctaLabel =
    data?.decision.decision === "DO_THIS_WORKOUT"
      ? "Open workout"
      : data?.decision.decision === "LIGHT_ALTERNATIVE"
      ? "Apply & add to calendar"
      : "Mark rest day";

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent side="bottom" className="rounded-t-2xl max-h-[85vh] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>What should I do today?</SheetTitle>
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
                    <Badge variant="secondary" className="text-2xs">
                      {data.decision.confidence}
                    </Badge>
                    {data.cached && (
                      <Badge variant="outline" className="text-2xs">
                        Cached
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    {data.decision.action.details}
                  </p>
                  <p className="text-xs text-muted-foreground/80 mt-2 italic">
                    {data.decision.why}
                  </p>
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
