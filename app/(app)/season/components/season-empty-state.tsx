"use client";

import { Sparkles, Calendar, Layers } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface SeasonEmptyStateProps {
  onCreateManual: () => void;
  onAutoCreate: () => void;
}

export function SeasonEmptyState({ onCreateManual, onAutoCreate }: SeasonEmptyStateProps) {
  return (
    <div className="flex min-h-[520px] flex-col items-center justify-center px-4">
      <Card className="w-full max-w-2xl overflow-hidden border-border/50 bg-card/80 shadow-sm">
        <CardContent className="p-8 md:p-10">
          <div className="flex flex-col items-center text-center">
            <div className="mb-6 inline-flex h-16 w-16 items-center justify-center rounded-2xl border border-primary/15 bg-primary/5">
              <Layers className="h-8 w-8 text-primary" />
            </div>
            <h2 className="text-2xl font-semibold tracking-tight text-foreground">Season HQ</h2>
            <p className="mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
              Plan your training blocks, set milestones, and track compliance. Create a season manually or
              auto-generate from your goal race.
            </p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <Button onClick={onAutoCreate} size="lg" className="gap-2 shadow-sm">
                <Sparkles className="h-4 w-4" />
                Auto-Create Season
              </Button>
              <Button variant="outline" size="lg" onClick={onCreateManual} className="gap-2">
                <Calendar className="h-4 w-4" />
                Create Manually
              </Button>
            </div>
          </div>

          {/* Mini preview: timeline + sidebar skeleton */}
          <div className="mt-10 grid grid-cols-1 gap-4 lg:grid-cols-3">
            <div className="lg:col-span-2 space-y-3">
              <Skeleton className="h-3 w-24 rounded" />
              <div className="flex gap-2 rounded-lg border border-dashed border-border/50 bg-muted/10 p-3">
                {["BASE", "BUILD", "PEAK", "TAPER"].map((label, i) => (
                  <Skeleton
                    key={label}
                    className={cn(
                      "h-14 flex-1 rounded-lg border-l-4",
                      i === 0 && "border-l-blue-500/50",
                      i === 1 && "border-l-orange-500/50",
                      i === 2 && "border-l-red-500/50",
                      i === 3 && "border-l-emerald-500/50"
                    )}
                  />
                ))}
              </div>
            </div>
            <div className="space-y-3 lg:col-span-1">
              <Skeleton className="h-3 w-28 rounded" />
              <div className="rounded-lg border border-dashed border-border/50 bg-muted/10 p-4 space-y-2">
                <Skeleton className="h-12 w-full rounded" />
                <Skeleton className="h-12 w-full rounded" />
                <Skeleton className="h-8 w-2/3 rounded" />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
