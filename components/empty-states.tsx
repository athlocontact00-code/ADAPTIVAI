"use client";

import Link from "next/link";
import {
  Calendar,
  BookOpen,
  Target,
  Beaker,
  Plus,
  Dumbbell,
  TrendingUp,
  Brain,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description: string;
  actionLabel?: string;
  actionHref?: string;
  onAction?: () => void;
}

export function EmptyState({
  icon,
  title,
  description,
  actionLabel,
  actionHref,
  onAction,
}: EmptyStateProps) {
  return (
    <Card>
      <CardContent className="py-12 text-center">
        {icon && (
          <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
            {icon}
          </div>
        )}
        <h3 className="font-semibold mb-2">{title}</h3>
        <p className="text-sm text-muted-foreground mb-6 max-w-sm mx-auto">
          {description}
        </p>
        {actionLabel && (actionHref || onAction) && (
          actionHref ? (
            <Link href={actionHref}>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                {actionLabel}
              </Button>
            </Link>
          ) : (
            <Button onClick={onAction}>
              <Plus className="h-4 w-4 mr-2" />
              {actionLabel}
            </Button>
          )
        )}
      </CardContent>
    </Card>
  );
}

export function NoWorkoutsEmpty({ onAdd }: { onAdd?: () => void }) {
  return (
    <EmptyState
      icon={<Dumbbell className="h-6 w-6 text-muted-foreground" />}
      title="No workouts yet"
      description="Start building your training plan by adding your first workout."
      actionLabel="Create First Workout"
      onAction={onAdd}
      actionHref={onAdd ? undefined : "/calendar"}
    />
  );
}

export function NoDiaryEntriesEmpty({ onAdd }: { onAdd?: () => void }) {
  return (
    <EmptyState
      icon={<BookOpen className="h-6 w-6 text-muted-foreground" />}
      title="No diary entries"
      description="Track your daily wellness by adding your first diary entry."
      actionLabel="Add Today's Entry"
      onAction={onAdd}
      actionHref={onAdd ? undefined : "/diary"}
    />
  );
}

export function NoSeasonEmpty({ onAdd }: { onAdd?: () => void }) {
  return (
    <EmptyState
      icon={<Target className="h-6 w-6 text-muted-foreground" />}
      title="No season plan"
      description="Create a season plan to structure your training around your goals."
      actionLabel="Create Season Plan"
      onAction={onAdd}
      actionHref={onAdd ? undefined : "/season"}
    />
  );
}

export function NoSimulationsEmpty({ onAdd }: { onAdd?: () => void }) {
  return (
    <EmptyState
      icon={<Beaker className="h-6 w-6 text-muted-foreground" />}
      title="No simulations yet"
      description="Explore different training scenarios to optimize your approach."
      actionLabel="Run First Scenario"
      onAction={onAdd}
      actionHref={onAdd ? undefined : "/simulator"}
    />
  );
}

export function NoReportsEmpty() {
  return (
    <EmptyState
      icon={<TrendingUp className="h-6 w-6 text-muted-foreground" />}
      title="No reports available"
      description="Reports will be generated as you log more training data."
    />
  );
}

export function NoFeedbackEmpty() {
  return (
    <EmptyState
      icon={<Brain className="h-6 w-6 text-muted-foreground" />}
      title="No feedback yet"
      description="Complete workouts and provide feedback to help the AI Coach learn."
    />
  );
}

export function TodayNoWorkoutEmpty() {
  return (
    <Card>
      <CardContent className="py-8 text-center">
        <div className="w-10 h-10 rounded-full bg-green-500/10 flex items-center justify-center mx-auto mb-3">
          <Calendar className="h-5 w-5 text-green-500" />
        </div>
        <h3 className="font-medium mb-1">Rest Day</h3>
        <p className="text-sm text-muted-foreground">
          No workout scheduled for today. Enjoy your recovery!
        </p>
      </CardContent>
    </Card>
  );
}
