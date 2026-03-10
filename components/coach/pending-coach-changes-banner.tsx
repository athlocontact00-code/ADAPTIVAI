import Link from "next/link";
import { ArrowRight, Pin } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  getCoachPendingChangesTitle,
  type CoachPendingChangeSummary,
} from "@/lib/product/coach-pending-changes";
import {
  getCoachReviewInCalendarLabel,
  getCoachReviewInCoachLabel,
} from "@/lib/product/coach-review-copy";
import { cn } from "@/lib/utils";

export function PendingCoachChangesBanner(props: {
  summary: CoachPendingChangeSummary;
  className?: string;
  compact?: boolean;
  href?: string | null;
  ctaLabel?: string;
  showCalendarLink?: boolean;
}) {
  const {
    summary,
    compact = false,
    href = summary.reviewHref,
    ctaLabel = getCoachReviewInCoachLabel(),
    showCalendarLink = false,
  } = props;

  return (
    <div
      className={cn(
        "rounded-control border border-primary/15 bg-primary/5",
        compact ? "p-3" : "p-3.5",
        props.className
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="inline-flex items-center gap-1 text-xs font-medium text-foreground">
              <Pin className="h-3.5 w-3.5 text-primary" />
              {getCoachPendingChangesTitle(summary.count)}
            </span>
            {summary.scopes.map((scope) => (
              <Badge key={scope} variant="outline" className="h-5 border-primary/20 bg-background/70 px-1.5 text-[10px]">
                {scope}
              </Badge>
            ))}
          </div>
          <div className="text-sm text-foreground/90">{summary.primaryTitle}</div>
          <div className="text-xs text-muted-foreground">{summary.primarySummary}</div>
        </div>

        <div className="flex shrink-0 gap-2">
          {showCalendarLink && summary.calendarHref ? (
            <Button asChild size="sm" variant="secondary" className="h-7 text-xs">
              <Link href={summary.calendarHref}>{getCoachReviewInCalendarLabel()}</Link>
            </Button>
          ) : null}
          {href ? (
            <Button asChild size="sm" variant="outline" className="h-7 text-xs">
              <Link href={href}>
                {ctaLabel}
                <ArrowRight className="ml-1 h-3 w-3" />
              </Link>
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
