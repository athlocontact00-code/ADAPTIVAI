import Link from "next/link";
import { ArrowRight, Pin } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { CalendarCoachReviewContext } from "@/lib/product/calendar-coach-review";
import {
  getCalendarCoachReviewHeaderLabel,
  getCoachReviewInCoachLabel,
} from "@/lib/product/coach-review-copy";
import { cn } from "@/lib/utils";

export function CoachReviewContextCard(props: {
  context: CalendarCoachReviewContext;
  className?: string;
  compact?: boolean;
}) {
  const { context, compact = false } = props;

  return (
    <div
      className={cn(
        "rounded-card border border-primary/20 bg-primary/5",
        compact ? "p-3" : "p-3.5",
        props.className
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="inline-flex items-center gap-1 text-xs font-medium text-foreground">
              <Pin className="h-3.5 w-3.5 text-primary" />
              {getCalendarCoachReviewHeaderLabel()}
            </span>
            <Badge variant="outline" className="h-5 border-primary/20 bg-background/70 px-1.5 text-[10px]">
              {context.contextDate}
            </Badge>
          </div>
          <div className="text-sm font-medium text-foreground">{context.title}</div>
          <div className="text-xs text-muted-foreground">{context.summary}</div>
        </div>
        <Button asChild size="sm" variant="outline" className="h-7 shrink-0 text-xs">
          <Link href={context.reviewHref}>
            {getCoachReviewInCoachLabel()}
            <ArrowRight className="ml-1 h-3 w-3" />
          </Link>
        </Button>
      </div>
    </div>
  );
}
