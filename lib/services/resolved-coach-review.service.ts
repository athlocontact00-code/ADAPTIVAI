import { db } from "@/lib/db";
import { buildResolvedCoachReviewUrl } from "@/lib/product/coach-review-context";
import { getCoachSuggestionCalendarHref } from "@/lib/product/coach-pending-changes";

export type ResolvedCoachReviewSummary = {
  suggestionId: string;
  contextDate: string;
  title: string;
  summary: string;
  reviewHref: string;
  calendarHref: string | null;
};

export async function getResolvedCoachReviewSummary(
  userId: string,
  suggestionId: string
): Promise<ResolvedCoachReviewSummary | null> {
  const suggestion = await db.coachSuggestion.findFirst({
    where: {
      id: suggestionId,
      userId,
      status: { not: "PENDING" },
    },
    select: {
      id: true,
      title: true,
      summary: true,
      contextDate: true,
      payload: true,
    },
  });

  if (!suggestion) return null;

  const contextDate = suggestion.contextDate.toISOString().slice(0, 10);
  let payload: unknown = null;
  try {
    payload = suggestion.payload ? JSON.parse(suggestion.payload) : null;
  } catch {
    payload = null;
  }

  return {
    suggestionId: suggestion.id,
    contextDate,
    title: suggestion.title,
    summary: suggestion.summary,
    reviewHref: buildResolvedCoachReviewUrl({
      suggestionId: suggestion.id,
      contextDate,
    }),
    calendarHref: getCoachSuggestionCalendarHref(payload, contextDate),
  };
}
