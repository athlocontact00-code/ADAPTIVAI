"use client";

import { useState, useTransition } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Loader2,
  MessageSquare,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  acceptConflictSuggestion,
  dismissConflictSuggestion,
} from "@/lib/actions/daily-checkin";
import Link from "next/link";

interface ConflictReviewDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  checkInId: string;
  conflictReason: string;
  suggestedChange: string | null;
  readinessScore: number;
  isLocked?: boolean;
  onAccepted?: (proposalId?: string) => void;
  onDismissed?: () => void;
}

interface SuggestionData {
  action: string;
  reason: string;
  newType?: string;
  newTitle?: string;
  durationFactor?: number;
  intensityFactor?: number;
}

function parseSuggestion(json: string | null): SuggestionData | null {
  if (!json) return null;
  try {
    return JSON.parse(json) as SuggestionData;
  } catch {
    return null;
  }
}

function getActionLabel(action: string): string {
  const labels: Record<string, string> = {
    swap_easy: "Swap to easy session",
    swap_recovery: "Replace with recovery",
    reduce_duration: "Shorten duration",
    reduce_intensity: "Reduce intensity",
  };
  return labels[action] || action;
}

function getImpactDescription(suggestion: SuggestionData): string {
  if (suggestion.durationFactor) {
    const reduction = Math.round((1 - suggestion.durationFactor) * 100);
    return `Duration reduced by ${reduction}%`;
  }
  if (suggestion.intensityFactor) {
    const reduction = Math.round((1 - suggestion.intensityFactor) * 100);
    return `Intensity reduced by ${reduction}%`;
  }
  if (suggestion.newType) {
    return `Session type changed to ${suggestion.newType}`;
  }
  return "Workout adjusted for recovery";
}

export function ConflictReviewDrawer({
  open,
  onOpenChange,
  checkInId,
  conflictReason,
  suggestedChange,
  readinessScore,
  isLocked = false,
  onAccepted,
  onDismissed,
}: ConflictReviewDrawerProps) {
  const [isPending, startTransition] = useTransition();
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const suggestion = parseSuggestion(suggestedChange);

  const handleAccept = () => {
    setError(null);
    startTransition(async () => {
      const result = await acceptConflictSuggestion(checkInId);
      if (result.success) {
        setSuccess(true);
        setTimeout(() => {
          onAccepted?.(result.proposalId);
          onOpenChange(false);
          setSuccess(false);
        }, 1500);
      } else {
        setError(result.error || "Failed to apply suggestion");
      }
    });
  };

  const handleDismiss = () => {
    startTransition(async () => {
      const result = await dismissConflictSuggestion(checkInId);
      if (result.success) {
        onDismissed?.();
        onOpenChange(false);
      } else {
        setError(result.error || "Failed to dismiss");
      }
    });
  };

  const handleClose = () => {
    if (!isPending) {
      onOpenChange(false);
      setTimeout(() => {
        setSuccess(false);
        setError(null);
      }, 200);
    }
  };

  return (
    <Sheet open={open} onOpenChange={handleClose}>
      <SheetContent side="right" className="w-full sm:max-w-[400px] p-0">
        <SheetHeader className="p-5 pb-4 border-b border-border/50">
          <SheetTitle className="flex items-center gap-2 text-base font-semibold">
            <AlertTriangle className="h-4 w-4 text-amber-400" />
            Coach Suggestion
          </SheetTitle>
        </SheetHeader>

        {success ? (
          <div className="p-8 flex flex-col items-center justify-center text-center h-[300px]">
            <div className="w-12 h-12 rounded-full bg-emerald-500/10 flex items-center justify-center mb-4">
              <CheckCircle2 className="h-6 w-6 text-emerald-400" />
            </div>
            <p className="text-sm font-medium mb-1">
              {isLocked ? "Proposal created" : "Change applied"}
            </p>
            <p className="text-xs text-muted-foreground">
              {isLocked
                ? "Review the proposal in your calendar."
                : "Your workout has been updated."}
            </p>
          </div>
        ) : (
          <div className="p-5 space-y-5">
            {/* Readiness context */}
            <div className="rounded-control bg-amber-500/5 border border-amber-500/20 p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-muted-foreground">
                  Current readiness
                </span>
                <span
                  className={cn(
                    "text-lg font-semibold tabular-nums",
                    readinessScore >= 60 ? "text-amber-400" : "text-red-400"
                  )}
                >
                  {readinessScore}/100
                </span>
              </div>
              <p className="text-sm font-medium">{conflictReason}</p>
            </div>

            {/* Proposed change */}
            {suggestion && (
              <div className="space-y-3">
                <h4 className="text-sm font-medium">Proposed change</h4>
                <div className="rounded-control border border-border/50 p-4 space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                      <ArrowRight className="h-3 w-3 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">
                        {getActionLabel(suggestion.action)}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {suggestion.reason}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Why */}
            <div className="space-y-2">
              <h4 className="text-sm font-medium">Why this matters</h4>
              <ul className="space-y-1.5 text-xs text-muted-foreground">
                <li className="flex items-start gap-2">
                  <span className="text-muted-foreground/50 mt-0.5">•</span>
                  Training when fatigued increases injury risk
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-muted-foreground/50 mt-0.5">•</span>
                  Quality recovery enables better future sessions
                </li>
              </ul>
            </div>

            {/* Impact */}
            {suggestion && (
              <div className="rounded-control bg-muted/30 p-3">
                <div className="flex items-center gap-2">
                  <Badge variant="muted" className="text-2xs">
                    Impact
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {getImpactDescription(suggestion)}
                  </span>
                </div>
              </div>
            )}

            {/* Locked note */}
            {isLocked && (
              <div className="rounded-control bg-blue-500/5 border border-blue-500/20 p-3">
                <p className="text-xs text-blue-400">
                  Plan is locked. Accepting will create a proposal for your
                  review instead of applying directly.
                </p>
              </div>
            )}

            {error && (
              <div className="rounded-control bg-destructive/10 border border-destructive/20 p-3">
                <p className="text-xs text-destructive">{error}</p>
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        {!success && (
          <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-border/50 bg-card space-y-2">
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={handleDismiss}
                disabled={isPending}
              >
                <X className="h-4 w-4 mr-1" />
                Dismiss
              </Button>
              <Button
                className="flex-1"
                onClick={handleAccept}
                disabled={isPending}
              >
                {isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                    {isLocked ? "Creating..." : "Applying..."}
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4 mr-1" />
                    {isLocked ? "Create Proposal" : "Accept"}
                  </>
                )}
              </Button>
            </div>
            <Link href="/coach" className="block">
              <Button
                variant="ghost"
                className="w-full text-muted-foreground"
                size="sm"
              >
                <MessageSquare className="h-4 w-4 mr-1" />
                Ask Coach for more options
              </Button>
            </Link>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
