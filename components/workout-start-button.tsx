"use client";

import { useState } from "react";
import { Play, CheckCircle, Clock, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { DailyCheckInModal } from "@/components/daily-checkin-modal";

interface WorkoutStartButtonProps {
  workoutId: string;
  workoutTitle: string;
  workoutType: string;
  duration: number;
  tss: number;
  isCompleted: boolean;
  checkInRequired: boolean;
  checkInDone: boolean;
  onStart?: () => void;
  onComplete?: () => void;
  size?: "default" | "sm" | "lg";
}

export function WorkoutStartButton({
  workoutId,
  workoutTitle,
  workoutType,
  duration,
  tss,
  isCompleted,
  checkInRequired,
  checkInDone,
  onStart,
  onComplete: _onComplete,
  size = "default",
}: WorkoutStartButtonProps) {
  const [showCheckIn, setShowCheckIn] = useState(false);

  const handleClick = () => {
    if (isCompleted) {
      return;
    }

    if (checkInRequired && !checkInDone) {
      setShowCheckIn(true);
      return;
    }

    onStart?.();
  };

  if (isCompleted) {
    return (
      <Button variant="outline" size={size} disabled className="gap-2">
        <CheckCircle className="h-4 w-4 text-green-500" />
        Completed
      </Button>
    );
  }

  if (checkInRequired && !checkInDone) {
    return (
      <>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="default"
                size={size}
                onClick={handleClick}
                className="gap-2"
              >
                <AlertCircle className="h-4 w-4" />
                Check-in Required
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Complete your daily check-in before starting</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <DailyCheckInModal
          open={showCheckIn}
          onOpenChange={setShowCheckIn}
          workout={{
            id: workoutId,
            title: workoutTitle,
            type: workoutType,
            duration,
            tss,
          }}
          onComplete={() => {
            setShowCheckIn(false);
            onStart?.();
          }}
        />
      </>
    );
  }

  return (
    <Button variant="default" size={size} onClick={handleClick} className="gap-2">
      <Play className="h-4 w-4" />
      Start Workout
    </Button>
  );
}

export function WorkoutStatusBadge({
  isCompleted,
  isToday,
  isPast,
}: {
  isCompleted: boolean;
  isToday: boolean;
  isPast: boolean;
}) {
  if (isCompleted) {
    return (
      <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/30">
        <CheckCircle className="h-3 w-3 mr-1" />
        Completed
      </Badge>
    );
  }

  if (isToday) {
    return (
      <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30">
        <Clock className="h-3 w-3 mr-1" />
        Today
      </Badge>
    );
  }

  if (isPast) {
    return (
      <Badge variant="outline" className="bg-orange-500/10 text-orange-500 border-orange-500/30">
        Missed
      </Badge>
    );
  }

  return (
    <Badge variant="outline" className="text-muted-foreground">
      Upcoming
    </Badge>
  );
}
