"use client";

import { memo, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Plus,
  ChevronLeft,
  ChevronRight,
  Activity,
  Bike,
  Dumbbell,
  Waves,
  Footprints,
  Moon,
  MoreHorizontal,
  Copy,
  Trash2,
  Edit,
  Check,
  Bot,
  Info,
  ClipboardCheck,
  AlertTriangle,
  MessageSquare,
  Play,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState, MetricCard, SectionHeader } from "@/components/ui-extensions";
import { formatHours, formatTSS, formatPercent } from "@/lib/utils/format";
import { cn, formatLocalDateInput } from "@/lib/utils";
import { addDays, startOfWeek, isSameDay } from "@/lib/utils";
import { DailyCheckInModal } from "@/components/daily-checkin-modal";
import { WorkoutFeedbackModal } from "@/components/workout-feedback-modal";
import { WorkoutPlanEditorModal } from "@/components/workout/workout-plan-editor-modal";
import { PlanRenderer, PlanTextRenderer } from "@/components/workout/plan-renderer";
import { convertPrescriptionV1ToStructured, parseWorkoutPlanJson } from "@/lib/plans/compat";
import { exportStructuredToText } from "@/lib/plans/format";
import { getPreTrainingGateStatus, lockCheckIn, skipPreTrainingCheck } from "@/lib/actions/daily-checkin";
import { trackEvent } from "@/lib/actions/analytics";
import { getCalendarMonthData } from "@/lib/actions/calendar";
import { getFeedbackForWorkout, type FeedbackData } from "@/lib/actions/workout-feedback";
import { decidePlanChangeProposal, getPendingProposalsForWorkout } from "@/lib/actions/plan-rigidity";
import {
  computeMonthlySummary,
  computeWeeklySummary,
  getMonthGrid,
  getWeekStartForDate,
  type CalendarCheckIn,
  type CalendarWorkout,
  type MonthlySummary,
  type WeeklySummary,
} from "@/lib/services/calendar-summary.service";

type Workout = {
  id: string;
  userId?: string;
  title: string;
  type: string;
  date: string | Date;
  planned: boolean;
  completed: boolean;
  durationMin?: number | null;
  distanceKm?: number | null;
  distanceM?: number | null;
  tss?: number | null;
  notes?: string | null;
  descriptionMd?: string | null;
  prescriptionJson?: string | null;
  aiGenerated?: boolean;
  aiReason?: string | null;
  aiConfidence?: number | null;
  source?: string | null;
  createdAt?: string | Date;
  updatedAt?: string | Date;
};

type WorkoutWithAI = Workout & {
  aiGenerated?: boolean;
  aiConfidence?: number | null;
  aiReason?: string | null;
};

type WorkoutWithDetails = Workout & {
  distanceM?: number | null;
  descriptionMd?: string | null;
  prescriptionJson?: string | null;
};

const workoutTypes = [
  { value: "run", label: "Run", icon: Footprints },
  { value: "bike", label: "Bike", icon: Bike },
  { value: "swim", label: "Swim", icon: Waves },
  { value: "strength", label: "Strength", icon: Dumbbell },
  { value: "rest", label: "Rest", icon: Moon },
  { value: "other", label: "Other", icon: Activity },
];

const quickAddTypes = workoutTypes.filter((t) =>
  ["run", "bike", "swim", "strength", "rest"].includes(t.value)
);

type WorkoutStatus = "planned" | "done" | "missed" | "skipped";

function getWorkoutTypeLabel(type: string): string {
  return workoutTypes.find((t) => t.value === type)?.label ?? "Other";
}

function formatDurationShort(value?: number | null): string | null {
  if (typeof value !== "number" || value <= 0) return null;
  if (value >= 60) {
    const hours = Math.floor(value / 60);
    const mins = value % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  }
  return `${value}m`;
}

function getReadinessTone(score: number | null): {
  dotClass: string;
  badge: "success" | "info" | "warning" | "danger" | "muted";
  label: string;
} {
  if (typeof score !== "number") {
    return { dotClass: "bg-muted-foreground/30", badge: "muted", label: "No readiness" };
  }
  if (score >= 75) return { dotClass: "bg-emerald-400", badge: "success", label: "High readiness" };
  if (score >= 60) return { dotClass: "bg-blue-400", badge: "info", label: "Good readiness" };
  if (score >= 40) return { dotClass: "bg-amber-400", badge: "warning", label: "Low readiness" };
  return { dotClass: "bg-red-400", badge: "danger", label: "Very low readiness" };
}

function getWorkoutStatus(workout: Workout, now = new Date()): WorkoutStatus {
  if (workout.completed) return "done";
  const day = new Date(workout.date);
  const isPast =
    day.setHours(23, 59, 59, 999) < new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0).getTime();
  if (workout.planned && isPast) return "missed";
  if (!workout.planned && !workout.completed) return "skipped";
  return "planned";
}

function getCompactWorkoutLine(workout: Workout): string {
  const parts: string[] = [getWorkoutTypeLabel(workout.type)];
  const duration = formatDurationShort(workout.durationMin);
  if (duration) parts.push(duration);
  if (typeof workout.tss === "number" && workout.tss > 0) {
    parts.push(String(workout.tss));
  } else if (typeof workout.distanceKm === "number" && workout.distanceKm > 0) {
    parts.push(`${Math.round(workout.distanceKm * 10) / 10}km`);
  } else if (typeof workout.distanceM === "number" && workout.distanceM > 0) {
    parts.push(`${workout.distanceM}m`);
  }
  return parts.join(" • ");
}

function getRpeFromPlan(workout: WorkoutWithDetails): string | null {
  const raw = workout.prescriptionJson;
  if (typeof raw !== "string" || raw.trim().length === 0) return null;
  const parsed = parseWorkoutPlanJson(raw);
  if (!parsed) return null;

  if (parsed.kind === "prescription_v1") {
    const targets = Array.isArray(parsed.plan.targets) ? parsed.plan.targets : [];
    const rpe = targets.find((t) => t && t.label === "RPE" && typeof t.value === "string");
    return rpe?.value ? `RPE ${rpe.value}` : null;
  }

  if (parsed.kind === "structured_v2") {
    let min: number | null = null;
    let max: number | null = null;
    for (const s of parsed.plan.sections ?? []) {
      for (const b of s.blocks ?? []) {
        const r = b.intensityRange;
        if (r?.unit === "rpe") {
          if (typeof r.min === "number") min = min == null ? r.min : Math.min(min, r.min);
          if (typeof r.max === "number") max = max == null ? r.max : Math.max(max, r.max);
        }
      }
    }
    if (min != null && max != null) return `RPE ${min}–${max}`;
    if (min != null) return `RPE ${min}`;
  }

  return null;
}

function getWeekMetaLine(workout: WorkoutWithDetails): string {
  const dayLabel = new Date(workout.date).toLocaleDateString("en-US", { weekday: "short" });
  const parts: string[] = [dayLabel, getWorkoutTypeLabel(workout.type)];
  const duration = formatDurationShort(workout.durationMin);
  if (duration) parts.push(duration);
  if (typeof workout.tss === "number" && workout.tss > 0) parts.push(`${workout.tss} TSS`);
  const rpe = getRpeFromPlan(workout);
  if (rpe) parts.push(rpe);
  return parts.join(" • ");
}

function getDayMetaLine(workout: WorkoutWithDetails): string {
  const parts: string[] = [getWorkoutTypeLabel(workout.type)];
  const duration = formatDurationShort(workout.durationMin);
  if (duration) parts.push(duration);
  if (typeof workout.tss === "number" && workout.tss > 0) parts.push(`${workout.tss} TSS`);
  const rpe = getRpeFromPlan(workout);
  if (rpe) parts.push(rpe);
  return parts.join(" • ");
}

function isAdaptedFromCheckIn(workout: Workout): boolean {
  if (workout.source === "daily-checkin") return true;
  if (!workout.aiReason) return false;
  return workout.aiReason.toLowerCase().includes("check-in");
}

type WorkoutChipProps = {
  workout: Workout;
  line: string;
  status: WorkoutStatus;
  icon: React.ElementType;
  isToday: boolean;
  aiGenerated?: boolean;
  hasFeedback: boolean;
  onOpen: (workout: Workout) => void;
  onEdit: (workout: Workout) => void;
  onDelete: (workoutId: string) => void;
  onToggleComplete: (workout: Workout) => void;
  onCheckIn: (workout: Workout) => void;
  onFeedback: (workout: Workout) => void;
};

