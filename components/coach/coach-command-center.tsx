"use client";

import { useState, useEffect, useCallback } from "react";
import { Calendar, Zap, TrendingUp, Battery, Clock, Pin, ChevronDown, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";

interface TodayWorkout {
  id: string;
  title: string;
  type: string;
  durationMin: number | null;
  tss: number | null;
}

interface CoachPageData {
  todayWorkout: TodayWorkout | null;
  todayTss: number;
  weekPlannedHours: number;
  weekPlannedTss: number;
  weekCompliancePercent: number;
  rampStatus: "rising" | "stable" | "spiking";
  lastCheckInDate: Date | null;
  atl: number;
}

interface CoachContext {
  readiness: number;
  currentAtl: number;
}

export interface ApiCoachSuggestion {
  id: string;
  contextDate: string;
  scope: string;
  type: string;
  title: string;
  summary: string;
  why: string;
  payload: Record<string, unknown>;
  status: string;
  appliedAt: string | null;
  dismissedAt: string | null;
  createdAt: string;
}

interface CoachCommandCenterProps {
  pageData: CoachPageData | null;
  context: CoachContext | null;
  onCommand: (cmd: string) => void;
  onRefresh?: () => void;
}

function hasAppliedEffect(suggestions: ApiCoachSuggestion[], type: string, scope?: string): boolean {
  return suggestions.some(
    (s) => s.status === "APPLIED" && s.type === type && (scope == null || s.scope === scope)
  );
}

export function CoachCommandCenter({ pageData, context, onCommand, onRefresh }: CoachCommandCenterProps) {
  const [suggestions, setSuggestions] = useState<ApiCoachSuggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [applyingId, setApplyingId] = useState<string | null>(null);

  const todayWorkout = pageData?.todayWorkout ?? null;
  const readiness = context?.readiness ?? 0;
  const atl = pageData?.atl ?? context?.currentAtl ?? 0;

  const pendingSuggestions = suggestions.filter((s) => s.status === "PENDING");
  const appliedSuggestions = suggestions.filter((s) => s.status === "APPLIED");

  const appliedAdjustToday = hasAppliedEffect(appliedSuggestions, "ADJUST_INTENSITY", "today");
  const appliedSwapSession = hasAppliedEffect(appliedSuggestions, "SWAP_SESSION");
  const appliedRebalanceWeek = hasAppliedEffect(appliedSuggestions, "REBALANCE_WEEK");

  const fetchSuggestions = useCallback(async () => {
    setLoading(true);
    try {
      const today = new Date().toISOString().slice(0, 10);
      const res = await fetch(`/api/ai/coach-suggestions?date=${today}&includeApplied=true`);
      if (!res.ok) throw new Error("Failed to fetch");
      const data = (await res.json()) as { suggestions: ApiCoachSuggestion[] };
      setSuggestions(data.suggestions ?? []);
    } catch (e) {
      console.error("[CoachSuggestions] Fetch error:", e);
      setSuggestions([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSuggestions();
  }, [fetchSuggestions]);

  const handleGenerate = useCallback(async () => {
    if (generating) return;
    setGenerating(true);
    try {
      const res = await fetch("/api/ai/coach-suggestions/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ force: false }),
      });
      const data = (await res.json()) as { ok?: boolean; count?: number; error?: string };
      if (!res.ok || !data.ok) {
        toast.error(data.error ?? "Failed to generate suggestions");
        return;
      }
      toast.success(data.count ? `Generated ${data.count} suggestion(s)` : "No new suggestions");
      await fetchSuggestions();
    } catch (_e) {
      toast.error("Failed to generate suggestions");
    } finally {
      setGenerating(false);
    }
  }, [generating, fetchSuggestions]);

  const handleApply = useCallback(
    async (s: ApiCoachSuggestion) => {
      if (s.status !== "PENDING" || applyingId) return;
      setApplyingId(s.id);
      try {
        const res = await fetch(`/api/ai/coach-suggestions/${s.id}/apply`, { method: "POST" });
        const data = (await res.json()) as { ok?: boolean; error?: string; proposalCreated?: boolean };
        if (!res.ok || !data.ok) {
          toast.error(data.error ?? "Failed to apply");
          return;
        }
        toast.success(data.proposalCreated ? "Proposal created" : "Suggestion applied");
        setSuggestions((prev) =>
          prev.map((x) => (x.id === s.id ? { ...x, status: "APPLIED" as const, appliedAt: new Date().toISOString() } : x))
        );
        onRefresh?.();
      } catch (_e) {
        toast.error("Failed to apply");
      } finally {
        setApplyingId(null);
      }
    },
    [applyingId, onRefresh]
  );

  const handleDismiss = useCallback(
    async (s: ApiCoachSuggestion) => {
      if (s.status !== "PENDING" || applyingId) return;
      setApplyingId(s.id);
      try {
        const res = await fetch(`/api/ai/coach-suggestions/${s.id}/dismiss`, { method: "POST" });
        const data = (await res.json()) as { ok?: boolean; error?: string };
        if (!res.ok || !data.ok) {
          toast.error(data.error ?? "Failed to dismiss");
          return;
        }
        setSuggestions((prev) => prev.filter((x) => x.id !== s.id));
        toast("Suggestion dismissed");
      } catch (_e) {
        toast.error("Failed to dismiss");
      } finally {
        setApplyingId(null);
      }
    },
    [applyingId]
  );

  return (
    <div className="grid gap-2 md:grid-cols-3">
      {/* Card 1: Today Focus – compact */}
      <Card className="border-border/50 overflow-hidden max-h-[220px] flex flex-col">
        <CardHeader className="p-2.5 pb-0 flex-shrink-0">
          <CardTitle className="text-xs font-medium flex items-center gap-1.5">
            <Zap className="h-3.5 w-3.5 text-muted-foreground" />
            Today Focus
          </CardTitle>
        </CardHeader>
        <CardContent className="p-2.5 pt-1 space-y-1.5 flex-1 min-h-0 overflow-y-auto">
          {todayWorkout ? (
            <>
              <div className="rounded-md border border-border/50 bg-muted/20 px-2.5 py-2">
                <p className="font-medium text-xs">{todayWorkout.title}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  {todayWorkout.type} · {todayWorkout.durationMin ?? 0} min
                  {todayWorkout.tss != null && todayWorkout.tss > 0 && ` · ${todayWorkout.tss} TSS`}
                </p>
                {appliedAdjustToday && (
                  <Badge variant="secondary" className="mt-1.5 text-[10px] h-4 px-1.5">
                    Intensity adjusted
                  </Badge>
                )}
              </div>
              <div className="flex flex-wrap gap-1.5 text-[11px]">
                <span className="flex items-center gap-1 text-muted-foreground">
                  <Battery className="h-2.5 w-2.5" />
                  {Math.round(readiness)}%
                </span>
                <span className="flex items-center gap-1 text-muted-foreground">
                  <TrendingUp className="h-2.5 w-2.5" />
                  ATL {Math.round(atl)}
                </span>
                {pageData?.lastCheckInDate && (
                  <span className="flex items-center gap-1 text-muted-foreground">
                    <Clock className="h-2.5 w-2.5" />
                    {new Date(pageData.lastCheckInDate).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                    })}
                  </span>
                )}
              </div>
              <div className="flex flex-wrap gap-1">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-6 text-[11px] px-2"
                  onClick={() => onCommand("Explain today's workout")}
                >
                  Explain today
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-6 text-[11px] px-2"
                  onClick={() => onCommand("Adjust today based on check-in")}
                >
                  Adjust based on check-in
                </Button>
              </div>
            </>
          ) : (
            <>
              <div className="rounded-md border border-dashed border-border/50 bg-muted/5 py-4 text-center">
                <p className="text-xs text-muted-foreground">No workout planned</p>
                {appliedAdjustToday && (
                  <Badge variant="secondary" className="mt-1.5 text-[10px] h-4 px-1.5">
                    Intensity adjusted
                  </Badge>
                )}
              </div>
              <div className="flex flex-wrap gap-1.5 text-[11px] text-muted-foreground">
                <span>Readiness {Math.round(readiness)}%</span>
                <span>ATL {Math.round(atl)}</span>
              </div>
              <Button
                size="sm"
                variant="outline"
                className="h-6 text-[11px] w-full"
                onClick={() => onCommand("Generate today's workout")}
              >
                Generate today&apos;s workout
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      {/* Card 2: This Week – compact */}
      <Card className="border-border/50 overflow-hidden max-h-[220px] flex flex-col">
        <CardHeader className="p-2.5 pb-0 flex-shrink-0">
          <CardTitle className="text-xs font-medium flex items-center gap-1.5">
            <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
            This Week
          </CardTitle>
        </CardHeader>
        <CardContent className="p-2.5 pt-1 space-y-1.5 flex-1 min-h-0 overflow-y-auto">
          <div className="flex flex-wrap gap-1.5 items-center">
            <span className="text-xs">
              <span className="font-semibold">{pageData?.weekCompliancePercent ?? 0}%</span> compliance
            </span>
            <span className="text-muted-foreground text-[10px]">·</span>
            <span className="text-xs">
              <span className="font-semibold">{pageData?.weekPlannedHours ?? 0}h</span> planned
            </span>
            <span className="text-muted-foreground text-[10px]">·</span>
            <span className="text-xs">
              <span className="font-semibold">{pageData?.weekPlannedTss ?? 0}</span> TSS
            </span>
          </div>
          <div className="flex flex-wrap gap-1.5 items-center">
            <Badge
              variant="outline"
              className={cn(
                "text-[10px] h-5 px-1.5",
                pageData?.rampStatus === "spiking" && "border-amber-500/50 text-amber-500",
                pageData?.rampStatus === "rising" && "border-emerald-500/50 text-emerald-500"
              )}
            >
              {pageData?.rampStatus === "stable" && "Load stable"}
              {pageData?.rampStatus === "rising" && "Load rising"}
              {pageData?.rampStatus === "spiking" && "Load spiking"}
            </Badge>
            {appliedSwapSession && (
              <Badge variant="secondary" className="text-[10px] h-5 px-1.5">
                Swap suggested
              </Badge>
            )}
            {appliedRebalanceWeek && (
              <Badge variant="secondary" className="text-[10px] h-5 px-1.5">
                Rebalanced
              </Badge>
            )}
          </div>
          <div className="flex flex-wrap gap-1">
            <Button
              size="sm"
              variant="outline"
              className="h-6 text-[11px] px-2"
              onClick={() => onCommand("Generate 7-day training plan")}
            >
              Generate 7-day plan
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-6 text-[11px] px-2"
              onClick={() => onCommand("Balance load this week")}
            >
              Balance load
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Card 3: Coach Suggestions – API-driven */}
      <Card className="border-border/50 overflow-hidden">
        <CardHeader className="p-2.5 pb-0 flex-shrink-0">
          <CardTitle className="text-xs font-medium flex items-center gap-1.5">
            <Pin className="h-3.5 w-3.5 text-muted-foreground" />
            Coach Suggestions
          </CardTitle>
        </CardHeader>
        <CardContent className="p-2.5 pt-1 space-y-1.5">
          {loading ? (
            <p className="text-xs text-muted-foreground py-4 text-center flex items-center justify-center gap-2">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Loading…
            </p>
          ) : pendingSuggestions.length === 0 ? (
            <>
              <p className="text-xs text-muted-foreground py-4 text-center">
                No suggestions yet.
              </p>
              <Button
                size="sm"
                variant="outline"
                className="h-6 text-[11px] w-full"
                disabled={generating}
                onClick={handleGenerate}
              >
                {generating ? (
                  <>
                    <Loader2 className="h-3 w-3 animate-spin mr-1" />
                    Generating…
                  </>
                ) : (
                  "Generate suggestions"
                )}
              </Button>
            </>
          ) : (
            <>
              {pendingSuggestions.map((s) => {
                const isApplied = s.status === "APPLIED";
                const isApplying = applyingId === s.id;
                return (
                  <div
                    key={s.id}
                    className="rounded-md border border-border/50 bg-muted/10 p-2.5 space-y-1.5"
                  >
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <p className="font-medium text-xs">{s.title}</p>
                      <Badge variant="outline" className="text-[9px] h-4 px-1">
                        {s.scope}
                      </Badge>
                    </div>
                    <p className="text-[11px] text-muted-foreground">{s.summary}</p>
                    <Collapsible className="group">
                      <CollapsibleTrigger
                        className={cn(
                          "flex items-center gap-1 py-0.5 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
                        )}
                      >
                        Why
                        <ChevronDown className="h-3 w-3 shrink-0 transition-transform group-data-[state=open]:rotate-180" />
                      </CollapsibleTrigger>
                      <CollapsibleContent className="text-[11px] text-muted-foreground pt-1">
                        {s.why}
                      </CollapsibleContent>
                    </Collapsible>
                    <div className="flex gap-1 pt-1">
                      <Button
                        size="sm"
                        variant={isApplied ? "secondary" : "default"}
                        className="h-5 text-[11px] px-2"
                        disabled={isApplied || isApplying}
                        onClick={() => handleApply(s)}
                      >
                        {isApplying ? "Applying…" : isApplied ? "Applied ✓" : "Apply"}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-5 text-[11px] px-2"
                        disabled={isApplying}
                        onClick={() => handleDismiss(s)}
                      >
                        Dismiss
                      </Button>
                    </div>
                  </div>
                );
              })}
              <Button
                size="sm"
                variant="ghost"
                className="h-5 text-[11px] w-full"
                disabled={generating}
                onClick={handleGenerate}
              >
                {generating ? "Generating…" : "Generate more"}
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
