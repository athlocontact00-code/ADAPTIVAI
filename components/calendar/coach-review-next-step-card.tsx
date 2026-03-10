import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getCoachReviewNextStepCopy } from "@/lib/product/coach-review-next-step";
import type { CalendarCoachReviewContext } from "@/lib/product/calendar-coach-review";
import { buildResolvedDashboardCoachReviewUrl } from "@/lib/product/coach-review-context";
import { cn } from "@/lib/utils";

export function CoachReviewNextStepCard(props: {
  context: CalendarCoachReviewContext;
  isToday: boolean;
  onPrimaryAction: () => void;
  className?: string;
  compact?: boolean;
}) {
  const copy = getCoachReviewNextStepCopy({
    isToday: props.isToday,
    title: props.context.title,
  });
  const resolvedDashboardHref = buildResolvedDashboardCoachReviewUrl({
    suggestionId: props.context.suggestionId,
    contextDate: props.context.contextDate,
  });

  return (
    <div
      className={cn(
        "rounded-card border border-emerald-500/20 bg-emerald-500/5",
        props.compact ? "p-3" : "p-3.5",
        props.className
      )}
    >
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-sm font-medium text-foreground">
          <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          {copy.title}
        </div>
        <div className="text-xs text-muted-foreground">{copy.description}</div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" className="h-7 text-xs" onClick={props.onPrimaryAction}>
            {copy.primaryLabel}
          </Button>
          {copy.secondaryLabel ? (
            <Button asChild size="sm" variant="outline" className="h-7 text-xs">
              <Link href={resolvedDashboardHref}>{copy.secondaryLabel}</Link>
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
