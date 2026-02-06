"use client";

import { useState, useEffect } from "react";
import {
  Activity,
  Brain,
  Heart,
  MessageSquare,
  Check,
  Loader2,
  Lock,
  AlertCircle,
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
import { Input } from "@/components/ui/input";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  saveFeedback,
  getFeedbackForWorkout,
  type PerceivedDifficulty,
  type FeltVsPlanned,
  type Discomfort,
  type FeedbackData,
} from "@/lib/actions/workout-feedback";

interface WorkoutFeedbackModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workoutId: string;
  workoutTitle: string;
  onComplete?: () => void;
}

const DIFFICULTY_OPTIONS: { value: PerceivedDifficulty; label: string; color: string }[] = [
  { value: "EASY", label: "Easy", color: "bg-green-500/10 text-green-500 border-green-500/30" },
  { value: "OK", label: "OK", color: "bg-blue-500/10 text-blue-500 border-blue-500/30" },
  { value: "HARD", label: "Hard", color: "bg-orange-500/10 text-orange-500 border-orange-500/30" },
  { value: "BRUTAL", label: "Brutal", color: "bg-red-500/10 text-red-500 border-red-500/30" },
];

const FELT_VS_PLANNED_OPTIONS: { value: FeltVsPlanned; label: string; description: string }[] = [
  { value: "EASIER", label: "Easier", description: "Felt easier than planned" },
  { value: "SAME", label: "As Planned", description: "Matched expectations" },
  { value: "HARDER", label: "Harder", description: "Felt harder than planned" },
];

const DISCOMFORT_OPTIONS: { value: Discomfort; label: string; color: string }[] = [
  { value: "NONE", label: "None", color: "bg-green-500/10 text-green-500 border-green-500/30" },
  { value: "MILD", label: "Mild", color: "bg-yellow-500/10 text-yellow-500 border-yellow-500/30" },
  { value: "MODERATE", label: "Moderate", color: "bg-orange-500/10 text-orange-500 border-orange-500/30" },
  { value: "SEVERE", label: "Severe", color: "bg-red-500/10 text-red-500 border-red-500/30" },
];

