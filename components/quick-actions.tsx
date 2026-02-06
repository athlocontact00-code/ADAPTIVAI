"use client";

import Link from "next/link";
import {
  Plus,
  Calendar,
  BookOpen,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface QuickAction {
  icon: React.ReactNode;
  label: string;
  description: string;
  href?: string;
  onClick?: () => void;
}

interface QuickActionsProps {
  onAddWorkout?: () => void;
  onAddDiary?: () => void;
}

export function QuickActions({
  onAddWorkout,
  onAddDiary,
}: QuickActionsProps) {
  const actions: QuickAction[] = [
    {
      icon: <Calendar className="h-4 w-4" />,
      label: "Add Workout",
      description: "Schedule a training session",
      href: onAddWorkout ? undefined : "/calendar",
      onClick: onAddWorkout,
    },
    {
      icon: <BookOpen className="h-4 w-4" />,
      label: "Add Diary Entry",
      description: "Log how you're feeling",
      href: onAddDiary ? undefined : "/diary",
      onClick: onAddDiary,
    },
  ];

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Plus className="h-4 w-4 text-primary" />
          Quick Actions
        </CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-2 gap-2">
        {actions.map((action, i) => (
          action.href ? (
            <Link key={i} href={action.href}>
              <QuickActionButton action={action} />
            </Link>
          ) : (
            <QuickActionButton key={i} action={action} />
          )
        ))}
      </CardContent>
    </Card>
  );
}

function QuickActionButton({ action }: { action: QuickAction }) {
  return (
    <button
      onClick={action.onClick}
      className="flex items-center gap-3 p-3 rounded-lg border border-border hover:border-primary/50 hover:bg-muted/50 transition-all text-left w-full group"
    >
      <div className="p-2 rounded-md bg-muted group-hover:bg-primary/10 transition-colors">
        {action.icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{action.label}</p>
        <p className="text-xs text-muted-foreground truncate">{action.description}</p>
      </div>
    </button>
  );
}
