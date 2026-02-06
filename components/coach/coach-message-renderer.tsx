"use client";

import { useMemo } from "react";
import { WorkoutCard, WeekPlanGrid, ChangeProposalCard } from "./coach-structured-outputs";
import type { WorkoutCardData, WeekPlanGridData, ChangeProposalCardData } from "./coach-structured-outputs";
import { cn } from "@/lib/utils";

function parseJsonBlock(content: string): unknown | null {
  const match = content.match(/```json\s*([\s\S]*?)```/);
  if (!match) return null;
  try {
    return JSON.parse(match[1].trim());
  } catch {
    return null;
  }
}

function isWorkoutData(obj: unknown): obj is WorkoutCardData {
  if (!obj || typeof obj !== "object") return false;
  const o = obj as Record<string, unknown>;
  return o.type === "workout" && typeof o.title === "string" && typeof o.discipline === "string";
}

function isWeekPlanData(obj: unknown): obj is WeekPlanGridData {
  if (!obj || typeof obj !== "object") return false;
  const o = obj as Record<string, unknown>;
  return o.type === "week_plan" && Array.isArray(o.days);
}

function isChangeProposalData(obj: unknown): obj is ChangeProposalCardData {
  if (!obj || typeof obj !== "object") return false;
  const o = obj as Record<string, unknown>;
  return o.type === "change_proposal" && typeof o.description === "string";
}

function renderMarkdownLine(line: string, i: number) {
  if (line.startsWith("**") && line.endsWith("**")) {
    const inner = line.slice(2, -2);
    return <strong key={i}>{inner}</strong>;
  }
  if (line.startsWith("- ")) {
    return <span key={i} className="block">• {line.slice(2)}</span>;
  }
  if (line.startsWith("## ")) {
    return <strong key={i} className="block text-base mt-3">{line.slice(3)}</strong>;
  }
  if (line.startsWith("### ")) {
    return <strong key={i} className="block text-sm mt-2">{line.slice(4)}</strong>;
  }
  return line;
}

interface CoachMessageRendererProps {
  content: string;
  role: "user" | "assistant" | "system";
  className?: string;
}

export function CoachMessageRenderer({ content, role, className }: CoachMessageRendererProps) {
  const parsed = useMemo(() => parseJsonBlock(content), [content]);

  if (role === "user") {
    return (
      <div className={cn("prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap", className)}>
        {content}
      </div>
    );
  }

  if (role === "system") {
    return (
      <div className={cn("text-sm text-muted-foreground italic", className)}>
        {content}
      </div>
    );
  }

  if (parsed && isWorkoutData(parsed)) {
    return (
      <div className={cn("space-y-2", className)}>
        <WorkoutCard data={parsed} />
      </div>
    );
  }

  if (parsed && isWeekPlanData(parsed)) {
    return (
      <div className={cn("space-y-2", className)}>
        <WeekPlanGrid data={parsed} />
      </div>
    );
  }

  if (parsed && isChangeProposalData(parsed)) {
    return (
      <div className={cn("space-y-2", className)}>
        <ChangeProposalCard data={parsed} />
      </div>
    );
  }

  return (
    <div className={cn("prose prose-sm dark:prose-invert max-w-none", className)}>
      {content.split("\n").map((line, i) => (
        <p key={i} className={i > 0 ? "mt-2" : ""}>
          {renderMarkdownLine(line, i)}
        </p>
      ))}
    </div>
  );
}