const WorkoutChip = memo(({
  workout,
  line,
  status,
  icon: Icon,
  isToday,
  aiGenerated,
  hasFeedback,
  onOpen,
  onEdit,
  onDelete,
  onToggleComplete,
  onCheckIn,
  onFeedback,
}: WorkoutChipProps) => {
  const statusClasses =
    status === "done"
      ? "bg-success-subtle border-success-subtle text-success"
      : status === "missed" || status === "skipped"
        ? "bg-warning-subtle border-warning-subtle text-warning"
        : "bg-background/40 border-subtle text-foreground/80 hover:bg-muted/40";
  const adapted = isAdaptedFromCheckIn(workout);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        onOpen(workout);
      }
    },
    [workout, onOpen]
  );

  return (
    <div
      role="button"
      tabIndex={0}
      className={cn(
        "group/chip flex w-full items-center gap-1.5 rounded-md border px-1.5 py-1 text-[11px] text-left transition-default cursor-pointer",
        statusClasses
      )}
      title={`${workout.title}${line ? ` • ${line}` : ""}`}
      onClick={() => onOpen(workout)}
      onKeyDown={handleKeyDown}
    >
      {aiGenerated && <Bot className="h-3 w-3 shrink-0" />}
      <Icon className="h-3 w-3 shrink-0" />
      <span className={cn("min-w-0 flex-1 truncate", (status === "missed" || status === "skipped") && "line-through")}>
        {line}
      </span>

      {adapted && (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge variant="info" className="h-4 px-1 text-[9px] leading-none">
                Adapted
              </Badge>
            </TooltipTrigger>
            <TooltipContent>Adapted based on your check-in.</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}

      {status === "done" && <Check className="h-3 w-3 shrink-0" />}
      {status === "done" && (
        <span
          className={cn(
            "ml-1 h-1.5 w-1.5 rounded-full shrink-0",
            hasFeedback ? "bg-emerald-400" : "bg-amber-400"
          )}
          title={hasFeedback ? "Feedback saved" : "Feedback missing"}
        />
      )}

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-5 w-5 p-0 opacity-60 hover:opacity-100"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
          >
            <MoreHorizontal className="h-3 w-3" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            onClick={() => {
              onOpen(workout);
            }}
          >
            <Info className="mr-2 h-4 w-4" />
            Workout detail
          </DropdownMenuItem>
          {workout.planned && !workout.completed && isToday && (
            <DropdownMenuItem onClick={() => onOpen(workout)}>
              <Activity className="mr-2 h-4 w-4" />
              Start workout
            </DropdownMenuItem>
          )}
          {workout.planned && !workout.completed && isToday && (
            <DropdownMenuItem onClick={() => onCheckIn(workout)}>
              <ClipboardCheck className="mr-2 h-4 w-4" />
              Daily Check-In
            </DropdownMenuItem>
          )}
          <DropdownMenuItem onClick={() => onToggleComplete(workout)}>
            <Check className="mr-2 h-4 w-4" />
            {workout.completed ? "Mark incomplete" : "Mark complete"}
          </DropdownMenuItem>
          {workout.completed && (
            <DropdownMenuItem onClick={() => onFeedback(workout)}>
              <MessageSquare className="mr-2 h-4 w-4" />
              Post-workout feedback
            </DropdownMenuItem>
          )}
          <DropdownMenuItem onClick={() => onEdit(workout)}>
            <Edit className="mr-2 h-4 w-4" />
            Edit
          </DropdownMenuItem>
          <DropdownMenuItem className="text-destructive" onClick={() => onDelete(workout.id)}>
            <Trash2 className="mr-2 h-4 w-4" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
});
WorkoutChip.displayName = "WorkoutChip";

type CalendarDayCellProps = {
  day: Date;
  inMonth: boolean;
  isToday: boolean;
  isSelected: boolean;
  readinessScore: number | null;
  workouts: Workout[];
  maxVisible?: number;
  onSelect: (day: Date) => void;
  onQuickAdd: (day: Date, type: string) => void;
  onOpenWorkout: (workout: Workout) => void;
  onEditWorkout: (workout: Workout) => void;
  onDeleteWorkout: (workoutId: string) => void;
  onToggleComplete: (workout: Workout) => void;
  onCheckIn: (workout: Workout) => void;
  onFeedback: (workout: Workout) => void;
  hasFeedback: (workoutId: string) => boolean;
};

