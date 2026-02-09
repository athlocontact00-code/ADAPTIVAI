"use client";

/**
 * PROGRESS TAB – PRO/PREMIUM UPGRADE (PR-style self-review)
 * =========================================================
 * 1) Trends: New ProgressTrendsCard between KPI and Weekly/Monthly story.
 *    - Performance chart (CTL/ATL/TSB) with 30d/90d toggle
 *    - Weekly Load (TSS + Hours) bar chart
 *    - Readiness 14d line chart
 *    - Discipline split pills (Run/Bike/Swim/Strength)
 *    - Empty state + CTA "Add workouts" when no data
 *
 * 2) KPI cards: Extended tooltips with "how it's computed". Delta + sparkline already present.
 *
 * 3) Weekly/Monthly story: Short version (line-clamp-4) + "Expand insight" button.
 *    Based on / Why moved to Collapsible accordion. Confidence as Badge + tooltip "why confidence".
 *
 * 4) Timeline: 2-col layout (list left, sticky Details panel right). Click event to select.
 *    Micro-indicator (bar) for volume/impact per event. Discipline filter (All/Run/Bike/Swim/Strength).
 *    Sort: Newest / Highest impact. Filters disabled with tooltip when no PBs.
 *
 * 5) Next Race: "From Season: {seasonName}" + link when race has season. Add race → /season.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  TrendingUp,
  Trophy,
  AlertTriangle,
  FileText,
  Plus,
  Loader2,
  Calendar,
  Layers,
  Flag,
  Activity,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  createPersonalBest,
  createInjury,
  generateWeeklyReportAction,
  generateMonthlyReportAction,
} from "@/lib/actions/progress";
import type { DeterministicProgressNarratives } from "@/lib/actions/progress-narratives";
import {
  formatPBValue,
  getSportColor,
  getDisciplinesForSport,
  type InjuryData,
  type PersonalBestData,
  type PBSport,
} from "@/lib/services/progress.service";
import { buildTimelineEvents } from "@/lib/services/progress.service";
import type { TimelineEvent } from "@/lib/services/progress.service";
import { formatPercent } from "@/lib/utils/format";
import { formatLocalDateInput } from "@/lib/utils";
import { MetricCard } from "@/components/ui-extensions";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import { ProgressTrendsCard } from "@/components/progress/progress-trends-card";
import type { ProgressTrendsData } from "@/lib/actions/progress";

interface PersonalBest {
  id: string;
  sport: string;
  discipline: string;
  valueNumber: number;
  valueUnit: string;
  date: Date;
  notes: string | null;
  source: string;
}

interface Report {
  id: string;
  type: string;
  periodStart: Date;
  periodEnd: Date;
  title: string;
  summaryMd: string;
  metricsJson: string | null;
}

interface TimelineData {
  blocks: Array<{ id: string; type: string; startDate: Date; endDate: Date; focus: string | null }>;
  races: Array<{ id: string; name: string; date: Date; priority: string; season?: { id: string; name: string } | null }>;
  injuries: InjuryData[];
  pbs: PersonalBestData[];
  peakWeeks: { date: Date; tss: number }[];
}

interface Summary {
  ctl: number | null;
  atl: number | null;
  tsb: number | null;
  readiness: number | null;
  compliance: number;
  burnoutRisk: number;
  readinessTrend: { date: string; value: number }[];
  complianceTrend: { date: string; value: number }[];
  ctlTrend?: number[];
  deltaCtl?: number | null;
  deltaReadiness?: number | null;
  deltaCompliance?: number | null;
  currentBlock: { type: string; focus: string | null } | null;
  activeSeasonName?: string | null;
  upcomingRaces: { name: string; date: Date; priority: string; daysUntil: number; seasonId?: string | null; seasonName?: string | null }[];
}

interface ProgressClientProps {
  personalBests: PersonalBest[];
  injuries: InjuryData[];
  weeklyReports: Report[];
  monthlyReports: Report[];
  timelineData: TimelineData;
  summary: Summary | null;
  narratives?: DeterministicProgressNarratives | null;
  trends?: ProgressTrendsData | null;
}

export function ProgressClient({
  personalBests,
  injuries,
  weeklyReports,
  monthlyReports,
  timelineData,
  summary,
  narratives,
  trends = null,
}: ProgressClientProps) {
  const router = useRouter();
  const [showPBDialog, setShowPBDialog] = useState(false);
  const [showInjuryDialog, setShowInjuryDialog] = useState(false);
  const [showReportDialog, setShowReportDialog] = useState(false);
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);
  const [isCreatingPB, setIsCreatingPB] = useState(false);
  const [isCreatingInjury, setIsCreatingInjury] = useState(false);
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const [timelineFilters, setTimelineFilters] = useState({
    blocks: true,
    races: true,
    injuries: true,
    pbs: true,
    peakWeeks: false,
  });
  const [timelineSearch, setTimelineSearch] = useState("");
  const [timelineRange, setTimelineRange] = useState<"7" | "30" | "90" | "season">("90");
  const [selectedTimelineEvent, setSelectedTimelineEvent] = useState<TimelineEvent | null>(null);
  const [timelineDiscipline, setTimelineDiscipline] = useState<string>("all");
  const [timelineSort, setTimelineSort] = useState<"newest" | "impact" | "compliance">("newest");
  const [weeklyStoryExpanded, setWeeklyStoryExpanded] = useState(false);
  const [monthlyStoryExpanded, setMonthlyStoryExpanded] = useState(false);

  const [pbForm, setPbForm] = useState({
    sport: "RUN",
    discipline: "",
    valueNumber: "",
    valueUnit: "s",
    date: formatLocalDateInput(new Date()),
    notes: "",
    source: "MANUAL",
  });

  const [injuryForm, setInjuryForm] = useState({
    startDate: formatLocalDateInput(new Date()),
    endDate: "",
    area: "",
    severity: "LOW",
    status: "ACTIVE",
    notes: "",
  });

  const disciplines = getDisciplinesForSport(pbForm.sport as PBSport);

  async function handleCreatePB() {
    if (!pbForm.discipline || !pbForm.valueNumber) {
      toast.error("Please fill in required fields");
      return;
    }

    setIsCreatingPB(true);
    try {
      const result = await createPersonalBest({
        ...pbForm,
        valueNumber: parseFloat(pbForm.valueNumber),
      });
      if (result.success) {
        toast.success("Personal best recorded!");
        setShowPBDialog(false);
        setPbForm({
          sport: "RUN",
          discipline: "",
          valueNumber: "",
          valueUnit: "s",
          date: formatLocalDateInput(new Date()),
          notes: "",
          source: "MANUAL",
        });
        router.refresh();
      } else {
        toast.error(result.error || "Failed to record PB");
      }
    } catch {
      toast.error("Something went wrong");
    } finally {
      setIsCreatingPB(false);
    }
  }

  async function handleCreateInjury() {
    if (!injuryForm.area) {
      toast.error("Please specify the injury area");
      return;
    }

    setIsCreatingInjury(true);
    try {
      const result = await createInjury(injuryForm);
      if (result.success) {
        toast.success("Injury logged");
        setShowInjuryDialog(false);
        setInjuryForm({
          startDate: formatLocalDateInput(new Date()),
          endDate: "",
          area: "",
          severity: "LOW",
          status: "ACTIVE",
          notes: "",
        });
        router.refresh();
      } else {
        toast.error(result.error || "Failed to log injury");
      }
    } catch {
      toast.error("Something went wrong");
    } finally {
      setIsCreatingInjury(false);
    }
  }

  async function handleGenerateReport(type: "weekly" | "monthly") {
    setIsGeneratingReport(true);
    try {
      const result = type === "weekly"
        ? await generateWeeklyReportAction()
        : await generateMonthlyReportAction();
      
      if (result.success) {
        toast.success(result.message || "Report generated!");
        router.refresh();
      } else {
        toast.error(result.error || "Failed to generate report");
      }
    } catch {
      toast.error("Something went wrong");
    } finally {
      setIsGeneratingReport(false);
    }
  }

  // Build timeline events
  const rawTimelineEvents = buildTimelineEvents(
    timelineFilters.blocks ? timelineData.blocks : [],
    timelineFilters.races ? timelineData.races : [],
    timelineFilters.injuries ? injuries : [],
    timelineFilters.pbs ? timelineData.pbs : [],
    timelineFilters.peakWeeks ? timelineData.peakWeeks : []
  );

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const rangeStart = (() => {
    if (timelineRange === "7") return new Date(today);
    if (timelineRange === "30") return new Date(today);
    if (timelineRange === "90") return new Date(today);
    return null;
  })();
  if (rangeStart) {
    if (timelineRange === "7") rangeStart.setDate(rangeStart.getDate() - 7);
    else if (timelineRange === "30") rangeStart.setDate(rangeStart.getDate() - 30);
    else if (timelineRange === "90") rangeStart.setDate(rangeStart.getDate() - 90);
  }

  const timelineEventsFiltered = rawTimelineEvents.filter((event) => {
    const d = new Date(event.date);
    if (timelineRange !== "season" && rangeStart && d < rangeStart) return false;
    if (timelineSearch.trim()) {
      const q = timelineSearch.toLowerCase();
      return event.title.toLowerCase().includes(q) || (event.subtitle?.toLowerCase().includes(q) ?? false);
    }
    if (timelineDiscipline !== "all" && event.type === "pb" && event.discipline !== timelineDiscipline) return false;
    return true;
  });

  const timelineEvents = [...timelineEventsFiltered].sort((a, b) => {
    if (timelineSort === "newest") return b.date.getTime() - a.date.getTime();
    if (timelineSort === "impact") return (b.indicatorPct ?? 0) - (a.indicatorPct ?? 0);
    return b.date.getTime() - a.date.getTime();
  });

  const TIMELINE_COLOR_CLASS: Record<string, string> = {
    blue: "bg-blue-500/20 text-blue-500",
    orange: "bg-orange-500/20 text-orange-500",
    red: "bg-red-500/20 text-red-500",
    green: "bg-emerald-500/20 text-emerald-500",
    yellow: "bg-amber-500/20 text-amber-500",
    purple: "bg-violet-500/20 text-violet-500",
    gray: "bg-muted-foreground/20 text-muted-foreground",
  };

  // Group PBs by sport
  const pbsBySport = personalBests.reduce((acc, pb) => {
    if (!acc[pb.sport]) acc[pb.sport] = [];
    acc[pb.sport].push(pb);
    return acc;
  }, {} as Record<string, PersonalBest[]>);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
            <TrendingUp className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Progress</h1>
            <p className="text-sm text-muted-foreground">
              Track your journey, PBs, and training story
            </p>
          </div>
        </div>
      </div>

      {/* KPI Top Row — live metrics */}
      {!summary ? (
        <Card className="border-dashed border-border/50">
          <CardContent className="py-8 text-center">
            <p className="text-sm text-muted-foreground">Not enough data yet</p>
            <p className="text-xs text-muted-foreground/70 mt-1">Complete check-ins and log workouts to see your progress metrics</p>
            <Button variant="outline" size="sm" className="mt-4" onClick={() => router.push("/today")}>
              Go to Today
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-4">
          <MetricCard
            title="Fitness (CTL)"
            value={summary.ctl != null && Number.isFinite(summary.ctl) ? Math.round(summary.ctl) : "—"}
            hint={
              summary.ctl == null
                ? "No data yet — complete workouts with TSS to see CTL."
                : summary.currentBlock
                  ? `${summary.currentBlock.type} block`
                  : "14-day trend"
            }
            tooltip="Chronic Training Load. Rolling 42-day average of daily TSS. How computed: exponential moving average (42d decay) of daily TSS from completed workouts."
            delta={summary.deltaCtl ?? undefined}
            deltaLabel={summary.deltaCtl != null ? "vs prev 14d" : undefined}
            sparkline={summary.ctlTrend && summary.ctlTrend.length >= 2 ? summary.ctlTrend : undefined}
            tone={summary.ctl == null ? "neutral" : summary.ctl >= 50 ? "success" : summary.ctl >= 30 ? "info" : "neutral"}
            density="compact"
            className="border-border/50"
          />
          <MetricCard
            title="Readiness"
            value={summary.readiness != null && Number.isFinite(summary.readiness) ? summary.readiness : "—"}
            hint={summary.readiness == null ? "No data yet — log check-ins to see readiness." : "7-day trend"}
            tooltip="Daily readiness score from check-ins. 0–100. How computed: weighted combination of sleep, fatigue, motivation, soreness, stress from your daily check-in."
            delta={summary.deltaReadiness ?? undefined}
            deltaLabel={summary.deltaReadiness != null ? "vs prev 14d" : undefined}
            sparkline={summary.readinessTrend.length >= 2 ? summary.readinessTrend.map((t) => t.value) : undefined}
            tone={summary.readiness == null ? "neutral" : summary.readiness >= 70 ? "success" : summary.readiness >= 45 ? "warning" : "danger"}
            density="compact"
            className="border-border/50"
          />
          <MetricCard
            title="Compliance"
            value={formatPercent(summary.compliance)}
            hint="14-day completion"
            tooltip="% of planned workouts completed in last 14 days. How computed: (completed planned workouts / total planned workouts) × 100 over rolling 14 days."
            delta={summary.deltaCompliance ?? undefined}
            deltaLabel={summary.deltaCompliance != null ? "vs prev 14d" : undefined}
            sparkline={summary.complianceTrend.length >= 2 ? summary.complianceTrend.map((t) => t.value) : undefined}
            tone={summary.compliance >= 80 ? "success" : summary.compliance >= 60 ? "warning" : "danger"}
            density="compact"
            className="border-border/50"
          />
          {summary.upcomingRaces.length > 0 ? (
            <Card className="border-border/50 overflow-hidden">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Next Race</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold tabular-nums">{summary.upcomingRaces[0].daysUntil}d</div>
                <p className="text-xs text-muted-foreground mt-1 truncate">
                  {summary.upcomingRaces[0].name}
                </p>
                <p className="text-[10px] text-muted-foreground/70 mt-0.5">
                  {summary.upcomingRaces[0].priority} priority
                </p>
                {(summary.upcomingRaces[0].seasonName || summary.activeSeasonName) && (
                  <p className="text-[10px] text-muted-foreground/70 mt-1">
                    From Season:{" "}
                    <button
                      type="button"
                      onClick={() => router.push("/season")}
                      className="underline hover:text-foreground focus:outline-none focus:ring-1 focus:ring-primary rounded"
                    >
                      {summary.upcomingRaces[0].seasonName ?? summary.activeSeasonName ?? "Season"}
                    </button>
                  </p>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-3 h-7 text-xs"
                  onClick={() => router.push("/season")}
                >
                  View in Season
                </Button>
              </CardContent>
            </Card>
          ) : (
            <Card className="border-dashed border-border/50 overflow-hidden">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Next Race</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">No races scheduled</p>
                <p className="text-[11px] text-muted-foreground/70 mt-1">Add a race milestone in Season</p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-3 h-7 text-xs"
                  onClick={() => router.push("/season")}
                >
                  Add race
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Trends: placed between KPI and story for natural data → insight flow */}
      <ProgressTrendsCard trends={trends ?? null} />

      {/* Deterministic narratives (no LLM) */}
      {narratives && (
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Weekly story</CardTitle>
              <CardDescription>Based on compliance, load, readiness</CardDescription>
            </CardHeader>
            <CardContent className="text-sm space-y-3">
              <div className="font-medium">{narratives.weekly.headline}</div>
              <div className="text-muted-foreground line-clamp-4">{narratives.weekly.loadVsPlan} {narratives.weekly.keyInsight} {narratives.weekly.quote ? `"${narratives.weekly.quote}" ` : ""}{narratives.weekly.recommendation}</div>
              {!weeklyStoryExpanded && (
                <Button variant="ghost" size="sm" className="h-7 text-xs -ml-2" onClick={() => setWeeklyStoryExpanded(true)}>
                  Expand insight <ChevronDown className="ml-1 h-3 w-3" />
                </Button>
              )}
              {weeklyStoryExpanded && (
                <>
              {narratives.weekly.quote && (
                <div className="text-muted-foreground italic">“{narratives.weekly.quote}”</div>
              )}
              <div className="text-muted-foreground">{narratives.weekly.recommendation}</div>
              <Collapsible>
                    <CollapsibleTrigger asChild>
                      <button type="button" className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground flex items-center gap-1 hover:text-foreground focus:outline-none focus:ring-1 focus:ring-primary rounded" aria-expanded="false">
                        Based on <ChevronDown className="h-3 w-3" />
                      </button>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <ul className="text-xs text-muted-foreground space-y-0.5 mt-1">
                        {narratives.weekly.basedOn?.slice(0, 4).map((b, i) => (
                          <li key={i}>• {b}</li>
                        ))}
                      </ul>
                    </CollapsibleContent>
                  </Collapsible>
                  <Collapsible>
                    <CollapsibleTrigger asChild>
                      <button type="button" className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground flex items-center gap-1 hover:text-foreground focus:outline-none focus:ring-1 focus:ring-primary rounded" aria-expanded="false">
                        Why <ChevronDown className="h-3 w-3" />
                      </button>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <p className="text-xs text-muted-foreground mt-1">{narratives.weekly.why}</p>
                    </CollapsibleContent>
                  </Collapsible>
                  <div className="flex items-center gap-2 pt-1">
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Badge variant="outline" className={`h-5 px-2 text-[10px] ${
                            narratives.weekly.confidence === "HIGH" ? "border-emerald-500/50 text-emerald-500" :
                            narratives.weekly.confidence === "MED" ? "border-amber-500/50 text-amber-500" : "border-muted-foreground/50"
                          }`}>
                            {narratives.weekly.confidence} confidence
                          </Badge>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="max-w-[200px] text-xs">
                          Confidence reflects data quality: more workouts and check-ins = higher confidence.
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                  <Button variant="ghost" size="sm" className="h-7 text-xs -ml-2" onClick={() => setWeeklyStoryExpanded(false)}>
                    Collapse <ChevronUp className="ml-1 h-3 w-3" />
                  </Button>
                </>
              )}
              <div className="flex gap-2 pt-2">
                <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => router.push("/calendar")}>
                  Plan next week
                </Button>
                <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => router.push("/coach?prefill=" + encodeURIComponent("Explain this weekly story and propose adjustments"))}>
                  Ask AI coach
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Monthly story</CardTitle>
              <CardDescription>Based on compliance, load, readiness</CardDescription>
            </CardHeader>
            <CardContent className="text-sm space-y-3">
              <div className="font-medium">{narratives.monthly.headline}</div>
              <div className="text-muted-foreground line-clamp-4">{narratives.monthly.trend} {narratives.monthly.behavioralPattern} {narratives.monthly.highlight} {narratives.monthly.quote ? `"${narratives.monthly.quote}" ` : ""}{narratives.monthly.watchOut ?? ""}</div>
              {!monthlyStoryExpanded && (
                <Button variant="ghost" size="sm" className="h-7 text-xs -ml-2" onClick={() => setMonthlyStoryExpanded(true)}>
                  Expand insight <ChevronDown className="ml-1 h-3 w-3" />
                </Button>
              )}
              {monthlyStoryExpanded && (
                <>
              {narratives.monthly.quote && (
                <div className="text-muted-foreground italic">“{narratives.monthly.quote}”</div>
              )}
              {narratives.monthly.watchOut && (
                <div className="text-muted-foreground">{narratives.monthly.watchOut}</div>
              )}
              <Collapsible>
                    <CollapsibleTrigger asChild>
                      <button type="button" className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground flex items-center gap-1 hover:text-foreground focus:outline-none focus:ring-1 focus:ring-primary rounded" aria-expanded="false">
                        Based on <ChevronDown className="h-3 w-3" />
                      </button>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <ul className="text-xs text-muted-foreground space-y-0.5 mt-1">
                        {narratives.monthly.basedOn?.slice(0, 4).map((b, i) => (
                          <li key={i}>• {b}</li>
                        ))}
                      </ul>
                    </CollapsibleContent>
                  </Collapsible>
                  <Collapsible>
                    <CollapsibleTrigger asChild>
                      <button type="button" className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground flex items-center gap-1 hover:text-foreground focus:outline-none focus:ring-1 focus:ring-primary rounded" aria-expanded="false">
                        Why <ChevronDown className="h-3 w-3" />
                      </button>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <p className="text-xs text-muted-foreground mt-1">{narratives.monthly.why}</p>
                    </CollapsibleContent>
                  </Collapsible>
                  <div className="flex items-center gap-2 pt-1">
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Badge variant="outline" className={`h-5 px-2 text-[10px] ${
                            narratives.monthly.confidence === "HIGH" ? "border-emerald-500/50 text-emerald-500" :
                            narratives.monthly.confidence === "MED" ? "border-amber-500/50 text-amber-500" : "border-muted-foreground/50"
                          }`}>
                            {narratives.monthly.confidence} confidence
                          </Badge>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="max-w-[200px] text-xs">
                          Confidence reflects data quality: more workouts and check-ins = higher confidence.
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                  <Button variant="ghost" size="sm" className="h-7 text-xs -ml-2" onClick={() => setMonthlyStoryExpanded(false)}>
                    Collapse <ChevronUp className="ml-1 h-3 w-3" />
                  </Button>
                </>
              )}
              <div className="flex gap-2 pt-2">
                <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => router.push("/calendar")}>
                  Plan next week
                </Button>
                <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => router.push("/coach?prefill=" + encodeURIComponent("Explain this monthly story and propose adjustments"))}>
                  Ask AI coach
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Main Content Tabs */}
      <Tabs defaultValue="timeline" className="space-y-4">
        <TabsList>
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
          <TabsTrigger value="pbs">Personal Bests</TabsTrigger>
          <TabsTrigger value="reports">Reports</TabsTrigger>
        </TabsList>

        {/* Timeline Tab */}
        <TabsContent value="timeline" className="space-y-4">
          <Card className="border-border/50 overflow-hidden">
            <CardHeader>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <CardTitle>Training Timeline</CardTitle>
                  <CardDescription>Your training story over time</CardDescription>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Input
                    placeholder="Search…"
                    value={timelineSearch}
                    onChange={(e) => setTimelineSearch(e.target.value)}
                    className="h-8 w-32 text-sm"
                  />
                  <div className="flex rounded-md border border-border/50 overflow-hidden">
                    {(["7", "30", "90", "season"] as const).map((r) => (
                      <button
                        key={r}
                        type="button"
                        onClick={() => setTimelineRange(r)}
                        className={`px-2.5 py-1.5 text-xs font-medium transition-colors ${
                          timelineRange === r
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted/30 text-muted-foreground hover:bg-muted/50"
                        }`}
                      >
                        {r === "season" ? "Season" : `${r}d`}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap gap-2 pt-2">
                {Object.entries(timelineFilters).map(([key, value]) => (
                  <Button
                    key={key}
                    variant={value ? "default" : "outline"}
                    size="sm"
                    onClick={() => setTimelineFilters({ ...timelineFilters, [key]: !value })}
                  >
                    {key === "pbs" ? "PBs" : key.charAt(0).toUpperCase() + key.slice(1)}
                  </Button>
                ))}
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="inline-flex gap-1 border border-border/50 rounded-md overflow-hidden">
                        <select
                          value={timelineDiscipline}
                          onChange={(e) => setTimelineDiscipline(e.target.value)}
                          disabled={timelineEventsFiltered.filter((e) => e.type === "pb").length === 0}
                          className="bg-muted/30 text-muted-foreground text-xs px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed"
                          aria-label="Filter by discipline"
                        >
                          <option value="all">All</option>
                          <option value="RUN">Run</option>
                          <option value="BIKE">Bike</option>
                          <option value="SWIM">Swim</option>
                          <option value="STRENGTH">Strength</option>
                        </select>
                        <select
                          value={timelineSort}
                          onChange={(e) => setTimelineSort(e.target.value as "newest" | "impact")}
                          className="bg-muted/30 text-muted-foreground text-xs px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary"
                          aria-label="Sort"
                        >
                          <option value="newest">Newest</option>
                          <option value="impact">Highest impact</option>
                        </select>
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>
                      {timelineEventsFiltered.filter((e) => e.type === "pb").length === 0
                        ? "Add PBs to filter by discipline"
                        : "Filter and sort timeline"}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            </CardHeader>
            <CardContent>
              {timelineEvents.length === 0 ? (
                <div className="py-12 text-center rounded-lg border border-dashed border-border/50 bg-muted/5">
                  <p className="text-sm text-muted-foreground">No events to display</p>
                  <p className="text-xs text-muted-foreground/70 mt-1">
                    Add seasons, races, or PBs to see your timeline
                  </p>
                  <div className="flex gap-2 justify-center mt-4">
                    <Button variant="outline" size="sm" onClick={() => router.push("/season")}>
                      Add race
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => setShowPBDialog(true)}>
                      Add PB
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-[1fr_240px] gap-6">
                  <div className="relative min-w-0">
                    <div className="absolute left-5 top-0 bottom-0 w-px bg-border/50" aria-hidden />
                    <div className="space-y-4">
                      {timelineEvents.slice(0, 50).map((event) => {
                        const colorClass = TIMELINE_COLOR_CLASS[event.color] ?? TIMELINE_COLOR_CLASS.gray;
                        const isSelected = selectedTimelineEvent?.id === event.id;
                        return (
                          <button
                            key={event.id}
                            type="button"
                            onClick={() => setSelectedTimelineEvent(isSelected ? null : event)}
                            className={`w-full flex gap-4 items-start relative text-left rounded-lg p-2 -m-2 transition-colors focus:outline-none focus:ring-1 focus:ring-primary ${
                              isSelected ? "bg-muted/50" : "hover:bg-muted/30"
                            }`}
                            aria-pressed={isSelected}
                            aria-label={`View details for ${event.title}`}
                          >
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 relative z-10 ${colorClass}`}>
                              {event.type === "block" && <Layers className="h-5 w-5" />}
                              {event.type === "race" && <Flag className="h-5 w-5" />}
                              {event.type === "injury" && <AlertTriangle className="h-5 w-5" />}
                              {event.type === "pb" && <Trophy className="h-5 w-5" />}
                              {event.type === "peak_week" && <TrendingUp className="h-5 w-5" />}
                            </div>
                            <div className="flex-1 min-w-0 pb-2">
                              <p className="font-medium">{event.title}</p>
                              {event.subtitle && (
                                <p className="text-sm text-muted-foreground">{event.subtitle}</p>
                              )}
                              <p className="text-xs text-muted-foreground/70 mt-1">
                                {new Date(event.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                                {event.endDate && ` – ${new Date(event.endDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`}
                              </p>
                              {event.indicatorPct != null && event.indicatorPct > 0 && (
                                <div className="mt-1.5 h-1 w-16 rounded-full bg-muted/50 overflow-hidden" title="Impact/volume">
                                  <div
                                    className="h-full rounded-full bg-primary/60"
                                    style={{ width: `${event.indicatorPct}%` }}
                                  />
                                </div>
                              )}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                    {timelineEvents.length > 50 && (
                      <p className="text-xs text-muted-foreground/70 mt-2">Showing 50 of {timelineEvents.length} events</p>
                    )}
                  </div>
                  <div className="lg:sticky lg:top-4 lg:self-start rounded-lg border border-border/50 bg-muted/10 p-4 min-h-[120px]">
                    {selectedTimelineEvent ? (
                      <div className="space-y-3">
                        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Details</p>
                        <p className="font-medium">{selectedTimelineEvent.title}</p>
                        {selectedTimelineEvent.subtitle && (
                          <p className="text-sm text-muted-foreground">{selectedTimelineEvent.subtitle}</p>
                        )}
                        <p className="text-xs text-muted-foreground/70">
                          {new Date(selectedTimelineEvent.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                          {selectedTimelineEvent.endDate && ` – ${new Date(selectedTimelineEvent.endDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`}
                        </p>
                        {selectedTimelineEvent.type === "race" && selectedTimelineEvent.seasonName && (
                          <button
                            type="button"
                            onClick={() => router.push("/season")}
                            className="text-xs text-primary hover:underline focus:outline-none focus:ring-1 focus:ring-primary rounded"
                          >
                            From Season: {selectedTimelineEvent.seasonName}
                          </button>
                        )}
                        {selectedTimelineEvent.type === "pb" && selectedTimelineEvent.discipline && (
                          <p className="text-xs text-muted-foreground">{selectedTimelineEvent.discipline}</p>
                        )}
                        <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setSelectedTimelineEvent(null)}>
                          Clear selection
                        </Button>
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground/70">Select an event to view details</p>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Personal Bests Tab */}
        <TabsContent value="pbs" className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-medium">Personal Bests</h3>
            <Button onClick={() => setShowPBDialog(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Add PB
            </Button>
          </div>

          {personalBests.length === 0 ? (
            <Card className="border-dashed border-border/50 overflow-hidden">
              <CardContent className="py-12 text-center">
                <Trophy className="mx-auto h-12 w-12 text-muted-foreground/60 mb-4" />
                <h3 className="text-lg font-medium mb-2">No Personal Bests Yet</h3>
                <p className="text-sm text-muted-foreground mb-2">Record your achievements to track progress over time</p>
                <p className="text-xs text-muted-foreground/70 mb-4">Add PBs in Settings / Profile or here</p>
                <Button onClick={() => setShowPBDialog(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Your First PB
                </Button>
              </CardContent>
            </Card>
          ) : (
          <div className="space-y-4">
            {Object.entries(pbsBySport).map(([sport, pbs]) => (
              <Card key={sport} className="border-border/50 overflow-hidden">
                <CardHeader className="py-3">
                  <CardTitle className={`flex items-center gap-2 text-base ${getSportColor(sport as PBSport)}`}>
                    <Activity className="h-4 w-4" />
                    {sport}
                  </CardTitle>
                </CardHeader>
                <CardContent className="py-2">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border/50">
                          <th className="text-left py-2 px-3 text-xs font-medium text-muted-foreground">Discipline</th>
                          <th className="text-right py-2 px-3 text-xs font-medium text-muted-foreground">Value</th>
                          <th className="text-left py-2 px-3 text-xs font-medium text-muted-foreground">Date</th>
                          <th className="text-left py-2 px-3 text-xs font-medium text-muted-foreground">Source</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pbs.map((pb) => (
                          <tr key={pb.id} className="border-b border-border/30 last:border-0 hover:bg-muted/30 transition-colors">
                            <td className="py-2.5 px-3 font-medium">{pb.discipline}</td>
                            <td className="py-2.5 px-3 text-right font-semibold tabular-nums">{formatPBValue(pb.valueNumber, pb.valueUnit, pb.discipline)}</td>
                            <td className="py-2.5 px-3 text-muted-foreground">
                              {new Date(pb.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                            </td>
                            <td className="py-2.5 px-3 text-muted-foreground text-xs">{pb.source}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
          )}
        </TabsContent>

        {/* Reports Tab */}
        <TabsContent value="reports" className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-medium">Training Reports</h3>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => handleGenerateReport("weekly")} disabled={isGeneratingReport}>
                {isGeneratingReport && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Generate Weekly
              </Button>
              <Button variant="outline" onClick={() => handleGenerateReport("monthly")} disabled={isGeneratingReport}>
                {isGeneratingReport && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Generate Monthly
              </Button>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {/* Weekly Reports */}
            <Card className="border-border/50 overflow-hidden">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Weekly Reports
                </CardTitle>
              </CardHeader>
              <CardContent>
                {weeklyReports.length === 0 ? (
                  <div className="py-8 text-center rounded-lg border border-dashed border-border/50 bg-muted/5">
                    <p className="text-sm text-muted-foreground">No weekly reports yet</p>
                    <Button variant="outline" size="sm" className="mt-3" onClick={() => handleGenerateReport("weekly")} disabled={isGeneratingReport}>
                      {isGeneratingReport && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Generate first report
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {weeklyReports.map((report) => (
                      <button
                        key={report.id}
                        onClick={() => {
                          setSelectedReport(report);
                          setShowReportDialog(true);
                        }}
                        className="w-full text-left p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                      >
                        <p className="font-medium">{report.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(report.periodStart).toLocaleDateString()} - {new Date(report.periodEnd).toLocaleDateString()}
                        </p>
                      </button>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Monthly Reports */}
            <Card className="border-border/50 overflow-hidden">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  Monthly Reports
                </CardTitle>
              </CardHeader>
              <CardContent>
                {monthlyReports.length === 0 ? (
                  <div className="py-8 text-center rounded-lg border border-dashed border-border/50 bg-muted/5">
                    <p className="text-sm text-muted-foreground">No monthly reports yet</p>
                    <Button variant="outline" size="sm" className="mt-3" onClick={() => handleGenerateReport("monthly")} disabled={isGeneratingReport}>
                      {isGeneratingReport && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Generate first report
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {monthlyReports.map((report) => (
                      <button
                        key={report.id}
                        onClick={() => {
                          setSelectedReport(report);
                          setShowReportDialog(true);
                        }}
                        className="w-full text-left p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                      >
                        <p className="font-medium">{report.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(report.periodStart).toLocaleDateString()} - {new Date(report.periodEnd).toLocaleDateString()}
                        </p>
                      </button>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Add PB Dialog */}
      <Dialog open={showPBDialog} onOpenChange={setShowPBDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record Personal Best</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Sport</Label>
                <Select
                  value={pbForm.sport}
                  onValueChange={(v) => {
                    setPbForm({ ...pbForm, sport: v, discipline: "" });
                  }}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="RUN">Running</SelectItem>
                    <SelectItem value="BIKE">Cycling</SelectItem>
                    <SelectItem value="SWIM">Swimming</SelectItem>
                    <SelectItem value="STRENGTH">Strength</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Discipline</Label>
                <Select
                  value={pbForm.discipline}
                  onValueChange={(v) => {
                    const disc = disciplines.find(d => d.name === v);
                    setPbForm({ ...pbForm, discipline: v, valueUnit: disc?.unit || "s" });
                  }}
                >
                  <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                  <SelectContent>
                    {disciplines.map((d) => (
                      <SelectItem key={d.name} value={d.name}>{d.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Value</Label>
                <Input
                  type="number"
                  step="0.01"
                  placeholder={pbForm.valueUnit === "s" ? "Seconds" : "Value"}
                  value={pbForm.valueNumber}
                  onChange={(e) => setPbForm({ ...pbForm, valueNumber: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Date</Label>
                <Input
                  type="date"
                  value={pbForm.date}
                  onChange={(e) => setPbForm({ ...pbForm, date: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Source</Label>
              <Select value={pbForm.source} onValueChange={(v) => setPbForm({ ...pbForm, source: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="MANUAL">Manual Entry</SelectItem>
                  <SelectItem value="WORKOUT">From Workout</SelectItem>
                  <SelectItem value="TEST">Fitness Test</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Notes (optional)</Label>
              <Input
                placeholder="e.g., Race conditions, how it felt"
                value={pbForm.notes}
                onChange={(e) => setPbForm({ ...pbForm, notes: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPBDialog(false)}>Cancel</Button>
            <Button onClick={handleCreatePB} disabled={isCreatingPB}>
              {isCreatingPB && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save PB
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Injury Dialog */}
      <Dialog open={showInjuryDialog} onOpenChange={setShowInjuryDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Log Injury</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Injury Area</Label>
              <Input
                placeholder="e.g., Left knee, Lower back"
                value={injuryForm.area}
                onChange={(e) => setInjuryForm({ ...injuryForm, area: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Start Date</Label>
                <Input
                  type="date"
                  value={injuryForm.startDate}
                  onChange={(e) => setInjuryForm({ ...injuryForm, startDate: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>End Date (if resolved)</Label>
                <Input
                  type="date"
                  value={injuryForm.endDate}
                  onChange={(e) => setInjuryForm({ ...injuryForm, endDate: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Severity</Label>
                <Select value={injuryForm.severity} onValueChange={(v) => setInjuryForm({ ...injuryForm, severity: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="LOW">Low - Minor discomfort</SelectItem>
                    <SelectItem value="MODERATE">Moderate - Limited training</SelectItem>
                    <SelectItem value="HIGH">High - No training</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={injuryForm.status} onValueChange={(v) => setInjuryForm({ ...injuryForm, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ACTIVE">Active</SelectItem>
                    <SelectItem value="RESOLVED">Resolved</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Notes (optional)</Label>
              <Input
                placeholder="e.g., Diagnosis, treatment plan"
                value={injuryForm.notes}
                onChange={(e) => setInjuryForm({ ...injuryForm, notes: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowInjuryDialog(false)}>Cancel</Button>
            <Button onClick={handleCreateInjury} disabled={isCreatingInjury}>
              {isCreatingInjury && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Log Injury
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Report Detail Dialog */}
      <Dialog open={showReportDialog} onOpenChange={setShowReportDialog}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedReport?.title}</DialogTitle>
          </DialogHeader>
          {selectedReport && (
            <>
              <div className="prose prose-sm dark:prose-invert max-w-none" id="report-content">
                <div dangerouslySetInnerHTML={{ __html: selectedReport.summaryMd.replace(/\n/g, "<br/>").replace(/##/g, "<h3>").replace(/###/g, "<h4>").replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>").replace(/- /g, "• ") }} />
              </div>
              <div className="flex justify-end pt-4 border-t border-border/50">
                <Button variant="outline" size="sm" onClick={() => window.print()}>
                  Export (Print)
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
