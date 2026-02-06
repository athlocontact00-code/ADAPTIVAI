"use client";

import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface SeasonNoBlocksProps {
  onAutoCreateBlocks: () => void;
}

export function SeasonNoBlocks({ onAutoCreateBlocks }: SeasonNoBlocksProps) {
  return (
    <div className="rounded-xl border border-dashed border-border/50 bg-muted/5 p-8">
      <div className="flex flex-col items-center text-center">
        <p className="text-sm text-muted-foreground max-w-sm">
          No blocks yet. Auto-generate a block structure from your season dates and constraints.
        </p>
        <Button
          onClick={onAutoCreateBlocks}
          variant="outline"
          size="sm"
          className="mt-4 gap-2"
        >
          <Sparkles className="h-4 w-4" />
          Auto-Create Blocks
        </Button>
      </div>
      <div className="mt-6 flex gap-2 overflow-hidden">
        {["BASE", "BUILD", "PEAK", "TAPER"].map((_, i) => (
          <Skeleton
            key={i}
            className={cn(
              "h-16 flex-1 rounded-lg border-l-4",
              i === 0 && "border-l-blue-500/30",
              i === 1 && "border-l-orange-500/30",
              i === 2 && "border-l-red-500/30",
              i === 3 && "border-l-emerald-500/30"
            )}
          />
        ))}
      </div>
    </div>
  );
}
