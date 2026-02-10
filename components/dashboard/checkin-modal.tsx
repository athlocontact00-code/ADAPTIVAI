"use client";

import { useMemo, useState, useTransition } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Moon,
  Battery,
  Zap,
  Activity,
  Brain,
  CheckCircle2,
  Loader2,
  ArrowRight,
  ArrowLeft,
  Eye,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { savePremiumCheckin, type PremiumCheckinResult } from "@/lib/actions/daily-checkin";
import {
  calculatePremiumReadiness,
  type PremiumCheckinInput,
} from "@/lib/utils/premium-readiness";

interface CheckinModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: (result: PremiumCheckinResult) => void;
  initialData?: CheckinInitialData;
}

type Step = 1 | 2;

const presets = {
  sleep: [
    { label: "Poor", value: 25 },
    { label: "OK", value: 60 },
    { label: "Great", value: 90 },
  ],
  fatigue: [
    { label: "Fresh", value: 20 },
    { label: "Normal", value: 50 },
    { label: "Tired", value: 80 },
  ],
  motivation: [
    { label: "Low", value: 30 },
    { label: "OK", value: 60 },
    { label: "High", value: 90 },
  ],
  soreness: [
    { label: "None", value: 10 },
    { label: "Some", value: 45 },
    { label: "Sore", value: 75 },
  ],
  stress: [
    { label: "Low", value: 20 },
    { label: "Medium", value: 50 },
    { label: "High", value: 80 },
  ],
};

type NotesVisibility = "FULL_AI_ACCESS" | "METRICS_ONLY" | "HIDDEN";

const CHECKIN_PRIVACY_OPTIONS: Array<{ value: NotesVisibility; label: string; description: string }> = [
  {
    value: "FULL_AI_ACCESS",
    label: "Full access",
    description: "The AI Coach can read your scores and notes for the richest recommendation.",
  },
  {
    value: "METRICS_ONLY",
    label: "Metrics only",
    description: "The AI Coach sees your scores but not your written notes.",
  },
  {
    value: "HIDDEN",
    label: "Hidden",
    description: "This check-in stays private. No data is shared with the coach.",
  },
];

type CheckinInitialData = Partial<PremiumCheckinInput> & {
  notes?: string;
  notesVisibility?: NotesVisibility;
};

function getReadinessColor(score: number): string {
  if (score >= 75) return "text-emerald-400";
  if (score >= 60) return "text-amber-400";
  if (score >= 45) return "text-orange-400";
  return "text-red-400";
}

function getReadinessLabel(score: number): string {
  if (score >= 75) return "Great";
  if (score >= 60) return "Good";
  if (score >= 45) return "Fair";
  return "Low";
}

