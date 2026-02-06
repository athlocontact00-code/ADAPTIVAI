"use client";

import { ReactNode } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertCircle, BarChart3 } from "lucide-react";
import { cn } from "@/lib/utils";
import { EmptyState, type EmptyStateCta, SectionHeader } from "@/components/ui-extensions";

type ChartCardState = "loading" | "empty" | "insufficient" | "error" | "ready";

interface ChartCardProps {
  title: string;
  subtitle?: string;
  state: ChartCardState;
  height?: number;
  children?: ReactNode;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyCta?: EmptyStateCta;
  note?: { tone?: "neutral" | "warning" | "danger" | "info" | "success"; text: string } | null;
  errorMessage?: string;
  className?: string;
}

export function ChartCard({
  title,
  subtitle,
  state,
  height = 280,
  children,
  emptyTitle = "No data yet",
  emptyDescription = "Add 2–3 workouts to unlock trends.",
  emptyCta = { label: "Add workout", href: "/calendar" },
  errorMessage = "Unable to load chart data",
  note = null,
  className = "",
}: ChartCardProps) {
  const noteTone = note?.tone ?? "neutral";
  const noteCls =
    noteTone === "warning"
      ? "border-warning-subtle bg-warning-subtle text-warning"
      : noteTone === "danger"
        ? "border-danger-subtle bg-danger-subtle text-danger"
        : noteTone === "info"
          ? "border-info-subtle bg-info-subtle text-info"
          : noteTone === "success"
            ? "border-success-subtle bg-success-subtle text-success"
            : "border-border/40 bg-muted/20 text-muted-foreground";

  return (
    <div className={cn(
      "rounded-card border border-border/50 bg-card overflow-hidden transition-all duration-150 hover:border-border/80",
      className
    )}>
      <div className="p-5 pb-3">
        <SectionHeader
          title={title}
          subtitle={subtitle}
          right={
            note ? (
              <div className={cn("rounded-pill border px-2 py-0.5 text-2xs font-medium", noteCls)}>
                {note.text}
              </div>
            ) : null
          }
          className="mb-0"
        />
      </div>
      <div className="px-5 pb-5">
        <div style={{ height: `${height}px` }} className="w-full">
          {state === "loading" && (
            <div className="h-full flex items-center justify-center">
              <div className="space-y-3 w-full">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-32 w-full" />
                <Skeleton className="h-4 w-1/2" />
              </div>
            </div>
          )}

          {state === "empty" && (
            <EmptyState
              title={emptyTitle}
              description={emptyDescription}
              cta={emptyCta}
              icon={<BarChart3 className="h-5 w-5 text-muted-foreground/70" />}
            />
          )}

          {state === "error" && (
            <EmptyState
              title="Chart unavailable"
              description={errorMessage}
              icon={<AlertCircle className="h-5 w-5 text-destructive/80" />}
            />
          )}

          {(state === "ready" || state === "insufficient") && children}
        </div>
      </div>
    </div>
  );
}
