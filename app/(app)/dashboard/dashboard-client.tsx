"use client";

import { useEffect, useState } from "react";
import { Workout } from "@prisma/client";
import { DailyCheckInModal } from "@/components/daily-checkin-modal";
import { QuickActions } from "@/components/quick-actions";
import { WorkoutFeedbackModal } from "@/components/workout-feedback-modal";
import {
  Activity,
  TrendingUp,
  Clock,
  Zap,
  ChevronRight,
  Flame,
  Battery,
  Brain,
  ShieldAlert,
  AlertTriangle,
  Info,
  Loader2,
  Target,
  Lightbulb,
  X,
  ClipboardCheck,
  Download,
} from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { KPICard } from "@/components/kpi-card";
import {
  Tooltip as UITooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { applyDeloadWeek } from "@/lib/actions/decision";
import { getDailyInsightExplanation } from "@/lib/actions/insight-explanation";
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
import { formatDate, formatLocalDateInput } from "@/lib/utils";
import {
  getWeeklySummaryExport,
  type DashboardRetentionSummary,
} from "@/lib/actions/dashboard-retention";

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

interface DashboardClientProps {
  quote: {
    text: string;
    author: string;
    category: string;
    source: string | null;
    tone: string | null;
    categoryDisplay: { label: string; color: string };
  };
  metrics: {
    ctl: number;
    atl: number;
    tsb: number;
    readiness: number | null;
    weeklyHours: number;
    weeklyTSS: number;
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
  retentionSummary?: DashboardRetentionSummary;
}

export function DashboardClient({
  quote,
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
  retentionSummary,
}: DashboardClientProps) {
  const [isApplyingDeload, setIsApplyingDeload] = useState(false);
  const [insightDismissed, setInsightDismissed] = useState(false);
  const [showCheckInModal, setShowCheckInModal] = useState(checkInRequired || false);

  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [feedbackWorkout, setFeedbackWorkout] = useState<null | { id: string; title: string }>(null);
  const [exportingWeekly, setExportingWeekly] = useState(false);

  const [dismissNoonNudge, setDismissNoonNudge] = useState(false);
  const [dismissOverrideNudge, setDismissOverrideNudge] = useState(false);
  const [dismissPainNudge, setDismissPainNudge] = useState(false);

  const [isAfterNoonLocal, setIsAfterNoonLocal] = useState(false);
  useEffect(() => {
    setIsAfterNoonLocal(new Date().getHours() >= 12);
  }, []);

  const [insightExplainOpen, setInsightExplainOpen] = useState(false);
  const [insightExplainLoading, setInsightExplainLoading] = useState(false);
  const [insightExplainError, setInsightExplainError] = useState<string | null>(null);
  const [insightExplainData, setInsightExplainData] = useState<null | {
    explanation: string;
    confidence: number;
    sources: Array<{ type: string; id: string; date: string; snippet: string }>;
  }>(null);

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

  const nextAction = retentionSummary?.nextAction;
  const streaks = retentionSummary?.streaks;
  const nudges = retentionSummary?.nudges;

  const nextActionButton = (() => {
    const kind = nextAction?.kind;
    if (!kind) return null;

    if (kind === "COMPLETE_CHECKIN_OR_SKIP") {
      return {
        label: "Open check-in",
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
        label: "Add feedback",
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
        label: "Open in Calendar",
        href: nextAction?.workout?.id
          ? `/calendar?workoutId=${encodeURIComponent(nextAction.workout.id)}`
          : "/calendar",
      };
    }

    if (kind === "DO_CHECKIN") {
      return {
        label: "View plan",
        href: nextAction?.workout?.id
          ? `/calendar?workoutId=${encodeURIComponent(nextAction.workout.id)}`
          : "/calendar",
      };
    }

    return { label: "Plan workout", href: "/calendar" };
  })();

  const readinessScore =
    typeof readinessData?.score === "number" ? readinessData.score : metrics.readiness;
  const hasReadiness = typeof readinessScore === "number";
  const readinessStatus = readinessData?.status ?? (hasReadiness ? "CAUTION" : "");
  const fatigueType = readinessData?.fatigueType ?? "NONE";

  const readinessColor = !hasReadiness
    ? "text-muted-foreground"
    : readinessScore >= 70
    ? "text-green-500"
    : readinessScore >= 45
    ? "text-yellow-500"
    : "text-red-500";

  const readinessBgColor = !hasReadiness
    ? "bg-muted/20"
    : readinessScore >= 70
    ? "bg-green-500/10"
    : readinessScore >= 45
    ? "bg-yellow-500/10"
    : "bg-red-500/10";

  const fatigueColor = {
    CNS: "text-red-500",
    MUSCULAR: "text-orange-500",
    METABOLIC: "text-yellow-500",
    PSYCHOLOGICAL: "text-purple-500",
    NONE: "text-green-500",
  }[fatigueType] || "text-muted-foreground";

  const rampColor = {
    SAFE: "text-green-500",
    WARNING: "text-yellow-500",
    DANGER: "text-red-500",
  }[riskData?.rampStatus || "SAFE"] || "text-muted-foreground";

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

  return (
    <div className="page-container space-y-6">
      {/* Daily Check-in CTA */}
      <Card className="border-primary/15 bg-gradient-to-r from-primary/5 via-transparent to-transparent">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <ClipboardCheck className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-base">Daily Check-in</CardTitle>
              <CardDescription>Get a pre-training recommendation for today</CardDescription>
            </div>
          </div>
          <Button
            size="sm"
            onClick={() => {
              if (!checkInWorkout) {
                toast.error("No workout found", { description: "Plan a workout in Calendar first" });
                return;
              }
              setShowCheckInModal(true);
            }}
          >
            Open
          </Button>
        </CardHeader>
      </Card>

      {/* Next action + Retention */}
      {nextAction && (
        <Card>
          <CardHeader className="flex flex-row items-start justify-between gap-3">
            <div className="min-w-0">
              <CardTitle className="text-base">Next action</CardTitle>
              <CardDescription className="mt-1">
                <span className="font-medium text-foreground">{nextAction.title}</span>
                <span className="text-muted-foreground"> — {nextAction.subtitle}</span>
              </CardDescription>
            </div>
            {nextActionButton?.href ? (
              <Link href={nextActionButton.href}>
                <Button size="sm">{nextActionButton.label}</Button>
              </Link>
            ) : nextActionButton?.onClick ? (
              <Button size="sm" onClick={nextActionButton.onClick}>
                {nextActionButton.label}
              </Button>
            ) : null}
          </CardHeader>
          <CardContent className="pt-0">
            <div className="flex justify-end">
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportWeeklySummary}
                disabled={exportingWeekly}
              >
                {exportingWeekly ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Exporting...
                  </>
                ) : (
                  <>
                    <Download className="mr-2 h-4 w-4" />
                    Export weekly summary
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Streaks */}
      {streaks && (
        <div className="grid gap-4 md:grid-cols-2">
          <KPICard
            title="Check-in streak"
            value={`${streaks.checkInDayStreak}d`}
            subtitle="Days in a row"
            icon={<Flame className="h-4 w-4" />}
            iconColor="text-orange-500"
            tooltip="Counts consecutive days with a completed daily check-in."
          />
          <KPICard
            title="Workout streak"
            value={`${streaks.workoutWeekStreak}w`}
            subtitle={`Weeks with ≥ ${streaks.workoutWeekThreshold} workouts`}
            icon={<Target className="h-4 w-4" />}
            iconColor="text-primary"
            tooltip={`Counts consecutive weeks with at least ${streaks.workoutWeekThreshold} completed workouts.`}
          />
        </div>
      )}

      {/* Nudges */}
      {nudges && (
        <div className="space-y-2">
          {nudges.canShowNoonCheckInNudge && isAfterNoonLocal && !dismissNoonNudge && (
            <Card className="border-yellow-500/30 bg-yellow-500/10">
              <CardContent className="py-3 flex items-start gap-3">
                <AlertTriangle className="h-4 w-4 text-yellow-500 mt-0.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium">Quick nudge</div>
                  <div className="text-sm text-muted-foreground">
                    No check-in yet today. A 60-second check-in keeps your plan calibrated.
                  </div>
                  <div className="mt-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        if (!checkInWorkout) {
                          toast.error("No workout found", { description: "Plan a workout in Calendar first" });
                          return;
                        }
                        setShowCheckInModal(true);
                      }}
                    >
                      Open check-in
                    </Button>
                  </div>
                </div>
                <button
                  onClick={() => setDismissNoonNudge(true)}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              </CardContent>
            </Card>
          )}

          {nudges.showOverrideSignal && !dismissOverrideNudge && (
            <Card className="border-blue-500/30 bg-blue-500/10">
              <CardContent className="py-3 flex items-start gap-3">
                <Info className="h-4 w-4 text-blue-500 mt-0.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium">Pattern noticed</div>
                  <div className="text-sm text-muted-foreground">
                    You’ve overridden recommendations {nudges.overrideCount7d} times in the last 7 days.
                  </div>
                  <div className="mt-2">
                    <Link href="/calendar">
                      <Button size="sm" variant="outline">Review week</Button>
                    </Link>
                  </div>
                </div>
                <button
                  onClick={() => setDismissOverrideNudge(true)}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              </CardContent>
            </Card>
          )}

          {nudges.showPainSignal && !dismissPainNudge && (
            <Card className="border-red-500/30 bg-red-500/10">
              <CardContent className="py-3 flex items-start gap-3">
                <AlertTriangle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium">Body check</div>
                  <div className="text-sm text-muted-foreground">
                    You’ve logged moderate/severe discomfort {nudges.painCount7d} times in the last 7 days.
                  </div>
                  <div className="mt-2">
                    <Link href="/calendar">
                      <Button size="sm" variant="outline">See recent workouts</Button>
                    </Link>
                  </div>
                </div>
                <button
                  onClick={() => setDismissPainNudge(true)}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Quote of the Day */}
      <Card className="bg-gradient-to-r from-primary/5 via-transparent to-transparent border-primary/10">
        <CardContent className="py-5 px-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <blockquote className="text-lg font-medium text-foreground/90 leading-relaxed">
                &ldquo;{quote.text}&rdquo;
              </blockquote>
              <div className="mt-3 flex items-center gap-3">
                <p className="text-sm text-muted-foreground">— {quote.author}</p>
                <Badge 
                  variant="outline" 
                  className={`text-xs ${quote.categoryDisplay.color}`}
                >
                  {quote.categoryDisplay.label}
                </Badge>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Daily Insight */}
      {psychologyData?.insight && !insightDismissed && (
        <Card className="border-l-4 border-l-primary/60 bg-gradient-to-r from-primary/5 to-transparent">
          <CardContent className="py-3 flex items-start gap-3">
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

      <Dialog open={insightExplainOpen} onOpenChange={setInsightExplainOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Why is this insight?</DialogTitle>
            <DialogDescription>Sources and confidence (no raw diary text is shown).</DialogDescription>
          </DialogHeader>

          {insightExplainLoading && (
            <p className="text-sm text-muted-foreground">Loading…</p>
          )}

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
                          {s.type} • {s.date} • {s.id}
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

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <TooltipProvider>
          <UITooltip>
            <TooltipTrigger asChild>
              <Card className={`cursor-pointer transition-colors hover:border-primary/50 ${readinessBgColor}`}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Readiness</CardTitle>
                  <Battery className={`h-4 w-4 ${readinessColor}`} />
                </CardHeader>
                <CardContent>
                  <div className={`text-2xl font-bold ${readinessColor}`}>
                    {hasReadiness ? Math.round(readinessScore) : "—"}
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    {hasReadiness ? (
                      <Badge variant={readinessStatus === "OPTIMAL" ? "success" : readinessStatus === "CAUTION" ? "warning" : "danger"}>
                        {readinessStatus}
                      </Badge>
                    ) : (
                      <Badge variant="outline">No data yet</Badge>
                    )}
                    {fatigueType !== "NONE" && (
                      <Badge variant="outline" className={fatigueColor}>
                        {fatigueType}
                      </Badge>
                    )}
                  </div>
                </CardContent>
              </Card>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="max-w-xs">
              {!hasReadiness ? (
                <p className="text-xs text-muted-foreground">No data yet</p>
              ) : (
                <>
                  <p className="font-medium mb-1">Why this score?</p>
                  {readinessData?.factors?.slice(0, 3).map((f, i) => (
                    <p key={i} className="text-xs">
                      {f.description} ({f.impact > 0 ? "+" : ""}{f.impact})
                    </p>
                  )) || <p className="text-xs">No detailed factors available</p>}
                  {readinessData?.fatigueRecommendation && (
                    <p className="text-xs mt-2 text-muted-foreground italic">
                      {readinessData.fatigueRecommendation}
                    </p>
                  )}
                </>
              )}
            </TooltipContent>
          </UITooltip>
        </TooltipProvider>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Fitness (CTL)</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{Math.round(metrics.ctl)}</div>
            <p className="text-xs text-muted-foreground">
              42-day chronic training load
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Weekly Hours</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.weeklyHours}h</div>
            <p className="text-xs text-muted-foreground">
              {metrics.workoutsThisWeek} workouts this week
            </p>
          </CardContent>
        </Card>

        {/* Consistency Card */}
        {psychologyData?.compliance ? (
          <TooltipProvider>
            <UITooltip>
              <TooltipTrigger asChild>
                <Card className="cursor-pointer transition-colors hover:border-primary/50">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Consistency</CardTitle>
                    <Target className={`h-4 w-4 ${
                      psychologyData.compliance.status === "STRONG" ? "text-green-500" :
                      psychologyData.compliance.status === "SLIPPING" ? "text-yellow-500" : "text-red-500"
                    }`} />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{psychologyData.compliance.completionRate}%</div>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant={
                        psychologyData.compliance.status === "STRONG" ? "success" :
                        psychologyData.compliance.status === "SLIPPING" ? "warning" : "danger"
                      }>
                        {psychologyData.compliance.status}
                      </Badge>
                      {psychologyData.compliance.currentStreak > 0 && (
                        <span className="text-xs text-muted-foreground">
                          {psychologyData.compliance.currentStreak}d streak
                        </span>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="max-w-xs">
                <p className="font-medium mb-1">14-day completion</p>
                <p className="text-xs">
                  {psychologyData.compliance.completedWorkouts} of {psychologyData.compliance.plannedWorkouts} workouts completed
                </p>
                {psychologyData.compliance.nudge && (
                  <p className="text-xs mt-2 italic text-muted-foreground">
                    {psychologyData.compliance.nudge}
                  </p>
                )}
              </TooltipContent>
            </UITooltip>
          </TooltipProvider>
        ) : (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Weekly TSS</CardTitle>
              <Flame className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metrics.weeklyTSS}</div>
              <p className="text-xs text-muted-foreground">
                Training stress score
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Quick Actions */}
      <QuickActions />

      {/* Chart */}
      {metrics.chartData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Performance Metrics</CardTitle>
            <CardDescription>
              CTL (Fitness), ATL (Fatigue), and TSB (Form) over the last 30 days
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={metrics.chartData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 12 }}
                    tickFormatter={(value) => {
                      const date = new Date(value);
                      return `${date.getMonth() + 1}/${date.getDate()}`;
                    }}
                    className="text-muted-foreground"
                  />
                  <YAxis tick={{ fontSize: 12 }} className="text-muted-foreground" />
                  <ChartTooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      borderColor: "hsl(var(--border))",
                      borderRadius: "8px",
                    }}
                  />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="ctl"
                    name="CTL (Fitness)"
                    stroke="hsl(var(--chart-1))"
                    strokeWidth={2}
                    dot={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="atl"
                    name="ATL (Fatigue)"
                    stroke="hsl(var(--chart-2))"
                    strokeWidth={2}
                    dot={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="tsb"
                    name="TSB (Form)"
                    stroke="hsl(var(--chart-3))"
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Workouts Grid */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Upcoming Workouts */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Upcoming Workouts</CardTitle>
              <CardDescription>Your planned training sessions</CardDescription>
            </div>
            <Link href="/calendar">
              <Button variant="ghost" size="sm">
                View All
                <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            {upcomingWorkouts.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No upcoming workouts planned.{" "}
                <Link href="/calendar" className="text-primary hover:underline">
                  Plan one now
                </Link>
              </p>
            ) : (
              <div className="space-y-3">
                {upcomingWorkouts.map((workout) => (
                  <div
                    key={workout.id}
                    className="flex items-center gap-3 rounded-lg border p-3"
                  >
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
                      <Activity className="h-4 w-4 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{workout.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(workout.date)} • {workout.type}
                      </p>
                    </div>
                    {workout.durationMin && (
                      <span className="text-sm text-muted-foreground">
                        {workout.durationMin}min
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Workouts */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Recent Activity</CardTitle>
              <CardDescription>Your completed workouts</CardDescription>
            </div>
            <Link href="/calendar">
              <Button variant="ghost" size="sm">
                View All
                <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            {recentWorkouts.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No completed workouts yet.
              </p>
            ) : (
              <div className="space-y-3">
                {recentWorkouts.map((workout) => (
                  <div
                    key={workout.id}
                    className="flex items-center gap-3 rounded-lg border p-3"
                  >
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-green-500/10">
                      <Zap className="h-4 w-4 text-green-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{workout.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(workout.date)} • {workout.type}
                      </p>
                    </div>
                    {workout.tss && (
                      <span className="text-sm text-muted-foreground">
                        TSS {workout.tss}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Risk Assessment Card */}
      {riskData && (
        <Card className={riskData.rampStatus === "DANGER" ? "border-red-500/50" : riskData.rampStatus === "WARNING" ? "border-yellow-500/50" : ""}>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <ShieldAlert className="h-5 w-5" />
                Training Load Safety
              </CardTitle>
              <CardDescription>Weekly load ramp rate and guardrails</CardDescription>
            </div>
            {riskData.rampStatus !== "SAFE" && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleApplyDeload}
                disabled={isApplyingDeload}
              >
                {isApplyingDeload ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Applying...
                  </>
                ) : (
                  "Apply Deload"
                )}
              </Button>
            )}
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <p className="text-sm text-muted-foreground">Ramp Rate</p>
                <p className={`text-2xl font-bold ${rampColor}`}>
                  {riskData.rampRate > 0 ? "+" : ""}{riskData.rampRate.toFixed(1)}%
                </p>
                <Badge variant={riskData.rampStatus === "SAFE" ? "success" : riskData.rampStatus === "WARNING" ? "warning" : "danger"}>
                  {riskData.rampStatus}
                </Badge>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">This Week Load</p>
                <p className="text-2xl font-bold">{riskData.weeklyLoad}</p>
                <p className="text-xs text-muted-foreground">vs {riskData.previousWeekLoad} last week</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Risk Score</p>
                <p className="text-2xl font-bold">{riskData.riskScore}/100</p>
                <p className="text-xs text-muted-foreground">
                  {riskData.riskScore < 20 ? "Low risk" : riskData.riskScore < 50 ? "Moderate" : "High risk"}
                </p>
              </div>
            </div>
            {riskData.warnings.length > 0 && (
              <div className="mt-4 space-y-2">
                {riskData.warnings.map((w, i) => (
                  <div key={i} className="flex items-start gap-2 text-sm">
                    <AlertTriangle className={`h-4 w-4 mt-0.5 ${w.severity === "high" ? "text-red-500" : w.severity === "medium" ? "text-yellow-500" : "text-muted-foreground"}`} />
                    <span>{w.message}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Readiness Trend Mini Chart */}
      {readinessTrend && readinessTrend.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Brain className="h-5 w-5" />
              Readiness Trend (14 days)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[150px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={readinessTrend}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 10 }}
                    tickFormatter={(value) => {
                      const d = new Date(value);
                      return `${d.getMonth() + 1}/${d.getDate()}`;
                    }}
                  />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} />
                  <ChartTooltip />
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
            </div>
          </CardContent>
        </Card>
      )}

      {/* What-If Simulator Quick Card */}
      {null}

      {/* Daily Check-In Modal */}
      {checkInWorkout && (
        <DailyCheckInModal
          open={showCheckInModal}
          onOpenChange={setShowCheckInModal}
          workout={checkInWorkout}
          onComplete={() => {
            setShowCheckInModal(false);
          }}
        />
      )}

      {/* Workout Adapted Badge */}
      {todayCheckIn && todayCheckIn.aiDecision && todayCheckIn.aiDecision !== "PROCEED" && todayCheckIn.userAccepted && (
        <div className="fixed bottom-4 right-4 z-50">
          <Card className="bg-blue-500/10 border-blue-500/30">
            <CardContent className="p-3 flex items-center gap-2">
              <Brain className="h-4 w-4 text-blue-500" />
              <span className="text-sm">Workout adapted based on your check-in</span>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Workout Feedback Modal */}
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
    </div>
  );
}