export function WorkoutFeedbackModal({
  open,
  onOpenChange,
  workoutId,
  workoutTitle,
  onComplete,
}: WorkoutFeedbackModalProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [existingFeedback, setExistingFeedback] = useState<FeedbackData | null>(null);

  // Form state
  const [perceivedDifficulty, setPerceivedDifficulty] = useState<PerceivedDifficulty>("OK");
  const [vsPlanned, setVsPlanned] = useState<FeltVsPlanned>("SAME");
  const [enjoyment, setEnjoyment] = useState(3);
  const [discomfort, setDiscomfort] = useState<Discomfort>("NONE");
  const [mentalState, setMentalState] = useState(3);
  const [comment, setComment] = useState("");
  const [visibleToAI, setVisibleToAI] = useState(true);

  const [actualAvgHR, setActualAvgHR] = useState<string>("");
  const [actualMaxHR, setActualMaxHR] = useState<string>("");
  const [actualPaceText, setActualPaceText] = useState<string>("");
  const [actualRpe, setActualRpe] = useState<string>("");
  const [actualFeel, setActualFeel] = useState<number>(3);

  const [sessionEquipment, setSessionEquipment] = useState<string>("");
  const [sessionTerrain, setSessionTerrain] = useState<string>("");
  const [sessionAvailability, setSessionAvailability] = useState<string>("");

  // Load existing feedback
  useEffect(() => {
    if (open && workoutId) {
      setIsLoading(true);
      getFeedbackForWorkout(workoutId).then((feedback) => {
        if (feedback) {
          setExistingFeedback(feedback);
          setPerceivedDifficulty(feedback.perceivedDifficulty as PerceivedDifficulty);
          setVsPlanned(feedback.vsPlanned as FeltVsPlanned);
          setEnjoyment(feedback.enjoyment);
          setDiscomfort(feedback.discomfort as Discomfort);
          setMentalState(feedback.mentalState);
          setComment(feedback.comment || "");
          setVisibleToAI(feedback.visibleToAI);
          setActualAvgHR(feedback.actualAvgHR ? String(feedback.actualAvgHR) : "");
          setActualMaxHR(feedback.actualMaxHR ? String(feedback.actualMaxHR) : "");
          setActualPaceText(feedback.actualPaceText || "");
          setActualRpe(feedback.actualRpe ? String(feedback.actualRpe) : "");
          setActualFeel(typeof feedback.actualFeel === "number" ? feedback.actualFeel : 3);
          setSessionEquipment(feedback.sessionEquipment || "");
          setSessionTerrain(feedback.sessionTerrain || "");
          setSessionAvailability(feedback.sessionAvailability || "");
        }
        setIsLoading(false);
      });
    }
  }, [open, workoutId]);

  const isReadOnly = existingFeedback ? !existingFeedback.isEditable : false;

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      const result = await saveFeedback({
        workoutId,
        perceivedDifficulty,
        vsPlanned,
        enjoyment,
        discomfort,
        mentalState,
        actualAvgHR: actualAvgHR.trim().length > 0 ? parseInt(actualAvgHR) : undefined,
        actualMaxHR: actualMaxHR.trim().length > 0 ? parseInt(actualMaxHR) : undefined,
        actualPaceText: actualPaceText.trim().length > 0 ? actualPaceText.trim() : undefined,
        actualRpe: actualRpe.trim().length > 0 ? parseInt(actualRpe) : undefined,
        actualFeel: typeof actualFeel === "number" ? actualFeel : undefined,
        sessionEquipment: sessionEquipment.trim().length > 0 ? sessionEquipment.trim() : undefined,
        sessionTerrain: sessionTerrain.trim().length > 0 ? sessionTerrain.trim() : undefined,
        sessionAvailability: sessionAvailability.trim().length > 0 ? sessionAvailability.trim() : undefined,
        comment: comment || undefined,
        visibleToAI,
      });

      if (result.success) {
        toast.success(existingFeedback ? "Feedback updated" : "Feedback saved");
        onComplete?.();
        onOpenChange(false);
      } else {
        toast.error(result.error || "Failed to save feedback");
      }
    } catch {
      toast.error("Failed to save feedback");
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderRatingButtons = (
    value: number,
    onChange: (v: number) => void,
    labels: string[],
    disabled?: boolean
  ) => (
    <div className="flex gap-2">
      {[1, 2, 3, 4, 5].map((v) => (
        <TooltipProvider key={v}>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={() => !disabled && onChange(v)}
                disabled={disabled}
                className={`w-10 h-10 rounded-lg border-2 font-semibold transition-all ${
                  value === v
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-muted/50 text-muted-foreground border-border hover:border-primary/50"
                } ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-primary" />
            Post-Workout Feedback
          </DialogTitle>
          <DialogDescription>
            {workoutTitle}
            {isReadOnly && (
              <Badge variant="secondary" className="ml-2">
                <Lock className="h-3 w-3 mr-1" />
                Read-only
              </Badge>
            )}
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-6 py-2">
            {isReadOnly && (
              <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg text-sm text-muted-foreground">
                <AlertCircle className="h-4 w-4" />
                Feedback can only be edited on the same day it was created.
              </div>
            )}

            {/* Perceived Difficulty */}
            <div className="space-y-3">
              <Label className="flex items-center gap-2">
                <Activity className="h-4 w-4 text-orange-500" />
                Perceived Difficulty
              </Label>
              <div className="grid grid-cols-4 gap-2">
                {DIFFICULTY_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => !isReadOnly && setPerceivedDifficulty(option.value)}
                    disabled={isReadOnly}
                    className={`p-3 rounded-lg border-2 text-sm font-medium transition-all ${
                      perceivedDifficulty === option.value
                        ? option.color
                        : "bg-muted/50 text-muted-foreground border-border hover:border-primary/50"
                    } ${isReadOnly ? "opacity-50 cursor-not-allowed" : ""}`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Felt vs Planned */}
            <div className="space-y-3">
              <Label>Compared to Plan</Label>
              <div className="grid grid-cols-3 gap-2">
                {FELT_VS_PLANNED_OPTIONS.map((option) => (
                  <TooltipProvider key={option.value}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          onClick={() => !isReadOnly && setVsPlanned(option.value)}
                          disabled={isReadOnly}
                          className={`p-3 rounded-lg border-2 text-sm font-medium transition-all ${
                            vsPlanned === option.value
                              ? "bg-primary/10 text-primary border-primary/30"
                              : "bg-muted/50 text-muted-foreground border-border hover:border-primary/50"
                          } ${isReadOnly ? "opacity-50 cursor-not-allowed" : ""}`}
                        >
                          {option.label}
                        </button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>{option.description}</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                ))}
              </div>
            </div>

            {/* Enjoyment */}
            <div className="space-y-3">
              <Label className="flex items-center gap-2">
                <Heart className="h-4 w-4 text-pink-500" />
                Enjoyment
              </Label>
              {renderRatingButtons(
                enjoyment,
                setEnjoyment,
                ["Very low", "Low", "Neutral", "Good", "Excellent"],
                isReadOnly
              )}
            </div>

            {/* Physical Discomfort */}
            <div className="space-y-3">
              <Label className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-red-500" />
                Physical Discomfort
              </Label>
              <div className="grid grid-cols-4 gap-2">
                {DISCOMFORT_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => !isReadOnly && setDiscomfort(option.value)}
                    disabled={isReadOnly}
                    className={`p-3 rounded-lg border-2 text-sm font-medium transition-all ${
                      discomfort === option.value
                        ? option.color
                        : "bg-muted/50 text-muted-foreground border-border hover:border-primary/50"
                    } ${isReadOnly ? "opacity-50 cursor-not-allowed" : ""}`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Mental State */}
            <div className="space-y-3">
              <Label className="flex items-center gap-2">
                <Brain className="h-4 w-4 text-purple-500" />
                Mental State After Workout
              </Label>
              {renderRatingButtons(
                mentalState,
                setMentalState,
                ["Very drained", "Tired", "Neutral", "Good", "Energized"],
                isReadOnly
              )}
            </div>

            <div className="space-y-3">
              <Label>Actuals (optional)</Label>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Avg HR</Label>
                  <Input
                    type="number"
                    value={actualAvgHR}
                    onChange={(e) => setActualAvgHR(e.target.value)}
                    disabled={isReadOnly}
                    placeholder="145"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Max HR</Label>
                  <Input
                    type="number"
                    value={actualMaxHR}
                    onChange={(e) => setActualMaxHR(e.target.value)}
                    disabled={isReadOnly}
                    placeholder="172"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Pace / Split</Label>
                  <Input
                    value={actualPaceText}
                    onChange={(e) => setActualPaceText(e.target.value)}
                    disabled={isReadOnly}
                    placeholder="e.g. 4:30/km or 2:00/100m"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">RPE (1-10)</Label>
                  <Input
                    type="number"
                    value={actualRpe}
                    onChange={(e) => setActualRpe(e.target.value)}
                    disabled={isReadOnly}
                    placeholder="7"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <Label className="flex items-center gap-2">
                <Heart className="h-4 w-4 text-pink-500" />
                Overall Feel (1-5)
              </Label>
              {renderRatingButtons(
                actualFeel,
                setActualFeel,
                ["Terrible", "Bad", "Okay", "Good", "Great"],
                isReadOnly
              )}
            </div>

            <div className="space-y-3">
              <Label>Session context (optional)</Label>
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Equipment used</Label>
                  <Input
                    value={sessionEquipment}
                    onChange={(e) => setSessionEquipment(e.target.value)}
                    disabled={isReadOnly}
                    placeholder="e.g. carbon shoes, trainer bike"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Terrain / conditions</Label>
                  <Input
                    value={sessionTerrain}
                    onChange={(e) => setSessionTerrain(e.target.value)}
                    disabled={isReadOnly}
                    placeholder="e.g. hills, trail, treadmill, wind"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Availability constraints</Label>
                  <Input
                    value={sessionAvailability}
                    onChange={(e) => setSessionAvailability(e.target.value)}
                    disabled={isReadOnly}
                    placeholder="e.g. only 45min, no pool today"
                  />
                </div>
              </div>
            </div>

            {/* Comment */}
            <div className="space-y-3">
              <Label className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-blue-500" />
                How did this session really feel? (Optional)
              </Label>
              <Textarea
                placeholder="Any additional thoughts about the workout..."
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                rows={3}
                disabled={isReadOnly}
                className={isReadOnly ? "opacity-50" : ""}
              />
            </div>

            {/* AI Visibility Toggle */}
            <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
              <div className="flex items-center gap-2">
                <Brain className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">Share with AI Coach</span>
              </div>
              <button
                type="button"
                onClick={() => !isReadOnly && setVisibleToAI(!visibleToAI)}
                disabled={isReadOnly}
                className={`relative w-11 h-6 rounded-full transition-colors ${
                  visibleToAI ? "bg-primary" : "bg-muted"
                } ${isReadOnly ? "opacity-50 cursor-not-allowed" : ""}`}
              >
                <span
                  className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform ${
                    visibleToAI ? "translate-x-5" : ""
                  }`}
                />
              </button>
            </div>

            {/* Submit Button */}
            {!isReadOnly && (
              <Button
                className="w-full"
                onClick={handleSubmit}
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Check className="h-4 w-4 mr-2" />
                )}
                {existingFeedback ? "Update Feedback" : "Save Feedback"}
              </Button>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
