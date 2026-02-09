"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Workout } from "@prisma/client";
import { DailyCheckInModal } from "@/components/daily-checkin-modal";
import { WorkoutFeedbackModal } from "@/components/workout-feedback-modal";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as ChartTooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import {
  ChevronDown,
  ChevronRight,
  Info,
  Lightbulb,
  Loader2,
  Flame,
  Zap,
  X,
  FileText,
} from "lucide-react";
import { cn, formatLocalDateInput } from "@/lib/utils";
import { applyDeloadWeek } from "@/lib/actions/decision";
import { getDailyInsightExplanation } from "@/lib/actions/insight-explanation";
import { parseWorkoutPlanJson } from "@/lib/plans/compat";
import type {
  PremiumCheckinResult,
  TodayPremiumCheckinPayload,
} from "@/lib/actions/daily-checkin";
import {
  getWeeklySummaryExport,
  type DashboardRetentionSummary,
} from "@/lib/actions/dashboard-retention";
import type { DailyQuoteResult } from "@/lib/actions/quotes";

import {
  ChartCard,
  SafetyCard,
  DailyCheckinInline,
  ConflictBanner,
  CheckinModal,
  ConflictReviewDrawer,
} from "@/components/dashboard";
import { TodayDecisionSheet } from "@/components/today-decision-sheet";

import {
  ActionCard,
  CompactToggle,
  EmptyState,
  ListCard,
  MetricCard,
  SectionHeader,
  useCompactMode,
} from "@/components/ui-extensions";

interface ReadinessData {
  score: number;
  status: string;
  factors: { factor: string; impact: number; description: string }[];
  confidence: number;
  fatigueType: string;
  fatigueRecommendation: string;
}

interface RiskData {
  rampRate: number;
  rampStatus: string;
  weeklyLoad: number;
  previousWeekLoad: number;
  riskScore: number;
  warnings: { type: string; message: string; severity: string }[];
}

interface PsychologyData {
  compliance: {
    score: number;
    status: string;
    completionRate: number;
    currentStreak: number;
    plannedWorkouts: number;
    completedWorkouts: number;
    nudge: string | null;
  } | null;
  burnout: {
    risk: number;
    status: string;
    drivers: { driver: string; description: string }[];
    recommendation: string;
    actions: { id: string; label: string; description: string }[];
  } | null;
  insight: {
    text: string;
    type: string;
    drivers: { factor: string; value: string | number }[];
  } | null;
}

type PremiumCheckinState = {
  status: TodayPremiumCheckinPayload["status"];
  data: PremiumCheckinResult | null | undefined;
  error?: string | null;
};

interface DashboardClientProps {
  metrics: {
    ctl: number;
    atl: number;
    tsb: number;
    readiness: number | null;
    weeklyHours: number;
    weeklyTSS: number;
    lastWeekHours: number;
    lastWeekTSS: number;
    weeklyHoursDelta: number | null;
    weeklyTSSDelta: number | null;
    ctlDelta: number | null;
    ctlSparkline: number[];
    monthlyHours: number;
    workoutsThisWeek: number;
    chartData: Array<{ date: string; ctl: number; atl: number; tsb: number }>;
  };
  upcomingWorkouts: Workout[];
  recentWorkouts: Workout[];
  readinessData?: ReadinessData | null;
  riskData?: RiskData | null;
  readinessTrend?: { date: string; score: number; status: string }[];
  psychologyData?: PsychologyData | null;
  checkInRequired?: boolean;
  checkInWorkout?: { id: string; title: string; type: string; duration: number; tss: number } | null;
  todayCheckIn?: {
    id: string;
    aiDecision: string | null;
    aiExplanation: string | null;
    userAccepted: boolean | null;
  } | null;
  premiumCheckin: TodayPremiumCheckinPayload;
  retentionSummary?: DashboardRetentionSummary;
  quote?: DailyQuoteResult | null;
  latestDigest?: {
    id: string;
    weekStart: string;
    weekEnd: string;
    subject: string | null;
    text: string | null;
    data: string | null;
  } | null;
}

