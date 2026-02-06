"use client";

import { useState } from "react";
import {
  Activity,
  Brain,
  Heart,
  AlertCircle,
  MessageSquare,
  Edit,
  Eye,
  EyeOff,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { WorkoutFeedbackModal } from "./workout-feedback-modal";
import type { FeedbackData } from "@/lib/actions/workout-feedback";

interface WorkoutFeedbackSummaryProps {
  feedback: FeedbackData | null;
  workoutId: string;
  workoutTitle: string;
  workoutCompleted: boolean;
  onFeedbackUpdate?: () => void;
}

const DIFFICULTY_COLORS: Record<string, string> = {
  EASY: "bg-green-500/10 text-green-500",
  OK: "bg-blue-500/10 text-blue-500",
  HARD: "bg-orange-500/10 text-orange-500",
  BRUTAL: "bg-red-500/10 text-red-500",
};

const VS_PLANNED_LABELS: Record<string, string> = {
  EASIER: "Easier than planned",
  SAME: "As planned",
  HARDER: "Harder than planned",
};

const DISCOMFORT_COLORS: Record<string, string> = {
  NONE: "text-green-500",
  MILD: "text-yellow-500",
  MODERATE: "text-orange-500",
  SEVERE: "text-red-500",
};

export function WorkoutFeedbackSummary({
  feedback,
  workoutId,
  workoutTitle,
  workoutCompleted,
  onFeedbackUpdate,
}: WorkoutFeedbackSummaryProps) {
  const [showModal, setShowModal] = useState(false);

  if (!workoutCompleted && !feedback) {
    return null;
  }

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Activity className="h-4 w-4 text-primary" />
              Workout Feedback
            </CardTitle>
            {feedback ? (
              <div className="flex items-center gap-2">
                {feedback.visibleToAI ? (
                  <Badge variant="outline" className="text-xs">
                    <Eye className="h-3 w-3 mr-1" />
                    AI visible
                  </Badge>
                ) : (
                  <Badge variant="secondary" className="text-xs">
                    <EyeOff className="h-3 w-3 mr-1" />
                    Private
                  </Badge>
                )}
                {feedback.isEditable && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowModal(true)}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowModal(true)}
              >
                Add Feedback
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {feedback ? (
            <div className="space-y-4">
              {/* Primary metrics row */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <span className="text-xs text-muted-foreground">Difficulty</span>
                  <Badge className={DIFFICULTY_COLORS[feedback.perceivedDifficulty]}>
                    {feedback.perceivedDifficulty}
                  </Badge>
                </div>
                <div className="space-y-1">
                  <span className="text-xs text-muted-foreground">vs Plan</span>
                  <p className="text-sm font-medium">
                    {VS_PLANNED_LABELS[feedback.vsPlanned]}
                  </p>
                </div>
              </div>

              {/* Ratings row */}
              <div className="grid grid-cols-3 gap-3">
                <div className="flex items-center gap-2">
                  <Heart className="h-4 w-4 text-pink-500" />
                  <div>
                    <span className="text-xs text-muted-foreground block">Enjoyment</span>
                    <span className="font-semibold">{feedback.enjoyment}/5</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Brain className="h-4 w-4 text-purple-500" />
                  <div>
                    <span className="text-xs text-muted-foreground block">Mental</span>
                    <span className="font-semibold">{feedback.mentalState}/5</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <AlertCircle className={`h-4 w-4 ${DISCOMFORT_COLORS[feedback.discomfort]}`} />
                  <div>
                    <span className="text-xs text-muted-foreground block">Discomfort</span>
                    <span className="font-semibold">{feedback.discomfort}</span>
                  </div>
                </div>
              </div>

              {(typeof feedback.actualFeel === "number" ||
                feedback.actualAvgHR !== null ||
                feedback.actualMaxHR !== null ||
                feedback.actualPaceText !== null ||
                feedback.actualRpe !== null ||
                (typeof feedback.sessionEquipment === "string" && feedback.sessionEquipment.trim().length > 0) ||
                (typeof feedback.sessionTerrain === "string" && feedback.sessionTerrain.trim().length > 0) ||
                (typeof feedback.sessionAvailability === "string" && feedback.sessionAvailability.trim().length > 0)) && (
                <div className="pt-2 border-t space-y-2">
                  {typeof feedback.actualFeel === "number" && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-xs text-muted-foreground">Overall feel</span>
                      <span className="font-medium">{feedback.actualFeel}/5</span>
                    </div>
                  )}

                  {(feedback.actualAvgHR !== null ||
                    feedback.actualMaxHR !== null ||
                    feedback.actualPaceText !== null ||
                    feedback.actualRpe !== null) && (
                    <div className="space-y-1">
                      <span className="text-xs text-muted-foreground">Actuals</span>
                      <div className="flex flex-wrap gap-2 text-sm">
                        {feedback.actualAvgHR !== null && <Badge variant="secondary">Avg HR: {feedback.actualAvgHR}</Badge>}
                        {feedback.actualMaxHR !== null && <Badge variant="secondary">Max HR: {feedback.actualMaxHR}</Badge>}
                        {feedback.actualPaceText !== null && <Badge variant="secondary">Pace: {feedback.actualPaceText}</Badge>}
                        {feedback.actualRpe !== null && <Badge variant="secondary">RPE: {feedback.actualRpe}</Badge>}
                      </div>
                    </div>
                  )}

                  {(typeof feedback.sessionEquipment === "string" && feedback.sessionEquipment.trim().length > 0) && (
                    <div className="flex items-center justify-between gap-3 text-sm">
                      <span className="text-xs text-muted-foreground">Equipment</span>
                      <span className="font-medium text-right">{feedback.sessionEquipment}</span>
                    </div>
                  )}
                  {(typeof feedback.sessionTerrain === "string" && feedback.sessionTerrain.trim().length > 0) && (
                    <div className="flex items-center justify-between gap-3 text-sm">
                      <span className="text-xs text-muted-foreground">Terrain</span>
                      <span className="font-medium text-right">{feedback.sessionTerrain}</span>
                    </div>
                  )}
                  {(typeof feedback.sessionAvailability === "string" && feedback.sessionAvailability.trim().length > 0) && (
                    <div className="flex items-center justify-between gap-3 text-sm">
                      <span className="text-xs text-muted-foreground">Availability</span>
                      <span className="font-medium text-right">{feedback.sessionAvailability}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Comment */}
              {feedback.comment && (
                <div className="pt-2 border-t">
                  <div className="flex items-start gap-2">
                    <MessageSquare className="h-4 w-4 text-muted-foreground mt-0.5" />
                    <p className="text-sm text-muted-foreground italic">
                      &ldquo;{feedback.comment}&rdquo;
                    </p>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-4">
              <p className="text-sm text-muted-foreground mb-3">
                No feedback recorded yet. Your feedback helps the AI Coach learn and adapt.
              </p>
              <Button variant="outline" onClick={() => setShowModal(true)}>
                Add Feedback
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <WorkoutFeedbackModal
        open={showModal}
        onOpenChange={setShowModal}
        workoutId={workoutId}
        workoutTitle={workoutTitle}
        onComplete={onFeedbackUpdate}
      />
    </>
  );
}
