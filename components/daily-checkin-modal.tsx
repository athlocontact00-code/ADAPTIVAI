"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Moon,
  Battery,
  Brain,
  Flame,
  AlertCircle,
  Check,
  X,
  ChevronRight,
  ChevronLeft,
  Info,
  Loader2,
  CalendarDays,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  saveCheckIn,
  acceptAIRecommendation,
  overrideAIRecommendation,
  undoCheckInRecommendation,
  type SaveCheckInInput,
  type CheckInRecommendation,
} from "@/lib/actions/daily-checkin";
import { trackEvent } from "@/lib/actions/analytics";
import { decidePlanChangeProposal } from "@/lib/actions/plan-rigidity";
import { calculateReadinessScore, type MuscleSoreness } from "@/lib/services/daily-checkin.service";
import { cn } from "@/lib/utils";

interface DailyCheckInModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workout: {
    id: string;
    title: string;
    type: string;
    duration: number;
    tss: number;
    date?: string | Date;
  };
  onComplete?: () => void;
}

type Step = "sleep" | "body" | "mind" | "result";

const SORENESS_OPTIONS: { value: MuscleSoreness; label: string; color: string }[] = [
  { value: "NONE", label: "None", color: "bg-green-500/10 text-green-500 border-green-500/30" },
  { value: "MILD", label: "Mild", color: "bg-yellow-500/10 text-yellow-500 border-yellow-500/30" },
  { value: "MODERATE", label: "Moderate", color: "bg-orange-500/10 text-orange-500 border-orange-500/30" },
  { value: "SEVERE", label: "Severe", color: "bg-red-500/10 text-red-500 border-red-500/30" },
];