const CalendarDayCell = memo(({
  day,
  inMonth,
  isToday,
  isSelected,
  readinessScore,
  workouts,
  maxVisible = 3,
  onSelect,
  onQuickAdd,
  onOpenWorkout,
  onEditWorkout,
  onDeleteWorkout,
  onToggleComplete,
  onCheckIn,
  onFeedback,
  hasFeedback,
}: CalendarDayCellProps) => {
  const readiness = getReadinessTone(readinessScore);
  const visible = workouts.slice(0, maxVisible);
  const overflow = workouts.slice(maxVisible);

  return (
    <div
      className={cn(
        "group relative min-h-[130px] cursor-pointer rounded-card border bg-card/40 p-2 transition-default",
        "border-subtle hover:border-subtle-hover hover:bg-card/60",
        !inMonth && "opacity-60",
        isSelected && "ring-2 ring-primary/70 ring-offset-2 ring-offset-background shadow-sm",
        isToday && !isSelected && "ring-1 ring-primary/80"
      )}
      onClick={() => onSelect(day)}
      role="button"
      tabIndex={0}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className={cn("text-xs font-medium tabular-nums", isToday && "text-primary")}>{day.getDate()}</div>
          <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
            <span className={cn("h-2 w-2 rounded-full", readiness.dotClass)} />
            {typeof readinessScore === "number" ? (
              <span className="tabular-nums">{readinessScore}</span>
            ) : (
              <span className="opacity-60">—</span>
            )}
          </div>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-[10px] opacity-0 group-hover:opacity-100"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
              aria-label="Add workout"
            >
              <Plus className="h-3.5 w-3.5 mr-1" />
              Add
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {quickAddTypes.map((t) => (
              <DropdownMenuItem
                key={t.value}
                onClick={() => {
                  onQuickAdd(day, t.value);
                }}
              >
                <t.icon className="mr-2 h-4 w-4" />
                {t.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="mt-2 space-y-1">
        {visible.length === 0 ? (
          <div className="h-6 rounded-sm bg-muted/20 group-hover:bg-muted/30 transition-colors" aria-hidden />
        ) : (
          visible.map((workout) => {
            const Icon = workoutTypes.find((t) => t.value === workout.type)?.icon ?? Activity;
            const status = getWorkoutStatus(workout);
            const line = getCompactWorkoutLine(workout);
            return (
              <WorkoutChip
                key={workout.id}
                workout={workout}
                line={line}
                status={status}
                icon={Icon}
                isToday={isToday}
                aiGenerated={(workout as WorkoutWithAI).aiGenerated}
                hasFeedback={hasFeedback(workout.id)}
                onOpen={onOpenWorkout}
                onEdit={onEditWorkout}
                onDelete={onDeleteWorkout}
                onToggleComplete={onToggleComplete}
                onCheckIn={onCheckIn}
                onFeedback={onFeedback}
              />
            );
          })
        )}

        {overflow.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-[10px] text-muted-foreground"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                }}
              >
                +{overflow.length} more
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              {overflow.map((workout) => {
                const Icon = workoutTypes.find((t) => t.value === workout.type)?.icon ?? Activity;
                return (
                  <DropdownMenuItem
                    key={workout.id}
                    onClick={() => {
                      onOpenWorkout(workout);
                    }}
                  >
                    <Icon className="mr-2 h-4 w-4" />
                    {getCompactWorkoutLine(workout)}
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </div>
  );
});
CalendarDayCell.displayName = "CalendarDayCell";

type RampRisk = {
  high: boolean;
  ratio: number | null;
  currentTss: number;
  previousTss: number;
};

type CalendarSidePanelProps = {
  tab: "day" | "week" | "month";
  onTabChange: (value: "day" | "week" | "month") => void;
  selectedDate: Date;
  dayWorkouts: Workout[];
  dayCheckIn: CalendarCheckIn | null;
  dayNeedsCheckIn: boolean;
  weeklySummary: WeeklySummary;
  weekWorkouts: Workout[];
  monthlySummary: MonthlySummary;
  rampRisk: RampRisk;
  monthGridDays: Date[];
  workoutsByDate: Map<string, Workout[]>;
  onOpenWorkout: (workout: Workout) => void;
  onEditWorkout: (workout: Workout) => void;
  onToggleComplete: (workout: Workout) => void;
  onDeleteWorkout: (workoutId: string) => void;
  onFeedback: (workout: Workout) => void;
  onQuickAdd: (date: Date, type: string) => void;
  onOpenCheckIn: (workout: Workout) => void;
  onGenerateWeekPlan: () => void;
};

const CalendarSidePanel = memo(({
  tab,
  onTabChange,
  selectedDate,
  dayWorkouts,
  dayCheckIn,
  dayNeedsCheckIn,
  weeklySummary,
  weekWorkouts,
  monthlySummary,
  rampRisk,
  monthGridDays,
  workoutsByDate,
  onOpenWorkout,
  onEditWorkout,
  onToggleComplete,
  onDeleteWorkout,
  onFeedback,
  onQuickAdd,
  onOpenCheckIn,
  onGenerateWeekPlan,
}: CalendarSidePanelProps) => {
  const readiness = getReadinessTone(dayCheckIn?.readinessScore ?? null);
  const weekHours = formatHours((weeklySummary.totalDurationMin ?? 0) / 60);
  const weekPlannedHours = formatHours((weeklySummary.plannedDurationMin ?? 0) / 60);
  const monthHours = formatHours((monthlySummary.totalDurationMin ?? 0) / 60);
  const monthPlannedHours = formatHours((monthlySummary.plannedDurationMin ?? 0) / 60);

  const weekReadiness = getReadinessTone(weeklySummary.avgReadiness ?? null);
  const monthReadiness = getReadinessTone(monthlySummary.avgReadiness ?? null);
  const isTodaySelected = isSameDay(selectedDate, new Date());
  const toneFromBadge = (badge: "success" | "info" | "warning" | "danger" | "muted") =>
    badge === "success"
      ? "success"
      : badge === "warning"
        ? "warning"
        : badge === "danger"
          ? "danger"
          : badge === "info"
            ? "info"
            : "neutral";

  return (
    <div className="sticky top-20">
      <Card className="overflow-hidden">
        <Tabs value={tab} onValueChange={(v) => onTabChange(v as "day" | "week" | "month")}>
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between gap-4">
              <div>
                <CardTitle className="text-base">Command center</CardTitle>
                <div className="text-xs text-muted-foreground">Plan → Check-in → Execute → Feedback</div>
              </div>
            </div>
            <TabsList className="mt-3 grid w-full grid-cols-3">
              <TabsTrigger value="day" className="text-xs">
                Day
              </TabsTrigger>
              <TabsTrigger value="week" className="text-xs">
                Week
              </TabsTrigger>
              <TabsTrigger value="month" className="text-xs">
                Month
              </TabsTrigger>
            </TabsList>
          </CardHeader>
          <CardContent className="pt-0">

            <TabsContent value="day" className="space-y-3">
              <div className="rounded-card border border-subtle bg-muted/10 p-3 space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold">
                      {selectedDate.toLocaleDateString("en-US", {
                        weekday: "long",
                        month: "short",
                        day: "numeric",
                      })}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {selectedDate.toLocaleDateString("en-US", { year: "numeric" })}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <Badge variant={readiness.badge} className="h-5">
                      {typeof dayCheckIn?.readinessScore === "number"
                        ? `Readiness ${dayCheckIn.readinessScore}`
                        : "Readiness —"}
                    </Badge>
                    <Badge variant={dayCheckIn ? "success" : dayNeedsCheckIn ? "warning" : "muted"} className="h-5">
                      {dayCheckIn ? "Check-in done" : dayNeedsCheckIn ? "Check-in needed" : "Check-in optional"}
                    </Badge>
                  </div>
                </div>

                {dayNeedsCheckIn && (
                  <div className="rounded-control border border-warning-subtle bg-warning-subtle p-3 text-xs">
                    <div className="font-medium">Complete check-in before training</div>
                    <div className="text-muted-foreground">It unlocks your start button and adjusts intensity.</div>
                    <div className="mt-2">
                      <Button
                        size="sm"
                        onClick={() => {
                          const target = dayWorkouts.find((w) => w.planned && !w.completed) ?? dayWorkouts[0];
                          if (target) onOpenCheckIn(target);
                        }}
                      >
                        Complete check-in
                      </Button>
                    </div>
                  </div>
                )}
              </div>

              <div className="rounded-card border border-subtle bg-muted/10 p-3 space-y-3">
                <SectionHeader
                  title="Sessions"
                  subtitle={`${dayWorkouts.length} sessions`}
                  right={
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button size="sm" variant="outline">
                          <Plus className="h-4 w-4 mr-1" />
                          Add
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {quickAddTypes.map((t) => (
                          <DropdownMenuItem key={t.value} onClick={() => onQuickAdd(selectedDate, t.value)}>
                            <t.icon className="mr-2 h-4 w-4" />
                            {t.label}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  }
                  density="compact"
                />

                {dayWorkouts.length === 0 ? (
                  <EmptyState
                    title="No sessions yet"
                    description="Plan a session or generate a plan with Coach."
                    cta={{ label: "Add workout", onClick: () => onQuickAdd(selectedDate, "run") }}
                    size="sm"
                  />
                ) : (
                  <div className="space-y-2">
                    {dayWorkouts.map((w) => {
                      const Icon = workoutTypes.find((t) => t.value === w.type)?.icon ?? Activity;
                      const meta = getDayMetaLine(w as WorkoutWithDetails);
                      return (
                        <div
                          key={w.id}
                          className="flex items-center justify-between gap-3 rounded-control border border-subtle bg-background/30 px-3 py-2"
                        >
                          <button
                            type="button"
                            className="flex min-w-0 flex-1 items-center gap-2 text-left"
                            onClick={() => onOpenWorkout(w)}
                          >
                            <Icon className="h-4 w-4 text-muted-foreground" />
                            <div className="min-w-0">
                              <div className="text-xs font-medium truncate">{w.title}</div>
                              <div className="text-[10px] text-muted-foreground truncate">{meta}</div>
                            </div>
                          </button>
                          <div className="flex items-center gap-1">
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7"
                              onClick={() => onOpenWorkout(w)}
                              aria-label="Start workout"
                              disabled={!isTodaySelected || w.completed}
                            >
                              <Play className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7"
                              onClick={() => onEditWorkout(w)}
                              aria-label="Edit workout"
                            >
                              <Edit className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7"
                              onClick={() => onFeedback(w)}
                              disabled={!w.completed}
                              aria-label="Post-workout feedback"
                            >
                              <MessageSquare className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="week" className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <MetricCard
                  title="Compliance"
                  value={formatPercent(weeklySummary.compliancePercent)}
                  hint={`${weeklySummary.completedPlannedCount}/${weeklySummary.plannedCount} planned done`}
                  tone={weeklySummary.compliancePercent >= 80 ? "success" : weeklySummary.compliancePercent >= 60 ? "info" : "warning"}
                  density="compact"
                  className="shadow-none"
                />
                <MetricCard
                  title="Volume"
                  value={`${weekHours} h`}
                  hint={`${weekPlannedHours} h planned`}
                  density="compact"
                  className="shadow-none"
                />
                <MetricCard
                  title="Load"
                  value={formatTSS(weeklySummary.totalTss)}
                  unit="TSS"
                  hint={`${formatTSS(weeklySummary.plannedTss)} planned`}
                  density="compact"
                  className="shadow-none"
                />
                <MetricCard
                  title="Readiness"
                  value={weeklySummary.avgReadiness ?? "—"}
                  hint={weeklySummary.readinessTrend.direction === "UP" ? "Trending up" : weeklySummary.readinessTrend.direction === "DOWN" ? "Trending down" : "Stable"}
                  tone={toneFromBadge(weekReadiness.badge)}
                  density="compact"
                  className="shadow-none"
                />
              </div>
              <div className="text-[10px] text-muted-foreground">{weeklySummary.narrative}</div>

              {rampRisk.high && (
                <div className="rounded-card border border-warning-subtle bg-warning-subtle p-3 text-xs">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-medium">Ramp risk detected</div>
                      <div className="text-muted-foreground">
                        Load is {rampRisk.ratio ? `${Math.round(rampRisk.ratio * 100)}%` : "high"} vs last week.
                      </div>
                    </div>
                    <Button size="sm" variant="outline" onClick={onGenerateWeekPlan}>
                      Apply deload
                    </Button>
                  </div>
                </div>
              )}

              <div className="rounded-card border border-subtle bg-muted/10 p-3 space-y-2">
                <SectionHeader
                  title="Week plan"
                  subtitle={`${weeklySummary.weekStart.toLocaleDateString()} – ${weeklySummary.weekEnd.toLocaleDateString()}`}
                  density="compact"
                />
                {weekWorkouts.length === 0 ? (
                  <div className="space-y-3 rounded-lg border border-dashed border-border/50 bg-muted/5 p-4">
                    <p className="text-xs text-muted-foreground">No sessions planned for this week.</p>
                    <p className="text-[11px] text-muted-foreground/80">Generate a week skeleton with AI Coach to get started.</p>
                    <Button size="sm" variant="outline" onClick={onGenerateWeekPlan} className="w-full sm:w-auto">
                      <Bot className="h-4 w-4 mr-2" />
                      Generate week plan
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {weekWorkouts.map((w) => {
                      const Icon = workoutTypes.find((t) => t.value === w.type)?.icon ?? Activity;
                      const meta = getWeekMetaLine(w as WorkoutWithDetails);
                      return (
                        <div
                          key={w.id}
                          role="button"
                          tabIndex={0}
                          className={cn(
                            "w-full text-left rounded-control border border-subtle bg-background/30 px-3 py-2 transition-default cursor-pointer",
                            "hover:bg-muted/30"
                          )}
                          onClick={() => onOpenWorkout(w)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              onOpenWorkout(w);
                            }
                          }}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-start gap-2 min-w-0">
                              <Icon className="h-4 w-4 text-muted-foreground mt-0.5" />
                              <div className="min-w-0">
                                <div className="text-xs font-medium truncate">{w.title}</div>
                                <div className="text-[10px] text-muted-foreground truncate">{meta}</div>
                              </div>
                            </div>
                            <div className="flex items-center gap-1">
                              <Badge variant={w.completed ? "success" : "outline"} className="h-5">
                                {w.completed ? "Done" : "Planned"}
                              </Badge>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6"
                                    onClick={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                    }}
                                  >
                                    <MoreHorizontal className="h-3.5 w-3.5" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem onClick={() => onOpenWorkout(w)}>
                                    <Info className="mr-2 h-4 w-4" />
                                    Workout detail
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => onEditWorkout(w)}>
                                    <Edit className="mr-2 h-4 w-4" />
                                    Edit
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => onToggleComplete(w)}>
                                    <Check className="mr-2 h-4 w-4" />
                                    {w.completed ? "Mark incomplete" : "Mark complete"}
                                  </DropdownMenuItem>
                                  {w.completed && (
                                    <DropdownMenuItem onClick={() => onFeedback(w)}>
                                      <MessageSquare className="mr-2 h-4 w-4" />
                                      Feedback
                                    </DropdownMenuItem>
                                  )}
                                  <DropdownMenuItem className="text-destructive" onClick={() => onDeleteWorkout(w.id)}>
                                    <Trash2 className="mr-2 h-4 w-4" />
                                    Delete
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="month" className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <MetricCard
                  title="Compliance"
                  value={formatPercent(monthlySummary.compliancePercent)}
                  hint={`${monthlySummary.completedPlannedCount}/${monthlySummary.plannedCount} planned done`}
                  tone={monthlySummary.compliancePercent >= 80 ? "success" : monthlySummary.compliancePercent >= 60 ? "info" : "warning"}
                  density="compact"
                  className="shadow-none"
                />
                <MetricCard
                  title="Volume"
                  value={`${monthHours} h`}
                  hint={`${monthPlannedHours} h planned`}
                  density="compact"
                  className="shadow-none"
                />
                <MetricCard
                  title="Load"
                  value={formatTSS(monthlySummary.totalTss)}
                  unit="TSS"
                  density="compact"
                  className="shadow-none"
                />
                <MetricCard
                  title="Readiness"
                  value={monthlySummary.avgReadiness ?? "—"}
                  hint={monthlySummary.readinessTrend.direction === "UP" ? "Trending up" : monthlySummary.readinessTrend.direction === "DOWN" ? "Trending down" : "Stable"}
                  tone={toneFromBadge(monthReadiness.badge)}
                  density="compact"
                  className="shadow-none"
                />
              </div>

              <div className="rounded-card border border-subtle bg-muted/10 p-3 space-y-2">
                <div className="text-xs font-medium">Monthly snapshot</div>
                <div className="text-[10px] text-muted-foreground">
                  Hard sessions: {monthlySummary.hardSessionsCount} • Rest days: {monthlySummary.restDaysCount}
                </div>
                <div className="grid grid-cols-7 gap-1">
                  {monthGridDays.map((day) => {
                    const key = formatLocalDateInput(day);
                    const dayWorkouts = workoutsByDate.get(key) ?? [];
                    const tss = dayWorkouts.reduce(
                      (sum, w) => sum + (typeof w.tss === "number" ? w.tss : 0),
                      0
                    );
                    const intensity =
                      tss >= 100 ? "bg-primary/60" : tss >= 60 ? "bg-primary/40" : tss > 0 ? "bg-primary/25" : "bg-muted/40";
                    return <div key={key} className={cn("h-2.5 w-full rounded-sm", intensity)} />;
                  })}
                </div>
                <div className="text-[10px] text-muted-foreground">{monthlySummary.narrative}</div>
              </div>
            </TabsContent>
          </CardContent>
        </Tabs>
      </Card>
    </div>
  );
});
CalendarSidePanel.displayName = "CalendarSidePanel";

interface CalendarClientProps {
  initialWorkouts: Workout[];
  initialCheckIns: Array<{
    id: string;
    date: Date;
    readinessScore: number | null;
    aiDecision: string | null;
    aiConfidence: number | null;
    workoutId: string | null;
    userAccepted: boolean | null;
  }>;
  initialFeedbackWorkoutIds: string[];
  initialMonthDate: Date;
  initialOpenWorkoutId?: string | null;
}

export function CalendarClient({
  initialWorkouts,
  initialCheckIns,
  initialFeedbackWorkoutIds,
  initialMonthDate,
  initialOpenWorkoutId,
}: CalendarClientProps) {
  const router = useRouter();
  const [workouts, setWorkouts] = useState<Workout[]>(initialWorkouts);
  const [checkIns, setCheckIns] = useState<CalendarCheckIn[]>(initialCheckIns);
  const [feedbackWorkoutIds, setFeedbackWorkoutIds] = useState<Set<string>>(
    () => new Set(initialFeedbackWorkoutIds)
  );
  const [monthDate, setMonthDate] = useState<Date>(new Date(initialMonthDate));
  const [isMonthLoading, setIsMonthLoading] = useState(false);

  const [selectedWeekStart, setSelectedWeekStart] = useState<Date>(() => startOfWeek(new Date(initialMonthDate)));
  const [selectedDate, setSelectedDate] = useState<Date>(() => {
    const initial = new Date(initialMonthDate);
    const today = new Date();
    return today.getMonth() === initial.getMonth() && today.getFullYear() === initial.getFullYear()
      ? today
      : initial;
  });
  const [panelTab, setPanelTab] = useState<"day" | "week" | "month">("week");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingWorkout, setEditingWorkout] = useState<Workout | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const [workoutDetailOpen, setWorkoutDetailOpen] = useState(false);
  const [workoutDetail, setWorkoutDetail] = useState<Workout | null>(null);
  const [planEditorOpen, setPlanEditorOpen] = useState(false);
  const [autoOpenedWorkout, setAutoOpenedWorkout] = useState(false);
  const [gateLoading, setGateLoading] = useState(false);
  const [detailFeedbackLoading, setDetailFeedbackLoading] = useState(false);
  const [detailFeedback, setDetailFeedback] = useState<FeedbackData | null>(null);
  const [gate, setGate] = useState<null | {
    required: boolean;
    checkInDone: boolean;
    checkInId: string | null;
    aiDecision: string | null;
    aiExplanation: string | null;
    skipped: boolean;
    skipReason: string | null;
  }>(null);
  const [skipReason, setSkipReason] = useState<string>("");

  const [pendingProposals, setPendingProposals] = useState<
    Array<{ id: string; summary: string; confidence: number | null; createdAt: Date }>
  >([]);
  const [proposalLoading, setProposalLoading] = useState(false);
  const [proposalDecisionLoading, setProposalDecisionLoading] = useState<"ACCEPT" | "DECLINE" | null>(null);

  const [formData, setFormData] = useState({
    title: "",
    type: "run",
    durationMin: "",
    distanceKm: "",
    distanceM: "",
    tss: "",
    notes: "",
    descriptionMd: "",
    planned: true,
  });
  const [checkInWorkout, setCheckInWorkout] = useState<Workout | null>(null);
  const [showCheckInModal, setShowCheckInModal] = useState(false);
  const [feedbackWorkout, setFeedbackWorkout] = useState<Workout | null>(null);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);

  async function loadMonth(nextMonthDate: Date) {
    setIsMonthLoading(true);
    try {
      const res = await getCalendarMonthData(formatLocalDateInput(nextMonthDate));
      if (!res.success || !res.data) {
        toast.error(res.error || "Failed to load month");
        return;
      }
      const monthStart = res.data.monthStart;
      setMonthDate(new Date(monthStart));
      setWorkouts(res.data.workouts as unknown as Workout[]);
      setCheckIns(res.data.checkIns as CalendarCheckIn[]);
      setFeedbackWorkoutIds(new Set(res.data.feedbackWorkoutIds || []));
      setSelectedWeekStart(startOfWeek(new Date(monthStart)));
      setSelectedDate((prev) => {
        const nextMonthStart = new Date(monthStart);
        if (!prev) return nextMonthStart;
        const prevDate = new Date(prev);
        if (
          prevDate.getMonth() === nextMonthStart.getMonth() &&
          prevDate.getFullYear() === nextMonthStart.getFullYear()
        ) {
          return prevDate;
        }
        return nextMonthStart;
      });
    } finally {
      setIsMonthLoading(false);
    }
  }

  useEffect(() => {
    if (!initialOpenWorkoutId || autoOpenedWorkout) return;
    const w = workouts.find((x) => x.id === initialOpenWorkoutId);
    if (!w) {
      setAutoOpenedWorkout(true);
      return;
    }
    setWorkoutDetail(w);
    setWorkoutDetailOpen(true);
    setAutoOpenedWorkout(true);
  }, [initialOpenWorkoutId, autoOpenedWorkout, workouts]);


  const grid = useMemo(() => getMonthGrid({ monthDate }), [monthDate]);
  const calendarWorkouts: CalendarWorkout[] = useMemo(
    () =>
      workouts.map((w) => ({
        id: w.id,
        date: w.date,
        planned: w.planned,
        completed: w.completed,
        durationMin: w.durationMin ?? null,
        tss: w.tss ?? null,
      })),
    [workouts]
  );

  const workoutsByDate = useMemo(() => {
    const map = new Map<string, Workout[]>();
    for (const w of workouts) {
      const key = formatLocalDateInput(new Date(w.date));
      const next = map.get(key);
      if (next) {
        next.push(w);
      } else {
        map.set(key, [w]);
      }
    }
    return map;
  }, [workouts]);

  const checkInsByDate = useMemo(() => {
    const map = new Map<string, CalendarCheckIn>();
    for (const c of checkIns) {
      const key = formatLocalDateInput(new Date(c.date));
      if (!map.has(key)) map.set(key, c);
    }
    return map;
  }, [checkIns]);

  const weeklySummary = useMemo(
    () =>
      computeWeeklySummary({
        weekStart: selectedWeekStart,
        workouts: calendarWorkouts,
        checkIns,
      }),
    [selectedWeekStart, calendarWorkouts, checkIns]
  );

  const weekWorkoutList = useMemo(() => {
    const start = new Date(selectedWeekStart);
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 6);
    end.setHours(23, 59, 59, 999);

    return workouts
      .filter((w) => {
        const d = new Date(w.date);
        return d >= start && d <= end;
      })
      .sort((a, b) => {
        const d = new Date(a.date).getTime() - new Date(b.date).getTime();
        if (d !== 0) return d;
        return new Date((a as unknown as { createdAt?: string | Date }).createdAt ?? 0).getTime() -
          new Date((b as unknown as { createdAt?: string | Date }).createdAt ?? 0).getTime();
      });
  }, [selectedWeekStart, workouts]);

  const monthlySummary = useMemo(
    () =>
      computeMonthlySummary({
        monthStart: new Date(monthDate.getFullYear(), monthDate.getMonth(), 1),
        workouts: calendarWorkouts,
        checkIns,
      }),
    [monthDate, calendarWorkouts, checkIns]
  );

  const selectedDayKey = formatLocalDateInput(selectedDate);
  const selectedDayWorkouts = workoutsByDate.get(selectedDayKey) ?? [];
  const selectedDayCheckIn = checkInsByDate.get(selectedDayKey) ?? null;
  const selectedDayPrimaryWorkout =
    selectedDayWorkouts.find((w) => w.planned && !w.completed) ?? selectedDayWorkouts[0] ?? null;
  const selectedDayNeedsCheckIn =
    isSameDay(selectedDate, new Date()) &&
    !!selectedDayPrimaryWorkout &&
    selectedDayWorkouts.some((w) => w.planned && !w.completed) &&
    !selectedDayCheckIn;

  const rampRisk = useMemo(() => {
    const weekStart = new Date(selectedWeekStart);
    weekStart.setHours(0, 0, 0, 0);
    const weekEnd = addDays(weekStart, 6);
    weekEnd.setHours(23, 59, 59, 999);

    const prevWeekStart = addDays(weekStart, -7);
    const prevWeekEnd = addDays(prevWeekStart, 6);
    prevWeekEnd.setHours(23, 59, 59, 999);

    const sumTss = (start: Date, end: Date) =>
      workouts.reduce((sum, w) => {
        const d = new Date(w.date);
        if (d >= start && d <= end) {
          return sum + (typeof w.tss === "number" ? w.tss : 0);
        }
        return sum;
      }, 0);

    const current = sumTss(weekStart, weekEnd);
    const previous = sumTss(prevWeekStart, prevWeekEnd);
    const ratio = previous > 0 ? current / previous : null;
    return {
      currentTss: current,
      previousTss: previous,
      ratio,
      high: ratio !== null && ratio >= 1.3 && current >= 250,
    };
  }, [selectedWeekStart, workouts]);

  const hasFeedback = useCallback((workoutId: string) => feedbackWorkoutIds.has(workoutId), [feedbackWorkoutIds]);

  function getWorkoutsForDate(date: Date) {
    return workoutsByDate.get(formatLocalDateInput(date)) ?? [];
  }

  function getCheckInForDate(date: Date) {
    return checkInsByDate.get(formatLocalDateInput(date)) ?? null;
  }

  async function refreshGate() {
    if (!workoutDetail) return;
    setGateLoading(true);
    try {
      const res = await getPreTrainingGateStatus(workoutDetail.id);
      if (res.success && res.data) {
        setGate({
          required: res.data.required,
          checkInDone: res.data.checkInDone,
          checkInId: res.data.checkInId,
          aiDecision: res.data.aiDecision,
          aiExplanation: res.data.aiExplanation,
          skipped: res.data.skipped,
          skipReason: res.data.skipReason,
        });
      } else {
        setGate(null);
      }
    } finally {
      setGateLoading(false);
    }
  }

  useEffect(() => {
    if (!workoutDetailOpen) return;
    refreshGate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workoutDetailOpen, workoutDetail?.id]);

  useEffect(() => {
    if (!workoutDetailOpen || !workoutDetail?.id) {
      setPendingProposals([]);
      return;
    }

    let cancelled = false;
    setProposalLoading(true);
    getPendingProposalsForWorkout(workoutDetail.id)
      .then((rows) => {
        if (cancelled) return;
        setPendingProposals(
          rows.map((r) => ({
            id: r.id,
            summary: r.summary,
            confidence: r.confidence,
            createdAt: new Date(r.createdAt),
          }))
        );
      })
      .finally(() => {
        if (cancelled) return;
        setProposalLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [workoutDetailOpen, workoutDetail?.id]);

  async function decideProposal(proposalId: string, decision: "ACCEPT" | "DECLINE") {
    setProposalDecisionLoading(decision);
    try {
      const result = await decidePlanChangeProposal({ proposalId, decision });
      if (!result.success) {
        toast.error(result.error || "Failed to decide proposal");
        return;
      }

      toast.success(decision === "ACCEPT" ? "Change applied" : "Change declined");
      const res = await getCalendarMonthData(formatLocalDateInput(new Date(monthDate)));
      if (res.success && res.data) {
        setMonthDate(new Date(res.data.monthStart));
        setWorkouts(res.data.workouts as unknown as Workout[]);
        setCheckIns(res.data.checkIns as CalendarCheckIn[]);
        setFeedbackWorkoutIds(new Set(res.data.feedbackWorkoutIds || []));
        setSelectedWeekStart(startOfWeek(new Date(res.data.monthStart)));

        if (workoutDetail?.id) {
          const updated = (res.data.workouts as unknown as Workout[]).find((w) => w.id === workoutDetail.id) || null;
          setWorkoutDetail(updated);
          if (!updated) setWorkoutDetailOpen(false);
        }
      }
    } catch {
      toast.error("An error occurred");
    } finally {
      setProposalDecisionLoading(null);
    }
  }

  useEffect(() => {
    if (!workoutDetailOpen || !workoutDetail?.id) {
      setDetailFeedback(null);
      return;
    }

    if (!workoutDetail.completed) {
      setDetailFeedback(null);
      return;
    }

    let cancelled = false;
    setDetailFeedbackLoading(true);
    getFeedbackForWorkout(workoutDetail.id)
      .then((fb) => {
        if (cancelled) return;
        setDetailFeedback(fb);
      })
      .finally(() => {
        if (cancelled) return;
        setDetailFeedbackLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [workoutDetailOpen, workoutDetail?.id, workoutDetail?.completed]);

  function getTargetsPreview(w: WorkoutWithDetails): string | null {
    const raw = w.prescriptionJson;
    if (typeof raw !== "string" || raw.trim().length === 0) return null;

    const parsed = parseWorkoutPlanJson(raw);
    if (!parsed || parsed.kind !== "prescription_v1") return null;

    const targets = Array.isArray(parsed.plan.targets) ? parsed.plan.targets : [];
    const items: string[] = [];

    for (const t of targets) {
      if (!t || typeof t.label !== "string" || typeof t.value !== "string") continue;

      if (t.label === "RPE") items.push(`RPE ${t.value}`);
      if (t.label === "HR target") items.push(`HR ${t.value}`);
      if (t.label === "Power target") items.push(`PWR ${t.value}`);
    }

    if (items.length === 0) return null;
    return items.slice(0, 2).join(" • ");
  }

  function getWorkoutMetaPreview(w: WorkoutWithDetails): string | null {
    const parts: string[] = [];
    if (typeof w.durationMin === "number" && w.durationMin > 0) parts.push(`${w.durationMin} min`);

    if (typeof w.distanceKm === "number" && w.distanceKm > 0) {
      parts.push(`${Math.round(w.distanceKm * 10) / 10} km`);
    } else if (typeof w.distanceM === "number" && w.distanceM > 0) {
      parts.push(`${w.distanceM} m`);
    }

    if (typeof w.tss === "number" && w.tss > 0) parts.push(`TSS ${w.tss}`);
    return parts.length > 0 ? parts.join(" • ") : null;
  }

  async function copyWorkoutPlan(w: WorkoutWithDetails): Promise<void> {
    const rawText = typeof w.descriptionMd === "string" ? w.descriptionMd : "";
    const rawJson = typeof w.prescriptionJson === "string" ? w.prescriptionJson : "";
    const parsed = rawJson.trim().length > 0 ? parseWorkoutPlanJson(rawJson) : null;
    const structured =
      parsed?.kind === "structured_v2"
        ? parsed.plan
        : parsed?.kind === "prescription_v1"
          ? convertPrescriptionV1ToStructured(parsed.plan)
          : null;

    const toCopy = structured ? exportStructuredToText(structured) : rawText;
    if (!toCopy || toCopy.trim().length === 0) {
      toast.error("Nothing to copy");
      return;
    }

    try {
      await navigator.clipboard.writeText(toCopy);
      toast.success("Copied plan");
    } catch {
      toast.error("Failed to copy");
    }
  }

  const openNewWorkout = useCallback((date: Date) => {
    setSelectedDate(date);
    setPanelTab("day");
    setEditingWorkout(null);
    setFormData({
      title: "",
      type: "run",
      durationMin: "",
      distanceKm: "",
      distanceM: "",
      tss: "",
      notes: "",
      descriptionMd: "",
      planned: true,
    });
    setIsDialogOpen(true);
  }, []);

  const openQuickAdd = useCallback((date: Date, type: string) => {
    const label = workoutTypes.find((t) => t.value === type)?.label ?? "Workout";
    setSelectedDate(date);
    setPanelTab("day");
    setEditingWorkout(null);
    setFormData({
      title: type === "rest" ? "Rest day" : label,
      type,
      durationMin: "",
      distanceKm: "",
      distanceM: "",
      tss: "",
      notes: "",
      descriptionMd: "",
      planned: true,
    });
    setIsDialogOpen(true);
  }, []);

  const handleSelectDay = useCallback((day: Date) => {
    setSelectedDate(day);
    setSelectedWeekStart(getWeekStartForDate(day));
    setPanelTab("day");
  }, []);

  const openWorkoutDetail = useCallback((workout: Workout) => {
    setWorkoutDetail(workout);
    setWorkoutDetailOpen(true);
  }, []);

  const openFeedbackForWorkout = useCallback((workout: Workout) => {
    setFeedbackWorkout(workout);
    setShowFeedbackModal(true);
  }, []);

  const openCheckInForWorkout = useCallback((workout: Workout) => {
    setCheckInWorkout(workout);
    setShowCheckInModal(true);
  }, []);

  const weekPlanPrefill = useMemo(() => {
    const startIso = formatLocalDateInput(selectedWeekStart);
    return [
      `Generate a week training plan starting ${startIso}.`,
      "Focus on balanced load, recovery, and discipline variety.",
      "Include day-by-day sessions and total weekly volume/TSS targets.",
    ].join("\n");
  }, [selectedWeekStart]);

  const handleGenerateWeekPlan = useCallback(() => {
    router.push(`/coach?prefill=${encodeURIComponent(weekPlanPrefill)}`);
  }, [router, weekPlanPrefill]);

  useEffect(() => {
    function isTypingTarget(target: EventTarget | null) {
      if (!(target instanceof HTMLElement)) return false;
      return (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable
      );
    }

    function onKeyDown(event: KeyboardEvent) {
      if (isTypingTarget(event.target)) return;

      if (event.key === "n" || event.key === "N") {
        event.preventDefault();
        openNewWorkout(selectedDate);
      }
      if (event.key === "j" || event.key === "J") {
        event.preventDefault();
        setSelectedWeekStart((prev) => addDays(prev, -7));
        setPanelTab("week");
      }
      if (event.key === "k" || event.key === "K") {
        event.preventDefault();
        setSelectedWeekStart((prev) => addDays(prev, 7));
        setPanelTab("week");
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selectedDate, openNewWorkout]);

  const openEditWorkout = useCallback((workout: Workout) => {
    setEditingWorkout(workout);
    setSelectedDate(new Date(workout.date));
    setPanelTab("day");
    const w = workout as WorkoutWithDetails;
    setFormData({
      title: workout.title,
      type: workout.type,
      durationMin: workout.durationMin?.toString() || "",
      distanceKm: workout.distanceKm?.toString() || "",
      distanceM: typeof w.distanceM === "number" ? String(w.distanceM) : "",
      tss: workout.tss?.toString() || "",
      notes: workout.notes || "",
      descriptionMd: typeof w.descriptionMd === "string" ? w.descriptionMd : "",
      planned: workout.planned,
    });
    setIsDialogOpen(true);
  }, []);

  async function saveWorkout() {
    if (!selectedDate || !formData.title) {
      toast.error("Please enter a title");
      return;
    }

    setIsLoading(true);
    try {
      const payload: Record<string, unknown> = {
        title: formData.title,
        type: formData.type,
        date: formatLocalDateInput(selectedDate),
        durationMin: formData.durationMin ? parseInt(formData.durationMin) : null,
        distanceKm: formData.distanceKm ? parseFloat(formData.distanceKm) : null,
        distanceM: formData.distanceM ? parseInt(formData.distanceM) : null,
        tss: formData.tss ? parseInt(formData.tss) : null,
        notes: formData.notes || null,
        descriptionMd: formData.descriptionMd || null,
        planned: formData.planned,
        completed: !formData.planned,
      };

      if (editingWorkout) {
        const ew = editingWorkout as WorkoutWithDetails;
        const originalDescription = typeof ew.descriptionMd === "string" ? ew.descriptionMd : "";
        const originalPrescription = typeof ew.prescriptionJson === "string" ? ew.prescriptionJson : null;

        const nextDescription = formData.descriptionMd || "";

        const descriptionChanged = nextDescription !== originalDescription;
        const coreFieldsChanged =
          formData.title !== ew.title ||
          formData.type !== ew.type ||
          formatLocalDateInput(selectedDate) !== formatLocalDateInput(new Date(ew.date)) ||
          (formData.durationMin ? parseInt(formData.durationMin) : null) !== (ew.durationMin ?? null) ||
          (formData.distanceKm ? parseFloat(formData.distanceKm) : null) !== (ew.distanceKm ?? null) ||
          (formData.distanceM ? parseInt(formData.distanceM) : null) !== ((ew as WorkoutWithDetails).distanceM ?? null) ||
          (formData.tss ? parseInt(formData.tss) : null) !== (ew.tss ?? null);

        if ((descriptionChanged || coreFieldsChanged) && originalPrescription) {
          // Backward compat: only auto-clear legacy coach prescription (v1).
          // Never delete user-edited structured plan (v2) implicitly.
          const parsed = parseWorkoutPlanJson(originalPrescription);
          if (parsed?.kind === "prescription_v1") {
            payload.prescriptionJson = null;
          }
        }
      }

      const url = editingWorkout
        ? `/api/workouts/${editingWorkout.id}`
        : "/api/workouts";
      const method = editingWorkout ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const responseBody = (await res.json().catch(() => null)) as null | { error?: string };
      if (!res.ok) {
        throw new Error(responseBody?.error || "Failed to save workout");
      }

      toast.success(editingWorkout ? "Workout updated" : "Workout created");
      setIsDialogOpen(false);

      // Refetch month data to ensure UI reflects DB state (incl. multiple workouts per day)
      const refreshed = await getCalendarMonthData(formatLocalDateInput(new Date(monthDate)));
      if (refreshed.success && refreshed.data) {
        setMonthDate(new Date(refreshed.data.monthStart));
        setWorkouts(refreshed.data.workouts as unknown as Workout[]);
        setCheckIns(refreshed.data.checkIns as CalendarCheckIn[]);
        setFeedbackWorkoutIds(new Set(refreshed.data.feedbackWorkoutIds || []));
        setSelectedWeekStart(startOfWeek(new Date(refreshed.data.monthStart)));
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Failed to save workout";
      toast.error(msg);
    } finally {
      setIsLoading(false);
    }
  }

  const deleteWorkout = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/workouts/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");
      setWorkouts((prev) => prev.filter((w) => w.id !== id));
      toast.success("Workout deleted");
    } catch {
      toast.error("Failed to delete workout");
    }
  }, []);

  const toggleComplete = useCallback(async (workout: Workout) => {
    try {
      const res = await fetch(`/api/workouts/${workout.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ completed: !workout.completed }),
      });
      if (!res.ok) throw new Error("Failed to update");
      const updated = await res.json();
      setWorkouts((prev) => prev.map((w) => (w.id === updated.id ? updated : w)));
      toast.success(updated.completed ? "Marked complete" : "Marked incomplete");

      // After completion, prompt for post-workout feedback (new system)
      if (updated.completed) {
        setFeedbackWorkout(updated);
        setShowFeedbackModal(true);
      }
    } catch {
      toast.error("Failed to update workout");
    }
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="type-h1">Calendar</h1>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() => {
              const d = new Date(monthDate);
              d.setMonth(d.getMonth() - 1);
              loadMonth(d);
            }}
            disabled={isMonthLoading}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="px-2 text-sm font-medium">
            {monthDate.toLocaleDateString("en-US", { month: "long", year: "numeric" })}
            {isMonthLoading && <span className="ml-2 text-xs text-muted-foreground">Loading…</span>}
          </div>
          <Button
            variant="outline"
            onClick={() => {
              const d = new Date();
              loadMonth(d);
            }}
            disabled={isMonthLoading}
          >
            Today
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={() => {
              const d = new Date(monthDate);
              d.setMonth(d.getMonth() + 1);
              loadMonth(d);
            }}
            disabled={isMonthLoading}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6">
        <div className="space-y-2">
          <div className="grid grid-cols-7 gap-2 text-[11px] uppercase tracking-wider text-muted-foreground">
            {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
              <div key={d} className="px-1">
                {d}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-2">
            {grid.days.map((day) => {
              const dayWorkouts = getWorkoutsForDate(day);
              const dayCheckIn = getCheckInForDate(day);
              const isToday = isSameDay(day, new Date());
              const inMonth = day.getMonth() === monthDate.getMonth();
              const isSelected = isSameDay(day, selectedDate);

              return (
                <CalendarDayCell
                  key={day.toISOString()}
                  day={day}
                  inMonth={inMonth}
                  isToday={isToday}
                  isSelected={isSelected}
                  readinessScore={dayCheckIn?.readinessScore ?? null}
                  workouts={dayWorkouts}
                  onSelect={handleSelectDay}
                  onQuickAdd={openQuickAdd}
                  onOpenWorkout={openWorkoutDetail}
                  onEditWorkout={openEditWorkout}
                  onDeleteWorkout={deleteWorkout}
                  onToggleComplete={toggleComplete}
                  onCheckIn={openCheckInForWorkout}
                  onFeedback={openFeedbackForWorkout}
                  hasFeedback={hasFeedback}
                />
              );
            })}
          </div>
        </div>
        <CalendarSidePanel
          tab={panelTab}
          onTabChange={setPanelTab}
          selectedDate={selectedDate}
          dayWorkouts={selectedDayWorkouts}
          dayCheckIn={selectedDayCheckIn}
          dayNeedsCheckIn={selectedDayNeedsCheckIn}
          weeklySummary={weeklySummary}
          weekWorkouts={weekWorkoutList}
          monthlySummary={monthlySummary}
          rampRisk={rampRisk}
          monthGridDays={grid.days}
          workoutsByDate={workoutsByDate}
          onOpenWorkout={openWorkoutDetail}
          onEditWorkout={openEditWorkout}
          onToggleComplete={toggleComplete}
          onDeleteWorkout={deleteWorkout}
          onFeedback={openFeedbackForWorkout}
          onQuickAdd={openQuickAdd}
          onOpenCheckIn={openCheckInForWorkout}
          onGenerateWeekPlan={handleGenerateWeekPlan}
        />
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingWorkout ? "Edit Workout" : "New Workout"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Title</Label>
              <Input
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="Morning Run"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Type</Label>
                <Select
                  value={formData.type}
                  onValueChange={(v) => setFormData({ ...formData, type: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {workoutTypes.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select
                  value={formData.planned ? "planned" : "completed"}
                  onValueChange={(v) =>
                    setFormData({ ...formData, planned: v === "planned" })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="planned">Planned</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Duration (min)</Label>
                <Input
                  type="number"
                  value={formData.durationMin}
                  onChange={(e) =>
                    setFormData({ ...formData, durationMin: e.target.value })
                  }
                  placeholder="60"
                />
              </div>
              <div className="space-y-2">
                <Label>Distance (km)</Label>
                <Input
                  type="number"
                  step="0.1"
                  value={formData.distanceKm}
                  onChange={(e) =>
                    setFormData({ ...formData, distanceKm: e.target.value })
                  }
                  placeholder="10"
                />
              </div>
              <div className="space-y-2">
                <Label>Distance (m)</Label>
                <Input
                  type="number"
                  value={formData.distanceM}
                  onChange={(e) => setFormData({ ...formData, distanceM: e.target.value })}
                  placeholder="2000"
                />
              </div>
              <div className="space-y-2">
                <Label>TSS</Label>
                <Input
                  type="number"
                  value={formData.tss}
                  onChange={(e) => setFormData({ ...formData, tss: e.target.value })}
                  placeholder="75"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Workout Description</Label>
              <Textarea
                value={formData.descriptionMd}
                onChange={(e) => setFormData({ ...formData, descriptionMd: e.target.value })}
                placeholder="Full workout prescription (sections, targets, rationale)…"
                rows={8}
              />
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="How did it go?"
                rows={3}
              />
            </div>
            {(editingWorkout as WorkoutWithAI)?.aiGenerated && (
              <div className="rounded-lg bg-purple-500/10 border border-purple-500/20 p-3">
                <div className="flex items-center gap-2 text-sm font-medium text-purple-400 mb-1">
                  <Bot className="h-4 w-4" />
                  AI Generated
                  {(editingWorkout as WorkoutWithAI).aiConfidence && (
                    <span className="text-xs text-purple-400/70">
                      ({(editingWorkout as WorkoutWithAI).aiConfidence}% confidence)
                    </span>
                  )}
                </div>
                {(editingWorkout as WorkoutWithAI).aiReason && (
                  <p className="text-xs text-muted-foreground">{(editingWorkout as WorkoutWithAI).aiReason}</p>
                )}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={saveWorkout} disabled={isLoading}>
              {isLoading ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Workout Detail + Pre-training gate */}
      <Dialog
        open={workoutDetailOpen}
        onOpenChange={(open) => {
          setWorkoutDetailOpen(open);
          if (!open) {
            setWorkoutDetail(null);
            setGate(null);
            setSkipReason("");
            setPlanEditorOpen(false);
          }
        }}
      >
        <DialogContent className="max-w-6xl max-h-[85vh] overflow-y-auto">
          <DialogHeader className="pr-10">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <DialogTitle className="text-xl truncate">{workoutDetail?.title ?? "Workout"}</DialogTitle>
                {workoutDetail && (
                  <div className="mt-1 text-xs text-muted-foreground truncate">
                    {new Date(workoutDetail.date).toLocaleDateString()} • {workoutDetail.type}
                  </div>
                )}
              </div>
              {workoutDetail && (
                <div className="flex items-center gap-2 shrink-0">
                  <Badge variant={workoutDetail.completed ? "success" : "secondary"}>
                    {workoutDetail.completed ? "Done" : "Planned"}
                  </Badge>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button size="icon" variant="outline" aria-label="Workout actions">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => setPlanEditorOpen(true)}>
                        <Edit className="h-4 w-4 mr-2" /> Edit plan
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={async () => {
                          const w = workoutDetail as WorkoutWithDetails;
                          await copyWorkoutPlan(w);
                        }}
                      >
                        <Copy className="h-4 w-4 mr-2" /> Copy plan
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => {
                          openEditWorkout(workoutDetail);
                          setWorkoutDetailOpen(false);
                        }}
                      >
                        <Edit className="h-4 w-4 mr-2" /> Edit workout details
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="text-destructive focus:text-destructive"
                        onClick={() => {
                          deleteWorkout(workoutDetail.id);
                          setWorkoutDetailOpen(false);
                        }}
                      >
                        <Trash2 className="h-4 w-4 mr-2" /> Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              )}
            </div>
          </DialogHeader>

          {workoutDetail &&
            (() => {
              const w = workoutDetail as WorkoutWithDetails;
              const planText = typeof w.descriptionMd === "string" ? w.descriptionMd : "";
              const rawJson = typeof w.prescriptionJson === "string" ? w.prescriptionJson : "";
              const parsed = rawJson.trim().length > 0 ? parseWorkoutPlanJson(rawJson) : null;
              const v1 = parsed?.kind === "prescription_v1" ? parsed.plan : null;

              const structured =
                parsed?.kind === "structured_v2"
                  ? parsed.plan
                  : parsed?.kind === "prescription_v1"
                    ? convertPrescriptionV1ToStructured(parsed.plan)
                    : null;

              const hasPlan = !!structured || planText.trim().length > 0;
              const targetsPreview = (() => {
                const v1Targets = getTargetsPreview(w);
                if (v1Targets) return v1Targets;
                if (!structured) return null;

                let rpeMin: number | null = null;
                let rpeMax: number | null = null;
                const zoneCounts: Record<string, number> = {};

                for (const s of structured.sections ?? []) {
                  for (const b of s.blocks ?? []) {
                    const zRaw =
                      typeof b.intensityLabel === "string" ? b.intensityLabel.trim().toUpperCase() : null;
                    const z = zRaw && /^Z[1-5]$/.test(zRaw) ? zRaw : null;
                    if (z) zoneCounts[z] = (zoneCounts[z] ?? 0) + 1;

                    const r = b.intensityRange;
                    if (r?.unit === "rpe") {
                      if (typeof r.min === "number") rpeMin = rpeMin == null ? r.min : Math.min(rpeMin, r.min);
                      if (typeof r.max === "number") rpeMax = rpeMax == null ? r.max : Math.max(rpeMax, r.max);
                    }
                  }
                }

                const items: string[] = [];
                if (rpeMin != null) items.push(rpeMax != null ? `RPE ${rpeMin}–${rpeMax}` : `RPE ${rpeMin}`);

                const topZone = Object.entries(zoneCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
                if (topZone) items.push(topZone);

                return items.length > 0 ? items.slice(0, 2).join(" • ") : null;
              })();

              const coachPrefill = (() => {
                const dateIso = new Date(w.date).toISOString().slice(0, 10);
                return [
                  `Generate a structured workout plan for ${w.type} on ${dateIso}.`,
                  "",
                  "Output sections warmup/main/cooldown as blocks with fields:",
                  "reps?, distanceM?, durationSec?, intensityType?, intensityLabel?, intensityRange?, restSec?, notes?",
                  "",
                  "Also include a compact text version with headings (## Warm-up / ## Main set / ## Cool-down).",
                ].join("\n");
              })();

              return (
                <div className="space-y-4">
                  {(proposalLoading || pendingProposals.length > 0) && (
                    <div className="rounded-card border border-yellow-500/30 bg-yellow-500/10 p-3 text-sm">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-2">
                          <AlertTriangle className="h-4 w-4 mt-0.5 text-yellow-500" />
                          <div>
                            <div className="font-medium">Pending plan change</div>
                            <div className="text-xs text-muted-foreground whitespace-pre-wrap">
                              {proposalLoading
                                ? "Loading proposal…"
                                : pendingProposals[0]?.summary || "A plan change proposal is pending."}
                            </div>
                          </div>
                        </div>

                        {!proposalLoading && pendingProposals.length > 0 && (
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              onClick={() => decideProposal(pendingProposals[0].id, "ACCEPT")}
                              disabled={proposalDecisionLoading !== null}
                            >
                              {proposalDecisionLoading === "ACCEPT" ? "Applying…" : "Accept"}
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => decideProposal(pendingProposals[0].id, "DECLINE")}
                              disabled={proposalDecisionLoading !== null}
                            >
                              {proposalDecisionLoading === "DECLINE" ? "Declining…" : "Decline"}
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  <div className="grid gap-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,0.65fr)]">
                    {/* LEFT: Prescription */}
                    <div className="space-y-4">
                      <div className="rounded-card border bg-muted/10 p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="text-sm font-semibold">Prescription</div>
                            <div className="mt-0.5 text-2xs text-muted-foreground">
                              {getWorkoutMetaPreview(w) ?? "Coach prescription"}
                              {targetsPreview ? ` • ${targetsPreview}` : ""}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={async () => {
                                await copyWorkoutPlan(w);
                              }}
                            >
                              <Copy className="h-4 w-4 mr-2" />
                              Copy
                            </Button>
                            <Button type="button" variant="outline" size="sm" onClick={() => setPlanEditorOpen(true)}>
                              <Edit className="h-4 w-4 mr-2" />
                              Edit plan
                            </Button>
                          </div>
                        </div>

                        <Separator className="my-3" />

                        {!hasPlan ? (
                          <div className="rounded-card border bg-muted/20 p-4">
                            <div className="text-sm font-medium">No plan yet</div>
                            <div className="mt-1 text-xs text-muted-foreground">
                              Generate a structured prescription with Coach or add your own.
                            </div>
                            <div className="mt-3 flex flex-wrap gap-2">
                              <Button
                                type="button"
                                variant="outline"
                                onClick={() => router.push(`/coach?prefill=${encodeURIComponent(coachPrefill)}`)}
                              >
                                <Bot className="h-4 w-4 mr-2" />
                                Generate with Coach
                              </Button>
                              <Button type="button" onClick={() => setPlanEditorOpen(true)}>
                                <Edit className="h-4 w-4 mr-2" />
                                Create plan
                              </Button>
                            </div>
                          </div>
                        ) : structured ? (
                          <PlanRenderer plan={structured} density="compact" />
                        ) : (
                          <PlanTextRenderer text={planText} density="compact" />
                        )}

                        {v1?.why && v1.why.trim().length > 0 && (
                          <div className="mt-4 rounded-card border bg-muted/10 p-3">
                            <div className="text-2xs uppercase tracking-wide text-muted-foreground">Coach note</div>
                            <div className="mt-1 text-xs text-muted-foreground whitespace-pre-wrap">{v1.why}</div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* RIGHT: Metrics & Actions */}
                    <div className="space-y-4">
                      <div className="rounded-card border bg-muted/10 p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="text-sm font-semibold">Metrics</div>
                          <Badge variant="muted" className="capitalize">
                            {w.type}
                          </Badge>
                        </div>

                        <div className="grid grid-cols-2 gap-3 text-xs">
                          <div className="rounded-control border bg-background/30 p-3">
                            <div className="text-2xs uppercase tracking-wide text-muted-foreground">Duration</div>
                            <div className="mt-1 font-medium tabular-nums">
                              {typeof w.durationMin === "number" && w.durationMin > 0 ? `${w.durationMin} min` : "—"}
                            </div>
                          </div>
                          <div className="rounded-control border bg-background/30 p-3">
                            <div className="text-2xs uppercase tracking-wide text-muted-foreground">Distance</div>
                            <div className="mt-1 font-medium tabular-nums">
                              {typeof w.distanceKm === "number" && w.distanceKm > 0
                                ? `${Math.round(w.distanceKm * 10) / 10} km`
                                : typeof w.distanceM === "number" && w.distanceM > 0
                                  ? `${w.distanceM} m`
                                  : "—"}
                            </div>
                          </div>
                          <div className="rounded-control border bg-background/30 p-3">
                            <div className="text-2xs uppercase tracking-wide text-muted-foreground">TSS</div>
                            <div className="mt-1 font-medium tabular-nums">
                              {typeof w.tss === "number" && w.tss > 0 ? w.tss : "—"}
                            </div>
                          </div>
                          <div className="rounded-control border bg-background/30 p-3">
                            <div className="text-2xs uppercase tracking-wide text-muted-foreground">Targets</div>
                            <div className="mt-1 font-medium tabular-nums">{targetsPreview ?? "—"}</div>
                          </div>
                        </div>
                      </div>

                      <div className="rounded-card border bg-muted/10 p-4 space-y-3">
                        <div className="text-sm font-semibold">Actions</div>
                        <div className="grid gap-2">
                          <Button
                            onClick={async () => {
                              if (gate?.required && !gate.checkInDone && !gate.skipped) {
                                await trackEvent({
                                  name: "workout_start_blocked",
                                  route: "/calendar",
                                  source: "pretraining_gate",
                                  properties: { workoutId: w.id },
                                });
                                toast.error("Pre-training check required", {
                                  description: "Complete check-in or skip with reason",
                                });
                                return;
                              }

                              if (gate?.checkInId) {
                                const r = await lockCheckIn(gate.checkInId);
                                if (!r.success) {
                                  toast.error(r.error || "Failed to start");
                                  return;
                                }
                              }

                              await trackEvent({
                                name: "workout_started",
                                route: "/calendar",
                                source: "pretraining_gate",
                                properties: {
                                  workoutId: w.id,
                                  hadCheckIn: !!gate?.checkInId,
                                },
                              });

                              toast.success("Workout started");
                              setWorkoutDetailOpen(false);
                            }}
                            disabled={!!gate?.required && !gate.checkInDone && !gate.skipped}
                          >
                            Start workout
                          </Button>

                          <div className="grid grid-cols-2 gap-2">
                            <Button type="button" variant="outline" onClick={() => setPlanEditorOpen(true)}>
                              <Edit className="h-4 w-4 mr-2" />
                              Edit plan
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() => router.push(`/coach?prefill=${encodeURIComponent(coachPrefill)}`)}
                            >
                              <Bot className="h-4 w-4 mr-2" />
                              Generate
                            </Button>
                          </div>
                        </div>
                      </div>

                      <div className="rounded-card border bg-muted/10 p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="text-sm font-semibold flex items-center gap-2">
                            <ClipboardCheck className="h-4 w-4" />
                            Pre-training check
                          </div>
                          {gateLoading && <span className="text-xs text-muted-foreground">Checking…</span>}
                        </div>

                        {gate?.required && !gate.checkInDone && !gate.skipped && (
                          <div className="rounded-control border border-yellow-500/30 bg-yellow-500/10 p-3 text-sm">
                            <div className="flex items-start gap-2">
                              <AlertTriangle className="h-4 w-4 mt-0.5 text-yellow-500" />
                              <div>
                                <div className="font-medium">Check-in required before starting</div>
                                <div className="text-xs text-muted-foreground">
                                  Complete the check-in or explicitly skip with a reason.
                                </div>
                              </div>
                            </div>
                          </div>
                        )}

                        {gate?.checkInDone && (
                          <div className="rounded-control border bg-background/30 p-3 text-sm">
                            <div className="font-medium">Check-in completed</div>
                            {gate.aiDecision && (
                              <div className="text-xs text-muted-foreground mt-1">
                                AI: {gate.aiDecision.replace(/_/g, " ").toLowerCase()}
                              </div>
                            )}
                            {gate.aiExplanation && (
                              <div className="text-xs text-muted-foreground mt-1 whitespace-pre-wrap">{gate.aiExplanation}</div>
                            )}
                          </div>
                        )}

                        {gate?.skipped && (
                          <div className="rounded-control border bg-background/30 p-3 text-sm">
                            <div className="font-medium">Pre-training check skipped</div>
                            {gate.skipReason && (
                              <div className="text-xs text-muted-foreground mt-1">Reason: {gate.skipReason}</div>
                            )}
                          </div>
                        )}

                        <div className="flex gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => {
                              setCheckInWorkout(workoutDetail);
                              setShowCheckInModal(true);
                            }}
                          >
                            Daily Check-In
                          </Button>
                        </div>

                        {gate?.required && !gate.checkInDone && !gate.skipped && (
                          <div className="space-y-2">
                            <Label className="text-sm">Skip reason (required)</Label>
                            <Textarea
                              value={skipReason}
                              onChange={(e) => setSkipReason(e.target.value)}
                              rows={2}
                              placeholder="Why are you skipping the check-in today?"
                            />
                            <Button
                              type="button"
                              variant="outline"
                              onClick={async () => {
                                const r = await skipPreTrainingCheck(workoutDetail.id, skipReason);
                                if (!r.success) {
                                  toast.error(r.error || "Failed to skip");
                                  return;
                                }
                                toast.success("Pre-training check skipped");
                                await refreshGate();
                              }}
                              disabled={skipReason.trim().length < 3}
                            >
                              Skip pre-training check
                            </Button>
                          </div>
                        )}
                      </div>

                      <div className="rounded-card border bg-muted/10 p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="text-sm font-semibold flex items-center gap-2">
                            <MessageSquare className="h-4 w-4" />
                            Post-workout feedback
                          </div>
                          {detailFeedbackLoading && <span className="text-xs text-muted-foreground">Loading…</span>}
                        </div>

                        {workoutDetail.completed ? (
                          detailFeedback ? (
                            <div className="space-y-2 text-xs text-muted-foreground">
                              <div>
                                Difficulty: {detailFeedback.perceivedDifficulty} • vs plan: {detailFeedback.vsPlanned}
                              </div>
                              <div>
                                Enjoyment: {detailFeedback.enjoyment}/5 • Mental: {detailFeedback.mentalState}/5 • Discomfort: {detailFeedback.discomfort}
                              </div>
                              {(detailFeedback.actualAvgHR ||
                                detailFeedback.actualMaxHR ||
                                detailFeedback.actualPaceText ||
                                detailFeedback.actualRpe ||
                                typeof detailFeedback.actualFeel === "number") && (
                                <div>
                                  Actuals:{" "}
                                  {detailFeedback.actualAvgHR ? `AvgHR ${detailFeedback.actualAvgHR} ` : ""}
                                  {detailFeedback.actualMaxHR ? `MaxHR ${detailFeedback.actualMaxHR} ` : ""}
                                  {detailFeedback.actualPaceText ? `Pace ${detailFeedback.actualPaceText} ` : ""}
                                  {detailFeedback.actualRpe ? `RPE ${detailFeedback.actualRpe}` : ""}
                                  {typeof detailFeedback.actualFeel === "number"
                                    ? `Feel ${detailFeedback.actualFeel}/5`
                                    : ""}
                                </div>
                              )}

                              {detailFeedback.comment && detailFeedback.comment.trim().length > 0 && (
                                <div className="whitespace-pre-wrap">“{detailFeedback.comment}”</div>
                              )}
                            </div>
                          ) : (
                            <div className="text-xs text-muted-foreground">
                              No feedback yet. Adding it helps AdaptivAI calibrate intensity and recovery.
                            </div>
                          )
                        ) : (
                          <div className="text-xs text-muted-foreground">
                            Feedback becomes available after completing the workout.
                          </div>
                        )}

                        <div className="flex gap-2 pt-1">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setFeedbackWorkout(workoutDetail);
                              setShowFeedbackModal(true);
                            }}
                            disabled={!workoutDetail.completed}
                          >
                            {detailFeedback ? "Edit" : "Add feedback"}
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })()}

          <DialogFooter>
            <Button variant="outline" onClick={() => setWorkoutDetailOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Workout Plan Editor (structured + text) */}
      <WorkoutPlanEditorModal
        open={planEditorOpen}
        onOpenChange={setPlanEditorOpen}
        workout={workoutDetail ? (workoutDetail as WorkoutWithDetails) : null}
        onSaved={(updated) => {
          const activeId = workoutDetail?.id;
          if (!activeId) return;
          setWorkoutDetail((prev) => (prev && prev.id === activeId ? ({ ...prev, ...updated } as Workout) : prev));
          setWorkouts((prev) =>
            prev.map((x) => (x.id === activeId ? ({ ...x, ...updated } as Workout) : x))
          );
        }}
      />

      {/* Daily Check-In Modal (authoritative system) */}
      {checkInWorkout && (
        <DailyCheckInModal
          open={showCheckInModal}
          onOpenChange={(open) => {
            setShowCheckInModal(open);
            if (!open) setCheckInWorkout(null);
          }}
          workout={{
            id: checkInWorkout.id,
            title: checkInWorkout.title,
            type: checkInWorkout.type,
            duration: checkInWorkout.durationMin || 60,
            tss: checkInWorkout.tss || 50,
          }}
          onComplete={() => {
            refreshGate();
          }}
        />
      )}

      {/* Post-Workout Feedback Modal (authoritative system) */}
      {feedbackWorkout && (
        <WorkoutFeedbackModal
          open={showFeedbackModal}
          onOpenChange={(open) => {
            setShowFeedbackModal(open);
            if (!open) setFeedbackWorkout(null);
          }}
          workoutId={feedbackWorkout.id}
          workoutTitle={feedbackWorkout.title}
          onComplete={() => {
            setFeedbackWorkoutIds((prev) => {
              const next = new Set(prev);
              next.add(feedbackWorkout.id);
              return next;
            });
            if (workoutDetail?.id === feedbackWorkout.id) {
              setDetailFeedbackLoading(true);
              getFeedbackForWorkout(feedbackWorkout.id)
                .then((fb) => setDetailFeedback(fb))
                .finally(() => setDetailFeedbackLoading(false));
            }
          }}
        />
      )}
    </div>
  );
}
