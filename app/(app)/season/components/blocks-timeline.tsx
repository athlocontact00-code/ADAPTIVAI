"use client";

import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { formatHours, formatRange as formatHoursRange } from "@/lib/utils/format";
import type { BlockHQ } from "@/lib/types/season";

const BLOCK_BORDER_COLORS: Record<string, string> = {
  BASE: "border-l-blue-500",
  BUILD: "border-l-orange-500",
  PEAK: "border-l-red-500",
  TAPER: "border-l-emerald-500",
  RECOVERY: "border-l-violet-500",
  CUSTOM: "border-l-muted-foreground/50",
};

function formatRange(start: Date, end: Date): string {
  const s = new Date(start);
  const e = new Date(end);
  const weeks = Math.round((e.getTime() - s.getTime()) / (7 * 24 * 60 * 60 * 1000)) + 1;
  return `${weeks}w • ${s.toLocaleDateString("en-US", { month: "short", day: "numeric" })} – ${e.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;
}

interface BlocksTimelineProps {
  blocks: BlockHQ[];
  seasonStart: Date;
  seasonEnd: Date;
  onBlockClick: (block: BlockHQ) => void;
  selectedBlockId: string | null;
}

export function BlocksTimeline({ blocks, seasonStart, seasonEnd, onBlockClick, selectedBlockId }: BlocksTimelineProps) {
  const totalMs = useMemo(
    () => seasonEnd.getTime() - seasonStart.getTime(),
    [seasonStart, seasonEnd]
  );

  return (
    <div className="space-y-3">
      <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
        Blocks Timeline
      </p>
      <div className="rounded-xl border border-border/50 bg-muted/5 p-3">
        <div className="flex gap-2 overflow-x-auto pb-1">
          {blocks.map((block) => {
            const start = new Date(block.startDate);
            const blockMs = new Date(block.endDate).getTime() - start.getTime();
            const widthPct = totalMs > 0 ? (blockMs / totalMs) * 100 : 20;
            const borderColor = BLOCK_BORDER_COLORS[block.type] ?? BLOCK_BORDER_COLORS.CUSTOM;
            const isSelected = selectedBlockId === block.id;

            return (
              <button
                key={block.id}
                type="button"
                onClick={() => onBlockClick(block)}
                className={cn(
                  "group flex min-w-[128px] flex-col items-start justify-center rounded-lg border-l-4 border bg-muted/30 px-3 py-2.5 text-left transition-all duration-150",
                  "hover:bg-muted/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                  borderColor,
                  isSelected && "ring-2 ring-primary/60 ring-offset-2 ring-offset-background shadow-sm"
                )}
                style={{ width: `max(128px, ${Math.max(15, widthPct)}%)` }}
              >
                <span className="text-xs font-semibold text-foreground">{block.type}</span>
                <span className="mt-0.5 text-[11px] text-muted-foreground leading-tight">
                  {formatRange(new Date(block.startDate), new Date(block.endDate))}
                </span>
                {(block.targetHoursMin != null || block.targetHours != null) && (
                  <span className="mt-1 text-[11px] text-muted-foreground/90">
                    {block.targetHoursMin != null && block.targetHoursMax != null
                      ? formatHoursRange(block.targetHoursMin, block.targetHoursMax, "h") + "/week"
                      : block.targetHours != null
                        ? `${formatHours(block.targetHours)} h/week`
                        : ""}
                  </span>
                )}
                {block.focusLabel && (
                  <span className="mt-0.5 truncate w-full text-[11px] text-muted-foreground/75">
                    {block.focusLabel}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
