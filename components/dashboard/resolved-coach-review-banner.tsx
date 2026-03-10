import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { ResolvedCoachReviewSummary } from "@/lib/services/resolved-coach-review.service";
import {
  getCoachReviewInCalendarLabel,
  getCoachReviewInCoachLabel,
} from "@/lib/product/coach-review-copy";

export function ResolvedCoachReviewBanner(props: {
  review: ResolvedCoachReviewSummary;
  isToday: boolean;
  onOpenTodayDecision: () => void;
  onDismiss: () => void;
}) {
  return (
    <Card className="border-emerald-500/20 bg-emerald-500/5">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start gap-2">
          <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-500" />
          <div className="min-w-0">
            <div className="text-sm font-medium text-foreground">Coach review completed</div>
            <div className="text-sm text-foreground/90">{props.review.title}</div>
            <div className="text-xs text-muted-foreground">{props.review.summary}</div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {props.isToday ? (
            <Button size="sm" className="h-7 text-xs" onClick={props.onOpenTodayDecision}>
              Open Today Decision
            </Button>
          ) : props.review.calendarHref ? (
            <Button asChild size="sm" className="h-7 text-xs">
              <Link href={props.review.calendarHref}>{getCoachReviewInCalendarLabel()}</Link>
            </Button>
          ) : null}
          <Button asChild size="sm" variant="outline" className="h-7 text-xs">
            <Link href={props.review.reviewHref}>{getCoachReviewInCoachLabel()}</Link>
          </Button>
          <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={props.onDismiss}>
            Done
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
