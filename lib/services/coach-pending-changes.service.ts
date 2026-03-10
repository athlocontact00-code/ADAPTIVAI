import { db } from "@/lib/db";
import {
  summarizeCoachPendingChanges,
  type CoachPendingChangeSummary,
} from "@/lib/product/coach-pending-changes";

export async function getCoachPendingChangesSummary(
  userId: string,
  contextDate: Date
): Promise<CoachPendingChangeSummary | null> {
  const normalizedDate = new Date(contextDate);
  normalizedDate.setHours(0, 0, 0, 0);

  const suggestions = await db.coachSuggestion.findMany({
    where: {
      userId,
      contextDate: normalizedDate,
      status: "PENDING",
    },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      title: true,
      summary: true,
      scope: true,
      contextDate: true,
      payload: true,
    },
  });

  return summarizeCoachPendingChanges(
    suggestions.map((suggestion) => ({
      ...suggestion,
      contextDate: suggestion.contextDate.toISOString().slice(0, 10),
    }))
  );
}