export function DashboardClientV2({
  metrics,
  upcomingWorkouts,
  recentWorkouts,
  readinessData,
  riskData,
  readinessTrend,
  psychologyData,
  checkInRequired,
  checkInWorkout,
  todayCheckIn,
  premiumCheckin,
  retentionSummary,
  quote,
  latestDigest,
}: DashboardClientProps) {
  const { compact, setCompact } = useCompactMode();
  const density = compact ? "compact" : "default";
  const searchParams = useSearchParams();

  const [isApplyingDeload, setIsApplyingDeload] = useState(false);
  const [insightDismissed, setInsightDismissed] = useState(false);
  const [showCheckInModal, setShowCheckInModal] = useState(checkInRequired || false);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [feedbackWorkout, setFeedbackWorkout] = useState<null | { id: string; title: string }>(null);
  const [exportingWeekly, setExportingWeekly] = useState(false);
  const [trendsOpen, setTrendsOpen] = useState(true);

  const [premiumCheckinState, setPremiumCheckinState] = useState<PremiumCheckinState>({
    status: premiumCheckin.status,
    data: premiumCheckin.data ?? null,
    error: premiumCheckin.error ?? null,
  });
  const [showPremiumCheckinModal, setShowPremiumCheckinModal] = useState(false);
  const [explainOpen, setExplainOpen] = useState(false);
  const [conflictDrawerOpen, setConflictDrawerOpen] = useState(false);
  const [todayDecisionOpen, setTodayDecisionOpen] = useState(false);
  useEffect(() => {
    if (searchParams.get("whatToday") === "1") {
      setTodayDecisionOpen(true);
    }
  }, [searchParams]);

  useEffect(() => {
    setPremiumCheckinState({
      status: premiumCheckin.status,
      data: premiumCheckin.data ?? null,
      error: premiumCheckin.error ?? null,
    });
  }, [premiumCheckin]);

  const [insightExplainOpen, setInsightExplainOpen] = useState(false);
  const [insightExplainLoading, setInsightExplainLoading] = useState(false);
  const [insightExplainError, setInsightExplainError] = useState<string | null>(null);
  const [insightExplainData, setInsightExplainData] = useState<null | {
    explanation: string;
    confidence: number;
    sources: Array<{ type: string; id: string; date: string; snippet: string }>;
  }>(null);

  const handleCheckinSaved = (result: PremiumCheckinResult) => {
    setPremiumCheckinState({ status: "completed", data: result, error: null });
  };

  const handleConflictResolved = () => {
    setPremiumCheckinState((prev) => ({
      ...prev,
      data: prev.data
        ? { ...prev.data, hasConflict: false, conflictReason: null, suggestedChange: null }
        : prev.data,
    }));
    setConflictDrawerOpen(false);
  };

  const nextAction = retentionSummary?.nextAction;
  const streaks = retentionSummary?.streaks;

  const readinessScore = readinessData?.score ?? null;
  const hasReadiness = readinessData != null && typeof readinessData.score === "number";
  const topFactor = readinessData?.factors?.[0]?.description;

  const _readinessVariant = !hasReadiness
    ? "default"
    : (readinessScore ?? 0) >= 70
    ? "success"
    : (readinessScore ?? 0) >= 45
    ? "warning"
    : "danger";

  const adaptedBadge =
    todayCheckIn?.aiDecision && todayCheckIn.aiDecision !== "PROCEED" && todayCheckIn.userAccepted
      ? "Adapted from check-in"
      : null;

  const hasPreTrainingWorkout = Boolean(checkInWorkout);
  const preTrainingStatus = todayCheckIn
    ? "completed"
    : checkInRequired
    ? "required"
    : "pending";
  const preTrainingBadgeVariant =
    preTrainingStatus === "completed" ? "success" : preTrainingStatus === "required" ? "warning" : "muted";
  const preTrainingDescription = todayCheckIn
    ? todayCheckIn.aiDecision
      ? `Coach: ${todayCheckIn.aiDecision}`
      : "Check-in saved for today."
    : hasPreTrainingWorkout
    ? `${checkInWorkout?.title} • ${checkInWorkout?.type} • ${checkInWorkout?.duration} min`
    : "Plan a session to unlock pre-training check-in.";

  const checkinData = premiumCheckinState.data ?? null;
  const checkinStatus = premiumCheckinState.status;
  const checkinError = premiumCheckinState.error;
  const isPremiumLoading = checkinStatus === "pending" && !checkinData && !checkinError;
  const conflictActive = Boolean(checkinData?.hasConflict && checkinData.suggestedChange);
  const explanationText = useMemo(() => {
    if (!checkinData) return null;
    const metrics = [
      `Sleep ${checkinData.sleepQuality}/100`,
      `Fatigue ${checkinData.fatigue}/100`,
      `Motivation ${checkinData.motivation}/100`,
      `Soreness ${checkinData.soreness}/100`,
      `Stress ${checkinData.stress}/100`,
    ];
    const reason = checkinData.topFactor || "your metrics";
    return `Readiness ${checkinData.readinessScore}/100 — ${checkinData.recommendation.toLowerCase()} because ${reason.toLowerCase()} is the limiter. ${metrics.join(", ")}.`;
  }, [checkinData]);

  const initialCheckinData = checkinData
    ? {
        sleepQuality: checkinData.sleepQuality,
        fatigue: checkinData.fatigue,
        motivation: checkinData.motivation,
        soreness: checkinData.soreness,
        stress: checkinData.stress,
        notes: checkinData.notes ?? "",
        notesVisibility: checkinData.notesVisibility,
      }
    : undefined;

  async function openInsightExplanation() {
    setInsightExplainOpen(true);
    setInsightExplainLoading(true);
    setInsightExplainError(null);
    setInsightExplainData(null);
    try {
      const res = await getDailyInsightExplanation();
      if (!res.success || !res.data) {
        setInsightExplainError(res.error || "Unable to explain insight");
        return;
      }
      setInsightExplainData({
        explanation: res.data.explanation,
        confidence: res.data.confidence,
        sources: res.data.sources.map((s) => ({
          type: s.type,
          id: s.id,
          date: new Date(s.date).toLocaleDateString(),
          snippet: s.snippet,
        })),
      });
    } catch {
      setInsightExplainError("Unable to explain insight");
    } finally {
      setInsightExplainLoading(false);
    }
  }

  function downloadTextFile(filename: string, content: string) {
    const blob = new Blob([content], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  async function handleExportWeeklySummary() {
    setExportingWeekly(true);
    try {
      const res = await getWeeklySummaryExport();
      if (!res.success || !res.data) {
        toast.error("Export failed", { description: res.error || "Unable to export" });
        return;
      }
      if (!res.data.markdown || res.data.markdown.trim().length === 0) {
        toast.error("Nothing to export", { description: "No summary content available yet" });
        return;
      }
      downloadTextFile(res.data.filename, res.data.markdown);
      toast.success("Weekly summary downloaded");
    } catch {
      toast.error("Export failed", { description: "Unexpected error" });
    } finally {
      setExportingWeekly(false);
    }
  }

  async function handleApplyDeload() {
    setIsApplyingDeload(true);
    try {
      const today = new Date();
      const result = await applyDeloadWeek(formatLocalDateInput(today));
      if (result.success) {
        toast.success("Deload Applied", { description: result.message });
      } else {
        toast.error("Failed to apply deload", { description: result.error });
      }
    } catch {
      toast.error("Error applying deload");
    } finally {
      setIsApplyingDeload(false);
    }
  }

  const heroSubtitle = (() => {
    const kind = nextAction?.kind;
    if (kind === "COMPLETE_CHECKIN_OR_SKIP") return "Complete your daily check-in for personalized recommendations.";
    if (kind === "ADD_FEEDBACK") return "Log feedback for your last workout.";
    if (kind === "START_WORKOUT") return nextAction?.subtitle || "Ready for today's workout.";
    if (kind === "DO_CHECKIN") return "Review your plan and complete check-in.";
    return "Plan your next training session.";
  })();

  const heroCta = (() => {
    const kind = nextAction?.kind;
    if (kind === "COMPLETE_CHECKIN_OR_SKIP" || kind === "DO_CHECKIN") {
      return {
        label: "Open Check-in",
        onClick: () => {
          if (!checkInWorkout) {
            toast.error("No workout found", { description: "Plan a workout in Calendar first" });
            return;
          }
          setShowCheckInModal(true);
        },
      };
    }
    if (kind === "ADD_FEEDBACK") {
      return {
        label: "Add Feedback",
        onClick: () => {
          if (!nextAction?.workout?.id || !nextAction?.workout?.title) {
            toast.error("Unable to open feedback");
            return;
          }
          setFeedbackWorkout({ id: nextAction.workout.id, title: nextAction.workout.title });
          setShowFeedbackModal(true);
        },
      };
    }
    if (kind === "START_WORKOUT") {
      return {
        label: "View Workout",
        href: nextAction?.workout?.id
          ? `/calendar?workoutId=${encodeURIComponent(nextAction.workout.id)}`
          : "/calendar",
      };
    }
    return { label: "Plan Workout", href: "/calendar" };
  })();

  const openPremiumCheckin = () => setShowPremiumCheckinModal(true);

  const checkinSlot = (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3 rounded-control border border-border/50 bg-secondary/30 p-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-foreground">Pre-training check-in</span>
            <Badge variant={preTrainingBadgeVariant} className="h-5 px-2 text-2xs">
              {preTrainingStatus === "completed"
                ? "Completed"
                : preTrainingStatus === "required"
                ? "Required"
                : "Pending"}
            </Badge>
          </div>
          <div className="mt-0.5 text-2xs text-muted-foreground truncate">{preTrainingDescription}</div>
        </div>
        {hasPreTrainingWorkout ? (
          <Button
            variant={preTrainingStatus === "required" ? "default" : "ghost"}
            size="sm"
            onClick={() => setShowCheckInModal(true)}
            className={cn(
              "h-7 text-xs",
              preTrainingStatus === "required" && "bg-amber-500 hover:bg-amber-600 text-white"
            )}
          >
            {todayCheckIn ? "View" : "Open"}
            <ChevronRight className="h-3 w-3 ml-1" />
          </Button>
        ) : (
          <Link href="/calendar">
            <Button variant="outline" size="sm" className="h-7 text-xs">
              Plan workout
            </Button>
          </Link>
        )}
      </div>

      {isPremiumLoading ? (
        <Skeleton className="h-14 w-full rounded-control" />
      ) : (
        <DailyCheckinInline
          status={checkinStatus}
          checkin={checkinData}
          onOpenCheckin={openPremiumCheckin}
          onViewCheckin={openPremiumCheckin}
          onExplain={explanationText ? () => setExplainOpen(true) : undefined}
          className="w-full"
        />
      )}

      {conflictActive && checkinData?.conflictReason && checkinData.suggestedChange && (
        <ConflictBanner
          conflictReason={checkinData.conflictReason}
          onReview={() => setConflictDrawerOpen(true)}
        />
      )}

      {checkinError && (
        <div className="rounded-control border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive">
          Unable to load the daily check-in right now. Refresh the page if this keeps happening.
        </div>
      )}
    </div>
  );

  const chartLen = metrics.chartData.length;
  const chartState = chartLen === 0 ? "empty" : chartLen < 3 ? "insufficient" : "ready";
  const chartNote = chartLen > 0 && chartLen < 3
    ? ({ tone: "warning" as const, text: `Need ${Math.max(0, 3 - chartLen)} more days` })
    : null;

  const readinessLen = readinessTrend?.length ?? 0;
  const readinessState = readinessLen === 0 ? "empty" : readinessLen < 3 ? "insufficient" : "ready";
  const readinessNote = readinessLen > 0 && readinessLen < 3
    ? ({ tone: "warning" as const, text: `Need ${Math.max(0, 3 - readinessLen)} more check-ins` })
    : null;

  const baselineMissing = !riskData || riskData.previousWeekLoad === 0;
  const showSafetyAlert =
    !!riskData &&
    !baselineMissing &&
    (riskData.rampStatus !== "SAFE" || riskData.warnings.length > 0);

  const safetyRiskLevel =
    riskData?.rampStatus === "DANGER"
      ? "danger"
      : riskData?.rampStatus === "WARNING"
      ? "high"
      : riskData?.previousWeekLoad === 0 && riskData?.weeklyLoad > 200
      ? "moderate"
      : "low";

  const readinessSparkline = readinessTrend?.map((r) => r.score) || [];

  function whenLabel(date: Date, _variant: "upcoming" | "recent"): string {
    const d = new Date(date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const dd = new Date(d);
    dd.setHours(0, 0, 0, 0);
    if (dd.getTime() === today.getTime()) return "Today";
    if (dd.getTime() === tomorrow.getTime()) return "Tomorrow";

    return d.toLocaleDateString("en-US", { weekday: "short" });
  }

  function prettyWorkoutType(type: string | null | undefined): string {
    const t = String(type ?? "").toLowerCase();
    if (t.includes("swim")) return "Swim";
    if (t.includes("bike") || t.includes("cycle")) return "Bike";
    if (t.includes("run")) return "Run";
    if (t.includes("strength") || t.includes("gym")) return "Strength";
    if (t.includes("rest")) return "Rest";
    return type ? type.charAt(0).toUpperCase() + type.slice(1) : "Workout";
  }

  function rpeFromPlanJson(raw: string | null | undefined): string | null {
    const s = typeof raw === "string" ? raw.trim() : "";
    if (!s) return null;
    const parsed = parseWorkoutPlanJson(s);
    if (!parsed) return null;

    if (parsed.kind === "prescription_v1") {
      const targets = parsed.plan.targets ?? [];
      for (const t of targets) {
        const label = String(t?.label ?? "").toLowerCase();
        if (!label.includes("rpe")) continue;
        const v = String(t?.value ?? "").trim();
        return v ? `RPE ${v}` : null;
      }
      return null;
    }

    const plan = parsed.plan;
    for (const sec of plan.sections ?? []) {
      for (const b of sec.blocks ?? []) {
        if (typeof b.intensityLabel === "string" && /rpe/i.test(b.intensityLabel)) {
          return b.intensityLabel.trim();
        }
        if (b.intensityRange?.unit === "rpe") {
          const min = typeof b.intensityRange.min === "number" ? b.intensityRange.min : null;
          const max = typeof b.intensityRange.max === "number" ? b.intensityRange.max : null;
          if (min != null && max != null) return `RPE ${min}–${max}`;
          if (min != null) return `RPE ${min}`;
          return "RPE";
        }
      }
    }
    return null;
  }

  function workoutMetaLine(w: Workout, variant: "upcoming" | "recent"): string {
    const when = whenLabel(w.date, variant);
    const type = prettyWorkoutType(w.type);
    const dur = typeof w.durationMin === "number" && w.durationMin > 0 ? `${w.durationMin}min` : null;
    const tss = typeof w.tss === "number" && w.tss > 0 ? `${w.tss} TSS` : null;
    const rpe = rpeFromPlanJson(w.prescriptionJson);
    const parts = [when, type, dur, tss, rpe].filter((p): p is string => typeof p === "string" && p.length > 0);
    return parts.join(" • ");
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="type-h1">Dashboard</h1>
          <p className="type-caption">Signals, next action, and trends — without the clutter.</p>
        </div>
        <div className="flex items-center gap-3">
          <CompactToggle value={compact} onChange={setCompact} />
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportWeeklySummary}
            disabled={exportingWeekly}
          >
            {exportingWeekly ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Exporting…
              </>
            ) : (
              "Export week"
            )}
          </Button>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          A) STATUS ROW
      ═══════════════════════════════════════════════════════════════════ */}
      <section className="grid gap-4 lg:grid-cols-12">
        {/* Action card */}
        <div className="lg:col-span-8">
          <ActionCard
            title="Today"
            subtitle={heroSubtitle}
            primary={
              "onClick" in heroCta
                ? { label: heroCta.label, onClick: heroCta.onClick! }
                : { label: heroCta.label, href: heroCta.href ?? "/calendar" }
            }
            secondary={{ label: "Calendar", href: "/calendar", variant: "outline" }}
            badges={
              <div className="flex flex-wrap items-center gap-2">
                {adaptedBadge ? (
                  <Badge variant="info" className="h-6 px-2">
                    {adaptedBadge}
                  </Badge>
                ) : null}
                {(streaks?.checkInDayStreak ?? 0) > 0 ? (
                  <Badge variant="muted" className="h-6 px-2 gap-1">
                    <Flame className="h-3 w-3 text-amber-400" />
                    {streaks?.checkInDayStreak}d check-in
                  </Badge>
                ) : null}
                {(streaks?.workoutWeekStreak ?? 0) > 0 ? (
                  <Badge variant="muted" className="h-6 px-2 gap-1">
                    <Zap className="h-3 w-3 text-emerald-400" />
                    {streaks?.workoutWeekStreak}w streak
                  </Badge>
                ) : null}
              </div>
            }
            density={density}
          >
            <div className="space-y-3">
              {checkinSlot}
              <Button
                variant="outline"
                size="sm"
                className="w-full text-primary border-primary/30 hover:bg-primary/5"
                onClick={() => setTodayDecisionOpen(true)}
              >
                What should I do today?
              </Button>
            </div>
          </ActionCard>
          <TodayDecisionSheet
            open={todayDecisionOpen}
            onOpenChange={setTodayDecisionOpen}
          />
        </div>

        {/* Metric cards */}
        <div className="lg:col-span-4 grid grid-cols-2 gap-3">
          <MetricCard
            title="Readiness"
            value={hasReadiness ? Math.round(readinessScore as number) : "—"}
            unit={hasReadiness ? "%" : undefined}
            hint={topFactor || (hasReadiness ? "Based on recent signals" : "No readiness data yet — complete check-in")}
            sparkline={readinessSparkline.length >= 2 ? readinessSparkline : null}
            tone={!hasReadiness ? "neutral" : (readinessScore ?? 0) >= 70 ? "success" : (readinessScore ?? 0) >= 45 ? "warning" : "danger"}
            tooltip="Readiness estimates how prepared you are to handle intensity today (sleep, fatigue, stress, and recent load)."
            density={density}
          />
          <MetricCard
            title="Weekly Hours"
            value={metrics.weeklyHours}
            unit="h"
            hint={metrics.lastWeekHours > 0 ? `Last week ${metrics.lastWeekHours}h` : "Build consistency week to week"}
            delta={metrics.weeklyHoursDelta}
            deltaLabel="vs last week"
            tooltip="Total completed training time in the last 7 days."
            density={density}
          />
          <MetricCard
            title="Weekly TSS"
            value={metrics.weeklyTSS}
            hint={metrics.lastWeekTSS > 0 ? `Last week ${metrics.lastWeekTSS} TSS` : "Baseline will appear after a few sessions"}
            delta={metrics.weeklyTSSDelta}
            deltaLabel="vs last week"
            tooltip="Training Stress Score accumulated in the last 7 days."
            density={density}
          />
          <MetricCard
            title="Fitness (CTL)"
            value={Math.round(metrics.ctl)}
            hint={`ATL ${Math.round(metrics.atl)} • TSB ${Math.round(metrics.tsb)}`}
            delta={metrics.ctlDelta}
            deltaLabel="14d trend"
            sparkline={metrics.ctlSparkline.length >= 2 ? metrics.ctlSparkline : null}
            tooltip="Chronic Training Load (CTL) is a 42‑day load average — a proxy for long-term fitness."
            density={density}
          />
        </div>
      </section>

      {/* Quote of the Day — only when quotes exist in DB */}
      {quote && (
        <Card className="bg-gradient-to-r from-primary/5 via-transparent to-transparent border-primary/10">
          <CardContent className={cn("py-5 px-6", density === "compact" && "py-3 px-4")}>
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <blockquote className="text-lg font-medium text-foreground/90 leading-relaxed">
                  &ldquo;{quote.quote.text}&rdquo;
                </blockquote>
                <div className="mt-3 flex items-center gap-3">
                  <p className="text-sm text-muted-foreground">— {quote.quote.author}</p>
                  <Badge variant="outline" className={`text-xs ${quote.categoryDisplay.color}`}>
                    {quote.categoryDisplay.label}
                  </Badge>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          Daily Insight (inline, dismissible)
      ═══════════════════════════════════════════════════════════════════ */}
      {psychologyData?.insight && !insightDismissed && (
        <Card className="border-l-4 border-l-primary/60 bg-primary/5">
          <CardContent className={cn("flex items-start gap-3", density === "compact" ? "py-3 px-4" : "py-3 px-5")}>
            <Lightbulb className="h-5 w-5 text-primary mt-0.5 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm text-foreground">{psychologyData.insight.text}</p>
              <button
                onClick={openInsightExplanation}
                className="text-xs text-muted-foreground hover:text-foreground mt-1 flex items-center gap-1"
              >
                <Info className="h-3 w-3" /> Why this insight?
              </button>
            </div>
            <button
              onClick={() => setInsightDismissed(true)}
              className="text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          </CardContent>
        </Card>
      )}

      {/* Insight Explanation Dialog */}
      <Dialog open={insightExplainOpen} onOpenChange={setInsightExplainOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Why this insight?</DialogTitle>
            <DialogDescription>Sources and confidence.</DialogDescription>
          </DialogHeader>
          {insightExplainLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
          {!insightExplainLoading && insightExplainError && (
            <p className="text-sm text-destructive">{insightExplainError}</p>
          )}
          {!insightExplainLoading && insightExplainData && (
            <div className="space-y-4">
              <div className="rounded-lg border p-3">
                <div className="text-sm font-medium">Explanation</div>
                <p className="text-sm text-muted-foreground mt-1">{insightExplainData.explanation}</p>
              </div>
              <div className="rounded-lg border p-3">
                <div className="text-sm font-medium">Confidence</div>
                <p className="text-sm text-muted-foreground mt-1">{insightExplainData.confidence}%</p>
              </div>
              <div className="rounded-lg border p-3">
                <div className="text-sm font-medium">Sources</div>
                {insightExplainData.sources.length === 0 ? (
                  <p className="text-sm text-muted-foreground mt-1">No sources available.</p>
                ) : (
                  <div className="mt-2 space-y-2">
                    {insightExplainData.sources.map((s) => (
                      <div key={s.id} className="rounded-md bg-muted/30 p-2">
                        <div className="text-xs text-muted-foreground">
                          {s.type} • {s.date}
                        </div>
                        <div className="text-sm">{s.snippet}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ═══════════════════════════════════════════════════════════════════
          B) PLANNING ROW
      ═══════════════════════════════════════════════════════════════════ */}
      <section className="grid gap-4 md:grid-cols-2">
        <ListCard
          title="Upcoming Workouts"
          subtitle="Next planned sessions"
          density={density}
          right={
            <Link href="/calendar">
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-2xs text-muted-foreground hover:text-foreground"
              >
                View all <ChevronRight className="h-3 w-3 ml-0.5" />
              </Button>
            </Link>
          }
          items={upcomingWorkouts}
          empty={{
            title: "Nothing planned yet",
            description: "Add your next session to start building trends and streaks.",
            cta: { label: "Plan workout", href: "/calendar" },
          }}
          renderItem={(w) => (
            <Link
              href={`/calendar?date=${encodeURIComponent(formatLocalDateInput(new Date(w.date)))}`}
              className={cn(
                "group block rounded-control transition-default hover:bg-accent/40",
                density === "compact" ? "px-2" : "px-2.5"
              )}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <div className="text-sm font-medium truncate">{w.title}</div>
                    <Badge variant="secondary" className="h-5 px-2">
                      Planned
                    </Badge>
                  </div>
                  <div className="mt-0.5 text-2xs text-muted-foreground tabular-nums truncate">
                    {workoutMetaLine(w, "upcoming")}
                  </div>
                </div>
                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/50 opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            </Link>
          )}
        />

        <ListCard
          title="Recent Activity"
          subtitle="Latest completed sessions"
          density={density}
          right={
            <Link href="/calendar">
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-2xs text-muted-foreground hover:text-foreground"
              >
                View all <ChevronRight className="h-3 w-3 ml-0.5" />
              </Button>
            </Link>
          }
          items={recentWorkouts}
          empty={{
            title: "No activity yet",
            description: "Log a workout to start tracking load, readiness, and trends.",
            cta: { label: "Add workout", href: "/calendar" },
          }}
          renderItem={(w) => (
            <Link
              href={`/calendar?date=${encodeURIComponent(formatLocalDateInput(new Date(w.date)))}`}
              className={cn(
                "group block rounded-control transition-default hover:bg-accent/40",
                density === "compact" ? "px-2" : "px-2.5"
              )}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <div className="text-sm font-medium truncate">{w.title}</div>
                    <Badge variant="success" className="h-5 px-2">
                      Done
                    </Badge>
                  </div>
                  <div className="mt-0.5 text-2xs text-muted-foreground tabular-nums truncate">
                    {workoutMetaLine(w, "recent")}
                  </div>
                </div>
                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/50 opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            </Link>
          )}
        />
      </section>

      {/* ═══════════════════════════════════════════════════════════════════
          B.5) WEEKLY DIGEST
      ═══════════════════════════════════════════════════════════════════ */}
      {latestDigest && (
        <Card className="border border-border/50 bg-secondary/20">
          <CardContent className={cn(density === "compact" ? "p-4" : "p-5")}>
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                  <h3 className="text-sm font-semibold">Weekly digest</h3>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {new Date(latestDigest.weekStart).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                  })}
                  {" – "}
                  {new Date(latestDigest.weekEnd).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                  })}
                </p>
                {latestDigest.text && (
                  <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
                    {latestDigest.text.slice(0, 150)}
                    {latestDigest.text.length > 150 ? "…" : ""}
                  </p>
                )}
              </div>
              <Link href={`/digest?id=${latestDigest.id}`}>
                <Button variant="outline" size="sm" className="shrink-0">
                  View
                </Button>
              </Link>
            </div>
            <Link
              href="/digest"
              className="mt-3 flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              View all digests <ChevronRight className="h-3 w-3" />
            </Link>
          </CardContent>
        </Card>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          C) TRENDS SECTION (collapsible on mobile)
      ═══════════════════════════════════════════════════════════════════ */}
      <Collapsible open={trendsOpen} onOpenChange={setTrendsOpen}>
        <SectionHeader
          title="Trends"
          subtitle="Load (CTL/ATL/TSB) and readiness over time"
          density={density}
          right={
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="md:hidden">
                <ChevronDown className={`h-4 w-4 transition-transform ${trendsOpen ? "" : "-rotate-90"}`} />
              </Button>
            </CollapsibleTrigger>
          }
        />
        <CollapsibleContent className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-2">
            {/* Performance Metrics Chart */}
            <ChartCard
              title="Performance Metrics"
              subtitle="CTL (Fitness), ATL (Fatigue), TSB (Form) — 30 days"
              state={chartState}
              height={300}
              note={chartNote}
              emptyTitle="Build a baseline"
              emptyDescription="Log a few sessions to unlock CTL/ATL/TSB trends."
              emptyCta={{ label: "Add workout", href: "/calendar" }}
            >
              {chartLen > 0 && (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={metrics.chartData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted/30" />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 11 }}
                      tickFormatter={(v) => {
                        const d = new Date(v);
                        return `${d.getMonth() + 1}/${d.getDate()}`;
                      }}
                      className="text-muted-foreground"
                    />
                    <YAxis tick={{ fontSize: 11 }} className="text-muted-foreground" />
                    <ChartTooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        borderColor: "hsl(var(--border))",
                        borderRadius: "8px",
                        fontSize: "12px",
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: "12px" }} />
                    <Line type="monotone" dataKey="ctl" name="CTL" stroke="hsl(var(--chart-1))" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="atl" name="ATL" stroke="hsl(var(--chart-2))" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="tsb" name="TSB" stroke="hsl(var(--chart-3))" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </ChartCard>

            {/* Readiness Trend Chart */}
            <ChartCard
              title="Readiness Trend"
              subtitle="14-day readiness score"
              state={readinessState}
              height={300}
              note={readinessNote}
              emptyTitle="No readiness history yet"
              emptyDescription="Complete a few daily check-ins to see your trend."
              emptyCta={{ label: "Open check-in", onClick: openPremiumCheckin }}
            >
              {readinessLen > 0 && (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={readinessTrend}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted/30" />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 11 }}
                      tickFormatter={(v) => {
                        const d = new Date(v);
                        return `${d.getMonth() + 1}/${d.getDate()}`;
                      }}
                      className="text-muted-foreground"
                    />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} className="text-muted-foreground" />
                    <ChartTooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        borderColor: "hsl(var(--border))",
                        borderRadius: "8px",
                        fontSize: "12px",
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="score"
                      name="Readiness"
                      stroke="hsl(var(--primary))"
                      strokeWidth={2}
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </ChartCard>
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* ═══════════════════════════════════════════════════════════════════
          D) SAFETY CARD
      ═══════════════════════════════════════════════════════════════════ */}
      {showSafetyAlert && riskData && (
        <div className="space-y-3">
          <SafetyCard
            show={true}
            riskLevel={safetyRiskLevel as "low" | "moderate" | "high" | "danger"}
            riskScore={riskData.riskScore}
            currentWeekLoad={riskData.weeklyLoad}
            previousWeekLoad={riskData.previousWeekLoad}
            rampRate={riskData.rampRate}
            warnings={riskData.warnings.map((w) => w.message)}
            recommendations={
              riskData.rampStatus !== "SAFE"
                ? ["Consider reducing this week's volume", "Add an extra rest day"]
                : undefined
            }
          />

          {riskData.rampStatus !== "SAFE" && (
            <div className="flex justify-end">
              <Button variant="outline" size="sm" onClick={handleApplyDeload} disabled={isApplyingDeload}>
                {isApplyingDeload ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Applying…
                  </>
                ) : (
                  "Apply deload week"
                )}
              </Button>
            </div>
          )}
        </div>
      )}

      {baselineMissing && (
        <Card>
          <CardContent className={cn(density === "compact" ? "p-4" : "p-5")}>
            <SectionHeader
              title="Training Load Safety"
              subtitle="We need a small baseline to assess ramp rate and risk."
              density={density}
            />
            <div className="min-h-[160px]">
              <EmptyState
                title="Need baseline"
                description="Complete a few sessions (or add past workouts) to unlock safety analysis."
                cta={{ label: "Add workout", href: "/calendar" }}
                size={density === "compact" ? "sm" : "md"}
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          MODALS
      ═══════════════════════════════════════════════════════════════════ */}
      {checkInWorkout && (
        <DailyCheckInModal
          open={showCheckInModal}
          onOpenChange={setShowCheckInModal}
          workout={checkInWorkout}
          onComplete={() => setShowCheckInModal(false)}
        />
      )}

      {feedbackWorkout && (
        <WorkoutFeedbackModal
          open={showFeedbackModal}
          onOpenChange={(open) => {
            setShowFeedbackModal(open);
            if (!open) setFeedbackWorkout(null);
          }}
          workoutId={feedbackWorkout.id}
          workoutTitle={feedbackWorkout.title}
        />
      )}

      <CheckinModal
        open={showPremiumCheckinModal}
        onOpenChange={setShowPremiumCheckinModal}
        initialData={initialCheckinData}
        onSuccess={handleCheckinSaved}
      />

      {checkinData && conflictActive && (
        <ConflictReviewDrawer
          open={conflictDrawerOpen}
          onOpenChange={setConflictDrawerOpen}
          checkInId={checkinData.id}
          conflictReason={checkinData.conflictReason ?? "Coach is suggesting a safer option."}
          suggestedChange={checkinData.suggestedChange}
          readinessScore={checkinData.readinessScore}
          isLocked={Boolean(checkinData.planLocked)}
          onAccepted={handleConflictResolved}
          onDismissed={handleConflictResolved}
        />
      )}

      {explanationText && (
        <Dialog open={explainOpen} onOpenChange={setExplainOpen}>
          <DialogContent className="sm:max-w-[420px]">
            <DialogHeader>
              <DialogTitle>Why this readiness?</DialogTitle>
            </DialogHeader>
            <DialogDescription className="text-sm leading-relaxed text-muted-foreground">
              {explanationText}
            </DialogDescription>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
