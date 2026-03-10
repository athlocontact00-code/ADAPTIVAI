import { formatLocalDateInput } from "@/lib/utils";

export type CalendarCoachReviewContext = {
  suggestionId: string;
  contextDate: string;
  title: string;
  summary: string;
  reviewHref: string;
};

export function shouldShowCalendarCoachReviewContext(params: {
  context: CalendarCoachReviewContext | null;
  selectedDate: Date;
}): boolean {
  if (!params.context) return false;
  return params.context.contextDate === formatLocalDateInput(params.selectedDate);
}

export function clearCalendarCoachReviewContext(
  current: CalendarCoachReviewContext | null,
  actedDate: Date | string
): CalendarCoachReviewContext | null {
  if (!current) return null;
  const actedDateKey =
    typeof actedDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(actedDate)
      ? actedDate
      : formatLocalDateInput(new Date(actedDate));
  return current.contextDate === actedDateKey ? null : current;
}