export function CheckinModal({
  open,
  onOpenChange,
  onSuccess,
  initialData,
}: CheckinModalProps) {
  const [step, setStep] = useState<Step>(1);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Form state
  const [sleepQuality, setSleepQuality] = useState(initialData?.sleepQuality ?? 70);
  const [fatigue, setFatigue] = useState(initialData?.fatigue ?? 40);
  const [motivation, setMotivation] = useState(initialData?.motivation ?? 70);
  const [soreness, setSoreness] = useState(initialData?.soreness ?? 30);
  const [stress, setStress] = useState(initialData?.stress ?? 40);
  const [notes, setNotes] = useState(initialData?.notes ?? "");
  const [notesVisibility, setNotesVisibility] = useState<NotesVisibility>(
    initialData?.notesVisibility ?? "FULL_AI_ACCESS"
  );
  const activePrivacy =
    CHECKIN_PRIVACY_OPTIONS.find((option) => option.value === notesVisibility) ??
    CHECKIN_PRIVACY_OPTIONS[0];

  // Computed readiness (for step 2 preview)
  const readinessPreview = useMemo(
    () =>
      calculatePremiumReadiness({
        sleepQuality,
        fatigue,
        motivation,
        soreness,
        stress,
      }),
    [sleepQuality, fatigue, motivation, soreness, stress]
  );
  const { readinessScore, topFactor, recommendation } = readinessPreview;

  const handleNext = () => {
    setStep(2);
  };

  const handleBack = () => {
    setStep(1);
  };

  const handleSubmit = () => {
    setError(null);
    startTransition(async () => {
      const result = await savePremiumCheckin({
        sleepQuality,
        fatigue,
        motivation,
        soreness,
        stress,
        notes: notes.trim() || undefined,
        notesVisibility,
      });

      if (result.success && result.data) {
        setSuccess(true);
        setTimeout(() => {
          onSuccess?.(result.data!);
          onOpenChange(false);
          // Reset state
          setStep(1);
          setSuccess(false);
        }, 1500);
      } else {
        setError(result.error || "Failed to save check-in");
      }
    });
  };

  const handleClose = () => {
    if (!isPending) {
      onOpenChange(false);
      // Reset on close
      setTimeout(() => {
        setStep(1);
        setSuccess(false);
        setError(null);
      }, 200);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[440px] p-0 gap-0 overflow-hidden max-h-[100dvh]">
        <div className="flex flex-col max-h-[100dvh]">
          <DialogHeader className="p-5 pb-4 border-b border-border/50 shrink-0">
            <DialogTitle className="text-base font-semibold">
              {step === 1 ? "How do you feel today?" : "Training readiness"}
            </DialogTitle>
            <div className="flex gap-1.5 mt-2">
              <div
                className={cn(
                  "h-1 flex-1 rounded-full transition-colors",
                  step >= 1 ? "bg-primary" : "bg-muted"
                )}
              />
              <div
                className={cn(
                  "h-1 flex-1 rounded-full transition-colors",
                  step >= 2 ? "bg-primary" : "bg-muted"
                )}
              />
            </div>
          </DialogHeader>

          <div className="flex-1 min-h-0 overflow-y-auto scroll-touch">
            {success ? (
              <div className="p-8 flex flex-col items-center justify-center text-center">
                <div className="w-12 h-12 rounded-full bg-emerald-500/10 flex items-center justify-center mb-4">
                  <CheckCircle2 className="h-6 w-6 text-emerald-400" />
                </div>
                <p className="text-sm font-medium mb-1">Saved successfully</p>
                <p className="text-xs text-muted-foreground">
                  Coach will adjust today if needed.
                </p>
              </div>
            ) : step === 1 ? (
              <div className="p-5 space-y-5">
            {/* Sleep Quality */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Moon className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Sleep quality</span>
                </div>
                <span className="text-sm tabular-nums text-muted-foreground">
                  {sleepQuality}
                </span>
              </div>
              <Slider
                value={[sleepQuality]}
                onValueChange={([v]) => setSleepQuality(v)}
                max={100}
                step={1}
                className="w-full"
              />
              <div className="flex gap-2">
                {presets.sleep.map((p) => (
                  <Button
                    key={p.label}
                    variant={sleepQuality === p.value ? "secondary" : "ghost"}
                    size="sm"
                    className="h-6 text-2xs flex-1"
                    onClick={() => setSleepQuality(p.value)}
                  >
                    {p.label}
                  </Button>
                ))}
              </div>
            </div>

            {/* Fatigue */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Battery className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Fatigue</span>
                </div>
                <span className="text-sm tabular-nums text-muted-foreground">
                  {fatigue}
                </span>
              </div>
              <Slider
                value={[fatigue]}
                onValueChange={([v]) => setFatigue(v)}
                max={100}
                step={1}
                className="w-full"
              />
              <div className="flex gap-2">
                {presets.fatigue.map((p) => (
                  <Button
                    key={p.label}
                    variant={fatigue === p.value ? "secondary" : "ghost"}
                    size="sm"
                    className="h-6 text-2xs flex-1"
                    onClick={() => setFatigue(p.value)}
                  >
                    {p.label}
                  </Button>
                ))}
              </div>
            </div>

            {/* Motivation */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Zap className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Motivation</span>
                </div>
                <span className="text-sm tabular-nums text-muted-foreground">
                  {motivation}
                </span>
              </div>
              <Slider
                value={[motivation]}
                onValueChange={([v]) => setMotivation(v)}
                max={100}
                step={1}
                className="w-full"
              />
              <div className="flex gap-2">
                {presets.motivation.map((p) => (
                  <Button
                    key={p.label}
                    variant={motivation === p.value ? "secondary" : "ghost"}
                    size="sm"
                    className="h-6 text-2xs flex-1"
                    onClick={() => setMotivation(p.value)}
                  >
                    {p.label}
                  </Button>
                ))}
              </div>
            </div>

            {/* Soreness */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Activity className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Soreness</span>
                </div>
                <span className="text-sm tabular-nums text-muted-foreground">
                  {soreness}
                </span>
              </div>
              <Slider
                value={[soreness]}
                onValueChange={([v]) => setSoreness(v)}
                max={100}
                step={1}
                className="w-full"
              />
              <div className="flex gap-2">
                {presets.soreness.map((p) => (
                  <Button
                    key={p.label}
                    variant={soreness === p.value ? "secondary" : "ghost"}
                    size="sm"
                    className="h-6 text-2xs flex-1"
                    onClick={() => setSoreness(p.value)}
                  >
                    {p.label}
                  </Button>
                ))}
              </div>
            </div>

            {/* Stress */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Brain className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Stress</span>
                </div>
                <span className="text-sm tabular-nums text-muted-foreground">
                  {stress}
                </span>
              </div>
              <Slider
                value={[stress]}
                onValueChange={([v]) => setStress(v)}
                max={100}
                step={1}
                className="w-full"
              />
              <div className="flex gap-2">
                {presets.stress.map((p) => (
                  <Button
                    key={p.label}
                    variant={stress === p.value ? "secondary" : "ghost"}
                    size="sm"
                    className="h-6 text-2xs flex-1"
                    onClick={() => setStress(p.value)}
                  >
                    {p.label}
                  </Button>
                ))}
              </div>
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Notes (optional)</span>
                <span className="text-2xs text-muted-foreground">
                  {notes.length}/240
                </span>
              </div>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value.slice(0, 240))}
                placeholder="How do you feel today?"
                className="h-16 resize-none text-sm"
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Eye className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">AI visibility</span>
                </div>
                <span className="text-2xs text-muted-foreground">
                  {activePrivacy.label}
                </span>
              </div>

              <Select
                value={notesVisibility}
                onValueChange={(value) => setNotesVisibility(value as NotesVisibility)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue>
                    <span className="text-sm font-medium">{activePrivacy.label}</span>
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {CHECKIN_PRIVACY_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      <div className="flex flex-col text-xs">
                        <span className="font-semibold">{option.label}</span>
                        <span className="text-muted-foreground/70">{option.description}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <p className="text-2xs text-muted-foreground">
                {activePrivacy.description}
              </p>
            </div>
          </div>
        ) : (
          <div className="p-5 space-y-5">
            {/* Readiness Score */}
            <div className="text-center py-4">
              <div className="text-5xl font-bold tabular-nums mb-1">
                <span className={getReadinessColor(readinessScore)}>
                  {readinessScore}
                </span>
                <span className="text-2xl text-muted-foreground">/100</span>
              </div>
              <Badge
                variant={
                  readinessScore >= 75
                    ? "success"
                    : readinessScore >= 60
                    ? "warning"
                    : "danger"
                }
                className="mt-2"
              >
                {getReadinessLabel(readinessScore)} readiness
              </Badge>
            </div>

            {/* Top Factor */}
            <div className="rounded-control bg-secondary/30 p-4 border border-border/50">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-muted-foreground">Top factor</span>
                <span className="text-sm font-medium">{topFactor}</span>
              </div>
              <p className="text-xs text-muted-foreground/80">
                {recommendation}
              </p>
            </div>

            {/* Summary */}
            <div className="grid grid-cols-5 gap-2 text-center">
              <div className="p-2 rounded-control bg-muted/30">
                <Moon className="h-3.5 w-3.5 mx-auto mb-1 text-muted-foreground" />
                <span className="text-xs font-medium tabular-nums">{sleepQuality}</span>
              </div>
              <div className="p-2 rounded-control bg-muted/30">
                <Battery className="h-3.5 w-3.5 mx-auto mb-1 text-muted-foreground" />
                <span className="text-xs font-medium tabular-nums">{fatigue}</span>
              </div>
              <div className="p-2 rounded-control bg-muted/30">
                <Zap className="h-3.5 w-3.5 mx-auto mb-1 text-muted-foreground" />
                <span className="text-xs font-medium tabular-nums">{motivation}</span>
              </div>
              <div className="p-2 rounded-control bg-muted/30">
                <Activity className="h-3.5 w-3.5 mx-auto mb-1 text-muted-foreground" />
                <span className="text-xs font-medium tabular-nums">{soreness}</span>
              </div>
              <div className="p-2 rounded-control bg-muted/30">
                <Brain className="h-3.5 w-3.5 mx-auto mb-1 text-muted-foreground" />
                <span className="text-xs font-medium tabular-nums">{stress}</span>
              </div>
            </div>

            {error && (
              <div className="rounded-control bg-destructive/10 border border-destructive/20 p-3">
                <p className="text-xs text-destructive">{error}</p>
              </div>
            )}
          </div>
        )}
          </div>

        {/* Footer */}
        {!success && (
          <div className="shrink-0 p-4 border-t border-border/50 flex gap-2 safe-area-inset-bottom">
            {step === 1 ? (
              <>
                <Button variant="ghost" className="flex-1" onClick={handleClose}>
                  Cancel
                </Button>
                <Button className="flex-1" onClick={handleNext}>
                  Next
                  <ArrowRight className="h-4 w-4 ml-1" />
                </Button>
              </>
            ) : (
              <>
                <Button variant="ghost" className="flex-1" onClick={handleBack}>
                  <ArrowLeft className="h-4 w-4 mr-1" />
                  Back
                </Button>
                <Button
                  className="flex-1"
                  onClick={handleSubmit}
                  disabled={isPending}
                >
                  {isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    "Submit"
                  )}
                </Button>
              </>
            )}
          </div>
        )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