export function DailyCheckInModal({
  open,
  onOpenChange,
  workout,
  onComplete,
}: DailyCheckInModalProps) {
  const [step, setStep] = useState<Step>("sleep");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [recommendation, setRecommendation] = useState<CheckInRecommendation | null>(null);
  const [checkInId, setCheckInId] = useState<string | null>(null);
  const [readinessScore, setReadinessScore] = useState<number | null>(null);
  const [overrideReason, setOverrideReason] = useState<string>("");
  const [proposalId, setProposalId] = useState<string | null>(null);
  const [analysisStatus, setAnalysisStatus] = useState<"idle" | "loading" | "error" | "done">("idle");
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [autoApplied, setAutoApplied] = useState(false);
  const [appliedWorkoutId, setAppliedWorkoutId] = useState<string | null>(null);
  const [undoing, setUndoing] = useState(false);

  useEffect(() => {
    if (!open) return;
    trackEvent({
      name: "checkin_opened",
      route: "/calendar",
      source: "daily_checkin_modal",
      properties: { workoutId: workout.id },
    });
  }, [open, workout.id]);

  useEffect(() => {
    if (open) return;
    setStep("sleep");
    setRecommendation(null);
    setCheckInId(null);
    setReadinessScore(null);
    setOverrideReason("");
    setProposalId(null);
    setAnalysisStatus("idle");
    setAnalysisError(null);
    setAutoApplied(false);
    setAppliedWorkoutId(null);
    setUndoing(false);
    setIsSubmitting(false);
    setSleepDuration(7);
    setSleepQuality(3);
    setPhysicalFatigue(2);
    setMuscleSoreness("NONE");
    setMentalReadiness(3);
    setMotivation(3);
    setStressLevel(2);
    setNotes("");
  }, [open]);

  const handleProposalDecision = async (decision: "ACCEPT" | "DECLINE") => {
    if (!proposalId) return;
    setIsSubmitting(true);
    try {
      const result = await decidePlanChangeProposal({ proposalId, decision });
      if (result.success) {
        toast.success(decision === "ACCEPT" ? "Change applied" : "Change declined");
        onComplete?.();
        onOpenChange(false);
      } else {
        toast.error(result.error || "Failed to decide proposal");
      }
    } catch {
      toast.error("An error occurred");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Form state
  const [sleepDuration, setSleepDuration] = useState(7);
  const [sleepQuality, setSleepQuality] = useState(3);
  const [physicalFatigue, setPhysicalFatigue] = useState(2);
  const [muscleSoreness, setMuscleSoreness] = useState<MuscleSoreness>("NONE");
  const [mentalReadiness, setMentalReadiness] = useState(3);
  const [motivation, setMotivation] = useState(3);
  const [stressLevel, setStressLevel] = useState(2);
  const [notes, setNotes] = useState("");
  const workoutDate = workout.date ? new Date(workout.date) : new Date();

  const readinessPreview = useMemo(
    () =>
      calculateReadinessScore({
        sleepDuration,
        sleepQuality,
        physicalFatigue,
        mentalReadiness,
        motivation,
        muscleSoreness,
        stressLevel,
        notes,
      }),
    [
      sleepDuration,
      sleepQuality,
      physicalFatigue,
      mentalReadiness,
      motivation,
      muscleSoreness,
      stressLevel,
      notes,
    ]
  );

  const readinessTone =
    readinessPreview >= 70 ? "text-emerald-400" : readinessPreview >= 45 ? "text-amber-400" : "text-red-400";

  const previewFactors = useMemo(() => {
    const factors: string[] = [];
    if (sleepDuration < 6) factors.push("sleep low");
    if (sleepQuality <= 2) factors.push("sleep quality low");
    if (physicalFatigue >= 4) factors.push("fatigue high");
    if (muscleSoreness === "SEVERE") factors.push("soreness high");
    if (muscleSoreness === "MODERATE" && factors.length < 3) factors.push("soreness moderate");
    if (stressLevel >= 4) factors.push("stress high");
    if (motivation <= 2) factors.push("motivation low");
    if (mentalReadiness <= 2) factors.push("mental readiness low");
    return factors.slice(0, 3);
  }, [sleepDuration, sleepQuality, physicalFatigue, muscleSoreness, stressLevel, motivation, mentalReadiness]);

  const steps: Step[] = ["sleep", "body", "mind", "result"];
  const currentStepIndex = steps.indexOf(step);

  const canProceed = () => {
    switch (step) {
      case "sleep":
        return sleepDuration > 0 && sleepQuality >= 1;
      case "body":
        return physicalFatigue >= 1 && muscleSoreness;
      case "mind":
        return mentalReadiness >= 1 && motivation >= 1 && stressLevel >= 1;
      default:
        return false;
    }
  };

  const handleNext = async () => {
    if (step === "mind") {
      await submitCheckIn();
    } else {
      const nextIndex = currentStepIndex + 1;
      if (nextIndex < steps.length - 1) {
        setStep(steps[nextIndex]);
      }
    }
  };

  const handleBack = () => {
    const prevIndex = currentStepIndex - 1;
    if (prevIndex >= 0) {
      setStep(steps[prevIndex]);
    }
  };

  const submitCheckIn = async () => {
    setIsSubmitting(true);
    setAnalysisStatus("loading");
    setAnalysisError(null);
    try {
      const input: SaveCheckInInput = {
        sleepDuration,
        sleepQuality,
        physicalFatigue,
        mentalReadiness,
        motivation,
        muscleSoreness,
        stressLevel,
        notes: notes || undefined,
        workoutId: workout.id,
      };

      const result = await saveCheckIn(input);

      if (result.success) {
        setRecommendation(result.recommendation ?? null);
        setCheckInId(result.checkInId || null);
        setReadinessScore(result.readinessScore || null);
        if (result.analysisStatus === "error") {
          setAnalysisStatus("error");
          setAnalysisError(result.analysisError || "We couldn't analyze, keep original workout.");
        } else {
          setAnalysisStatus("done");
        }
        setStep("result");

        if (
          result.checkInId &&
          result.recommendation &&
          result.recommendation.changes.apply &&
          !result.recommendation.changes.requires_confirmation &&
          result.recommendation.recommendation_type !== "keep"
        ) {
          const apply = await acceptAIRecommendation(result.checkInId);
          if (apply.success && apply.applied) {
            setAutoApplied(true);
            setAppliedWorkoutId(apply.workoutId ?? null);
            toast.success("Workout adapted based on your check-in");
            onComplete?.();
          }
        }
      } else {
        toast.error(result.error || "Failed to save check-in");
      }
    } catch {
      toast.error("An error occurred");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAccept = async () => {
    if (!checkInId) return;
    setIsSubmitting(true);
    try {
      const result = await acceptAIRecommendation(checkInId);
      if (result.success) {
        if (result.proposalId) {
          setProposalId(result.proposalId);
          toast.message("Plan is locked", {
            description: "A proposal was created. Accept or decline to continue.",
          });
        } else if (result.applied) {
          setAutoApplied(true);
          setAppliedWorkoutId(result.workoutId ?? null);
          toast.success("Workout adapted based on your check-in");
        } else {
          toast.success("Recommendation accepted");
          onComplete?.();
          onOpenChange(false);
        }
      } else {
        toast.error(result.error || "Failed to accept");
      }
    } catch {
      toast.error("An error occurred");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOverride = async () => {
    if (!checkInId) return;
    setIsSubmitting(true);
    try {
      const reason = overrideReason.trim().length > 0 ? overrideReason.trim() : undefined;
      const result = await overrideAIRecommendation(checkInId, reason);
      if (result.success) {
        toast.success("Proceeding with original plan");
        onComplete?.();
        onOpenChange(false);
      } else {
        toast.error(result.error || "Failed to override");
      }
    } catch {
      toast.error("An error occurred");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUndo = async () => {
    if (!checkInId) return;
    setUndoing(true);
    try {
      const result = await undoCheckInRecommendation(checkInId);
      if (result.success) {
        toast.success("Workout changes undone");
        setAutoApplied(false);
        setAppliedWorkoutId(null);
        onComplete?.();
      } else {
        toast.error(result.error || "Failed to undo");
      }
    } catch {
      toast.error("Failed to undo");
    } finally {
      setUndoing(false);
    }
  };

  const toThreeSentences = (text: string) => {
    const normalized = text.replace(/\s+/g, " ").trim();
    if (!normalized) return normalized;
    const parts = normalized.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [normalized];
    return parts.slice(0, 3).join(" ").trim();
  };

  const renderRatingButtons = (
    value: number,
    onChange: (v: number) => void,
    labels: string[]
  ) => (
    <div className="flex gap-2">
      {[1, 2, 3, 4, 5].map((v) => (
        <TooltipProvider key={v}>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={() => onChange(v)}
                className={`w-12 h-12 rounded-lg border-2 font-semibold transition-all ${
                  value === v
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-muted/50 text-muted-foreground border-border hover:border-primary/50"
                }`}
              >
                {v}
              </button>
            </TooltipTrigger>
            <TooltipContent>
              <p>{labels[v - 1]}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      ))}
    </div>
  );

  const stepLabels: Record<Step, string> = {
    sleep: "Sleep",
    body: "Body",
    mind: "Mind",
    result: "Summary",
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl">
        <DialogHeader>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-1">
              <DialogTitle className="flex items-center gap-2">
                <Battery className="h-5 w-5 text-primary" />
                Pre-training check-in
              </DialogTitle>
              <DialogDescription className="text-sm">
                {workoutDate.toLocaleDateString("en-US", {
                  weekday: "long",
                  month: "short",
                  day: "numeric",
                })}{" "}
                • {workout.title}
              </DialogDescription>
            </div>
            <Badge variant="outline" className="h-6 px-2 capitalize">
              {workout.type}
            </Badge>
          </div>
        </DialogHeader>

        {/* Progress indicator */}
        {step !== "result" && (
          <div className="flex flex-wrap items-center gap-3 mb-4 text-xs text-muted-foreground">
            {steps.slice(0, -1).map((s, i) => (
              <div key={s} className="flex items-center gap-2">
                <div
                  className={cn(
                    "h-6 w-6 rounded-full border text-[10px] font-semibold grid place-items-center",
                    i <= currentStepIndex ? "border-primary text-primary" : "border-border text-muted-foreground"
                  )}
                >
                  {i + 1}
                </div>
                <span className={cn(i <= currentStepIndex && "text-foreground")}>{stepLabels[s]}</span>
                {i < steps.length - 2 && <div className="h-px w-6 bg-border/50" />}
              </div>
            ))}
          </div>
        )}

        {step === "result" ? (
          <div className="space-y-6">
            {analysisStatus === "error" && (
              <Card className="border border-danger-subtle bg-danger-subtle">
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="h-4 w-4 text-danger mt-0.5" />
                    <div>
                      <div className="text-sm font-semibold">We couldn&apos;t analyze this check-in</div>
                      <div className="text-xs text-muted-foreground">{analysisError}</div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={submitCheckIn} disabled={isSubmitting}>
                      {isSubmitting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                      Retry analysis
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {proposalId && (
              <Card className="border-2 border-amber-500/40 bg-amber-500/10">
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="h-5 w-5 text-amber-500 mt-0.5" />
                    <div className="flex-1">
                      <div className="font-semibold">Plan locked — proposal required</div>
                      <div className="text-sm text-muted-foreground">
                        Your plan rigidity prevents automatic changes. Review and decide.
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <Button
                      variant="outline"
                      className="flex-1"
                      onClick={() => handleProposalDecision("DECLINE")}
                      disabled={isSubmitting}
                    >
                      Decline
                    </Button>
                    <Button
                      className="flex-1"
                      onClick={() => handleProposalDecision("ACCEPT")}
                      disabled={isSubmitting}
                    >
                      {isSubmitting ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Check className="h-4 w-4 mr-2" />
                      )}
                      Accept Change
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.7fr)]">
              <div className="space-y-4">
                <Card className="border border-subtle bg-muted/10">
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="text-xs uppercase tracking-wide text-muted-foreground">Readiness score</div>
                        <div className={cn("text-4xl font-semibold tabular-nums", readinessTone)}>
                          {readinessScore ?? "—"}
                        </div>
                      </div>
                      <Badge variant="outline" className="h-6 px-2">
                        {recommendation?.recommendation_type?.replace(/_/g, " ") ?? "keep"}
                      </Badge>
                    </div>
                    {recommendation?.key_factors?.length ? (
                      <div className="flex flex-wrap gap-2">
                        {recommendation.key_factors.map((f) => (
                          <Badge key={f} variant="muted" className="h-6 px-2 text-2xs">
                            {f}
                          </Badge>
                        ))}
                      </div>
                    ) : null}
                    <div className="text-sm text-muted-foreground">
                      {recommendation?.explanation ? toThreeSentences(recommendation.explanation) : "Summary unavailable."}
                    </div>
                  </CardContent>
                </Card>

                {recommendation?.changes?.apply && recommendation.changes.before && recommendation.changes.after && (
                  <Card className="border border-subtle bg-muted/10">
                    <CardContent className="p-4 space-y-3">
                      <div className="text-sm font-semibold">What I changed today</div>
                      <div className="grid gap-2 text-xs">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-muted-foreground">Session</span>
                          <div className="flex items-center gap-2">
                            <span className="line-through text-muted-foreground">
                              {recommendation.changes.before.title}
                            </span>
                            <ChevronRight className="h-3 w-3 text-muted-foreground" />
                            <span className="font-medium">{recommendation.changes.after.title}</span>
                          </div>
                        </div>
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-muted-foreground">Duration</span>
                          <div className="flex items-center gap-2">
                            <span className="line-through text-muted-foreground">
                              {recommendation.changes.before.durationMin ?? "—"} min
                            </span>
                            <ChevronRight className="h-3 w-3 text-muted-foreground" />
                            <span className="font-medium">
                              {recommendation.changes.after.durationMin ?? "—"} min
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-muted-foreground">Load</span>
                          <div className="flex items-center gap-2">
                            <span className="line-through text-muted-foreground">
                              {recommendation.changes.before.tss ?? "—"} TSS
                            </span>
                            <ChevronRight className="h-3 w-3 text-muted-foreground" />
                            <span className="font-medium">
                              {recommendation.changes.after.tss ?? "—"} TSS
                            </span>
                          </div>
                        </div>
                      </div>
                      {recommendation.changes.rationale?.length ? (
                        <div className="text-xs text-muted-foreground">
                          {recommendation.changes.rationale.slice(0, 3).join(" • ")}
                        </div>
                      ) : null}
                    </CardContent>
                  </Card>
                )}
              </div>

              <Card className="border border-subtle bg-muted/10">
                <CardContent className="p-4 space-y-3">
                  <div className="text-xs uppercase tracking-wide text-muted-foreground">Coach note</div>
                  <div className="text-sm text-foreground">
                    {recommendation?.coach_message ?? "Your coach will adjust once signals are available."}
                  </div>
                  {autoApplied && (
                    <div className="rounded-control border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs">
                      <div className="font-medium text-emerald-400">Changes applied</div>
                      <div className="text-muted-foreground">
                        You can undo if this doesn&apos;t feel right.
                      </div>
                      <div className="mt-2 flex gap-2">
                        <Button size="sm" variant="outline" onClick={handleUndo} disabled={undoing}>
                          {undoing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                          Undo
                        </Button>
                        {appliedWorkoutId ? (
                          <Button
                            size="sm"
                            onClick={() => {
                              window.location.href = `/calendar?workoutId=${encodeURIComponent(appliedWorkoutId)}`;
                            }}
                          >
                            View updated workout
                          </Button>
                        ) : null}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {recommendation?.changes?.apply && !autoApplied && (
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Override reason (optional)</Label>
                <Textarea
                  value={overrideReason}
                  onChange={(e) => setOverrideReason(e.target.value)}
                  placeholder="Why are you keeping the original plan?"
                  rows={2}
                />
              </div>
            )}

            {analysisStatus !== "error" && (
              <div className="flex flex-wrap gap-3 pt-2">
                {recommendation?.changes?.apply && !autoApplied && !proposalId ? (
                  <>
                    <Button
                      onClick={handleAccept}
                      disabled={isSubmitting}
                    >
                      {isSubmitting ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Sparkles className="h-4 w-4 mr-2" />
                      )}
                      {recommendation.changes.requires_confirmation
                        ? "Review & Accept Changes"
                        : "Apply changes"}
                    </Button>
                    <Button variant="outline" onClick={handleOverride} disabled={isSubmitting}>
                      <X className="h-4 w-4 mr-2" />
                      Keep original
                    </Button>
                  </>
                ) : (
                  <Button
                    variant="outline"
                    onClick={() => {
                      window.location.href = `/calendar?workoutId=${encodeURIComponent(appliedWorkoutId ?? workout.id)}`;
                    }}
                  >
                    View workout
                  </Button>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_260px]">
            <div className="space-y-6">
              {step === "sleep" && (
                <div className="space-y-4">
                  <Card className="border border-subtle bg-muted/10">
                    <CardContent className="p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <Label className="flex items-center gap-2">
                          <Moon className="h-4 w-4 text-blue-500" />
                          Sleep duration
                        </Label>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Info className="h-4 w-4 text-muted-foreground" />
                            </TooltipTrigger>
                            <TooltipContent>
                              <p className="max-w-xs text-xs">Recovery quality directly impacts readiness.</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                      <div className="flex items-center gap-4">
                        <input
                          type="range"
                          min="3"
                          max="12"
                          step="0.5"
                          value={sleepDuration}
                          onChange={(e) => setSleepDuration(parseFloat(e.target.value))}
                          className="flex-1"
                        />
                        <span className="w-16 text-right font-semibold tabular-nums">{sleepDuration}h</span>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="border border-subtle bg-muted/10">
                    <CardContent className="p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <Label className="flex items-center gap-2">
                          <Moon className="h-4 w-4 text-indigo-500" />
                          Sleep quality
                        </Label>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Info className="h-4 w-4 text-muted-foreground" />
                            </TooltipTrigger>
                            <TooltipContent>
                              <p className="max-w-xs text-xs">Sleep depth is a key recovery signal.</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                      {renderRatingButtons(sleepQuality, setSleepQuality, [
                        "Very poor",
                        "Poor",
                        "Average",
                        "Good",
                        "Excellent",
                      ])}
                    </CardContent>
                  </Card>
                </div>
              )}

              {step === "body" && (
                <div className="space-y-4">
                  <Card className="border border-subtle bg-muted/10">
                    <CardContent className="p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <Label className="flex items-center gap-2">
                          <Battery className="h-4 w-4 text-orange-500" />
                          Fatigue
                        </Label>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Info className="h-4 w-4 text-muted-foreground" />
                            </TooltipTrigger>
                            <TooltipContent>
                              <p className="max-w-xs text-xs">High fatigue may reduce quality and increase risk.</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                      {renderRatingButtons(physicalFatigue, setPhysicalFatigue, [
                        "Fresh",
                        "Light",
                        "Moderate",
                        "Tired",
                        "Exhausted",
                      ])}
                    </CardContent>
                  </Card>

                  <Card className="border border-subtle bg-muted/10">
                    <CardContent className="p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <Label className="flex items-center gap-2">
                          <AlertCircle className="h-4 w-4 text-red-500" />
                          Muscle soreness
                        </Label>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Info className="h-4 w-4 text-muted-foreground" />
                            </TooltipTrigger>
                            <TooltipContent>
                              <p className="max-w-xs text-xs">Soreness influences intensity and swap decisions.</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        {SORENESS_OPTIONS.map((option) => (
                          <button
                            key={option.value}
                            type="button"
                            onClick={() => setMuscleSoreness(option.value)}
                            className={cn(
                              "p-3 rounded-lg border-2 text-sm font-medium transition-all",
                              muscleSoreness === option.value
                                ? option.color
                                : "bg-muted/50 text-muted-foreground border-border hover:border-primary/50"
                            )}
                          >
                            {option.label}
                          </button>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}

              {step === "mind" && (
                <div className="space-y-4">
                  <Card className="border border-subtle bg-muted/10">
                    <CardContent className="p-4 space-y-4">
                      <div className="flex items-center justify-between">
                        <Label className="flex items-center gap-2">
                          <Brain className="h-4 w-4 text-purple-500" />
                          Mental readiness
                        </Label>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Info className="h-4 w-4 text-muted-foreground" />
                            </TooltipTrigger>
                            <TooltipContent>
                              <p className="max-w-xs text-xs">Mental readiness predicts execution quality.</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                      {renderRatingButtons(mentalReadiness, setMentalReadiness, [
                        "Not ready",
                        "Hesitant",
                        "Neutral",
                        "Ready",
                        "Focused",
                      ])}

                      <Separator className="bg-border/40" />

                      <div className="flex items-center justify-between">
                        <Label className="flex items-center gap-2">
                          <Flame className="h-4 w-4 text-orange-500" />
                          Motivation
                        </Label>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Info className="h-4 w-4 text-muted-foreground" />
                            </TooltipTrigger>
                            <TooltipContent>
                              <p className="max-w-xs text-xs">Motivation guides how much intensity to keep.</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                      {renderRatingButtons(motivation, setMotivation, [
                        "Very low",
                        "Low",
                        "Moderate",
                        "High",
                        "Very high",
                      ])}

                      <Separator className="bg-border/40" />

                      <div className="flex items-center justify-between">
                        <Label className="flex items-center gap-2">
                          <AlertCircle className="h-4 w-4 text-yellow-500" />
                          Stress
                        </Label>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Info className="h-4 w-4 text-muted-foreground" />
                            </TooltipTrigger>
                            <TooltipContent>
                              <p className="max-w-xs text-xs">High stress reduces recovery capacity.</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                      {renderRatingButtons(stressLevel, setStressLevel, [
                        "Very relaxed",
                        "Relaxed",
                        "Moderate",
                        "High",
                        "Very stressed",
                      ])}
                    </CardContent>
                  </Card>

                  <Card className="border border-subtle bg-muted/10">
                    <CardContent className="p-4 space-y-2">
                      <Label>Optional note</Label>
                      <Textarea
                        placeholder="Any context about how you feel today..."
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        rows={3}
                      />
                    </CardContent>
                  </Card>

                  <Card className="border border-subtle bg-muted/10">
                    <CardContent className="p-4 space-y-2">
                      <div className="text-xs uppercase tracking-wide text-muted-foreground">Summary</div>
                      <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                        <div>Sleep: {sleepDuration}h (Q{sleepQuality}/5)</div>
                        <div>Fatigue: {physicalFatigue}/5</div>
                        <div>Soreness: {muscleSoreness}</div>
                        <div>Mental: {mentalReadiness}/5</div>
                        <div>Motivation: {motivation}/5</div>
                        <div>Stress: {stressLevel}/5</div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}
            </div>

            <div className="space-y-4">
              <Card className="border border-subtle bg-muted/10">
                <CardContent className="p-4 space-y-3">
                  <div className="text-xs uppercase tracking-wide text-muted-foreground">Readiness preview</div>
                  <div className={cn("text-3xl font-semibold tabular-nums", readinessTone)}>
                    {readinessPreview}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Based on sleep, fatigue, stress, and motivation.
                  </div>
                  {previewFactors.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {previewFactors.map((factor) => (
                        <Badge key={factor} variant="muted" className="h-6 px-2 text-2xs">
                          {factor}
                        </Badge>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="border border-subtle bg-muted/10">
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <CalendarDays className="h-3.5 w-3.5" />
                    Today&apos;s session
                  </div>
                  <div className="text-sm font-medium">{workout.title}</div>
                  <div className="text-xs text-muted-foreground">
                    {workout.type} • {workout.duration} min • {workout.tss} TSS
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {/* Navigation */}
        {step !== "result" && (
          <div className="flex justify-between pt-4">
            <Button
              variant="ghost"
              onClick={handleBack}
              disabled={currentStepIndex === 0}
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              Back
            </Button>
            <Button
              onClick={handleNext}
              disabled={!canProceed() || isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Analyzing your readiness and today&apos;s session...
                </>
              ) : step === "mind" ? (
                "Get AI Recommendation"
              ) : (
                <>
                  Next
                  <ChevronRight className="h-4 w-4 ml-1" />
                </>
              )}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
