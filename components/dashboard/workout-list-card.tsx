"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ChevronRight, Calendar, Dumbbell } from "lucide-react";
import { formatDistanceToNow, format, isToday, isTomorrow } from "date-fns";

interface Workout {
  id: string;
  title: string;
  date: Date | string;
  type?: string;
  duration?: number;
  tss?: number;
  status?: "planned" | "completed" | "skipped";
}

interface WorkoutListCardProps {
  title: string;
  workouts: Workout[];
  variant: "upcoming" | "recent";
  emptyMessage?: string;
  maxItems?: number;
}

function formatWorkoutDate(date: Date | string, variant: "upcoming" | "recent"): string {
  const d = new Date(date);
  
  if (isToday(d)) return "Today";
  if (isTomorrow(d)) return "Tomorrow";
  
  if (variant === "recent") {
    return formatDistanceToNow(d, { addSuffix: true });
  }
  
  return format(d, "EEE, MMM d");
}

function getStatusBadge(status?: string) {
  switch (status) {
    case "completed":
      return (
        <span className="inline-flex items-center rounded-pill px-1.5 py-0.5 text-2xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
          Done
        </span>
      );
    case "skipped":
      return (
        <span className="inline-flex items-center rounded-pill px-1.5 py-0.5 text-2xs font-medium bg-muted/50 text-muted-foreground border border-border/50">
          Skipped
        </span>
      );
    default:
      return null;
  }
}

export function WorkoutListCard({
  title,
  workouts,
  variant,
  emptyMessage,
  maxItems = 4,
}: WorkoutListCardProps) {
  const displayWorkouts = workouts.slice(0, maxItems);
  const hasMore = workouts.length > maxItems;
  
  const defaultEmptyMessage = variant === "upcoming" 
    ? "No workouts planned. Plan your next session." 
    : "No recent workouts. Start training!";

  return (
    <div className="rounded-card border border-border/50 bg-card transition-all duration-150 hover:border-border/80">
      <div className="p-5 pb-3 flex items-center justify-between">
        <h3 className="text-sm font-medium tracking-tight">{title}</h3>
        <Link href="/calendar">
          <Button variant="ghost" size="sm" className="text-2xs text-muted-foreground hover:text-foreground h-7 px-2">
            View All
            <ChevronRight className="h-3 w-3 ml-0.5" />
          </Button>
        </Link>
      </div>
      <div className="px-5 pb-5">
        {displayWorkouts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-6 text-center">
            <div className="rounded-full bg-muted/30 p-2.5 mb-3">
              {variant === "upcoming" ? (
                <Calendar className="h-4 w-4 text-muted-foreground/70" />
              ) : (
                <Dumbbell className="h-4 w-4 text-muted-foreground/70" />
              )}
            </div>
            <p className="text-xs text-muted-foreground/80 mb-3 max-w-[200px]">{emptyMessage || defaultEmptyMessage}</p>
            <Link href="/calendar">
              <Button size="sm" variant="outline" className="h-7 text-xs">
                {variant === "upcoming" ? "Plan Workout" : "Add Workout"}
              </Button>
            </Link>
          </div>
        ) : (
          <div className="space-y-0.5">
            {displayWorkouts.map((workout) => (
              <Link
                key={workout.id}
                href={`/calendar?date=${format(new Date(workout.date), "yyyy-MM-dd")}`}
                className="flex items-center justify-between py-2.5 px-2.5 -mx-2.5 rounded-control hover:bg-accent/50 transition-all duration-150 group"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium truncate">{workout.title}</p>
                    {getStatusBadge(workout.status)}
                  </div>
                  <div className="flex items-center gap-1.5 text-2xs text-muted-foreground mt-0.5">
                    <span>{formatWorkoutDate(workout.date, variant)}</span>
                    {workout.duration && (
                      <>
                        <span className="text-muted-foreground/50">•</span>
                        <span className="tabular-nums">{workout.duration}min</span>
                      </>
                    )}
                    {workout.tss && (
                      <>
                        <span className="text-muted-foreground/50">•</span>
                        <span className="tabular-nums">{workout.tss} TSS</span>
                      </>
                    )}
                  </div>
                </div>
                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/50 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
              </Link>
            ))}
            {hasMore && (
              <p className="text-2xs text-muted-foreground/70 text-center pt-2">
                +{workouts.length - maxItems} more
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
