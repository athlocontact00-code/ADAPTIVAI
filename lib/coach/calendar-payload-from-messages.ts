/**
 * Pure helper: extract calendar insert payload from assistant messages (newest first).
 * Used by coach-draft insertWorkoutFromCoachResponse when sportFilter is set.
 */

import type { CalendarInsertPayload } from "@/lib/schemas/coach-calendar-insert";
import { parseCalendarInsertFromResponse } from "@/lib/schemas/coach-calendar-insert";
import type { SportIntent } from "@/lib/utils/coach-intent";
import { sanitizeCoachText, parseWorkoutFromText, parsedWorkoutToPayload } from "./workout-parser";

const MAX_MESSAGES_TO_SCAN = 20;

/**
 * From a list of assistant message texts (newest first), find the first payload that matches optional sportFilter and optional dateFilter (YYYY-MM-DD).
 * Tries JSON then text parser per message. When dateFilter is set, prefers payload whose first item has that date.
 */
export function extractPayloadFromAssistantMessages(
  assistantMessages: string[],
  sportFilter?: SportIntent,
  dateFilter?: string
): CalendarInsertPayload | null {
  const toScan = assistantMessages.slice(0, MAX_MESSAGES_TO_SCAN);
  let firstSportMatch: CalendarInsertPayload | null = null;
  for (const raw of toScan) {
    const sanitized = sanitizeCoachText(raw);
    let payload = parseCalendarInsertFromResponse(sanitized);
    if (!payload || payload.items.length === 0) {
      const parsed = parseWorkoutFromText(sanitized);
      if (parsed) payload = parsedWorkoutToPayload(parsed);
    }
    if (payload && payload.items.length > 0) {
      const sport = payload.items[0].sport;
      const itemDate = payload.items[0].date;
      if (sportFilter && sport !== sportFilter) continue;
      if (dateFilter && itemDate === dateFilter) return payload;
      if (dateFilter && !firstSportMatch) firstSportMatch = payload;
      if (!dateFilter) return payload;
    }
  }
  return dateFilter ? firstSportMatch : null;
}
