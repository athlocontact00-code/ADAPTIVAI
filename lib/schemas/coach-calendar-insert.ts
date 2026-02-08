import { z } from "zod";

/** Sport type for calendar insert (uppercase in JSON). */
const sportEnum = z.enum(["SWIM", "BIKE", "RUN", "STRENGTH"]);

/** Single workout item in the AI calendar insert payload. */
export const calendarInsertItemSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "date must be YYYY-MM-DD"),
  sport: sportEnum,
  title: z.string().min(1),
  durationMin: z.number().int().min(1).default(60),
  descriptionMd: z.string(),
  prescriptionJson: z.record(z.unknown()).default({ steps: [] }),
  /** Total distance in meters (e.g. for swim). */
  totalDistanceMeters: z.number().int().min(0).nullable().optional(),
});

export type CalendarInsertItem = z.infer<typeof calendarInsertItemSchema>;

/** Full JSON block the AI must return when adding workouts to calendar. */
export const calendarInsertPayloadSchema = z.object({
  calendarInsert: z.literal(true),
  mode: z.enum(["draft", "final"]),
  items: z.array(calendarInsertItemSchema).min(1),
});

export type CalendarInsertPayload = z.infer<typeof calendarInsertPayloadSchema>;

/** Optional single-workout wrapper for extraction (e.g. <WORKOUT_JSON>...</WORKOUT_JSON>). */
const workoutJsonItemSchema = z.object({
  title: z.string().min(1),
  sport: z.enum(["SWIM", "BIKE", "RUN", "STRENGTH"]),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "date must be YYYY-MM-DD"),
  totalMinutes: z.number().int().min(1).optional(),
  descriptionMarkdown: z.string().optional(),
});

function payloadFromWorkoutJson(obj: z.infer<typeof workoutJsonItemSchema>): CalendarInsertPayload {
  const durationMin = obj.totalMinutes ?? 60;
  const descriptionMd = obj.descriptionMarkdown ?? obj.title;
  return {
    calendarInsert: true,
    mode: "final",
    items: [
      {
        date: obj.date,
        sport: obj.sport,
        title: obj.title,
        durationMin,
        descriptionMd,
        prescriptionJson: { steps: [] },
        totalDistanceMeters: undefined,
      },
    ],
  };
}

/**
 * Extract and parse the calendar insert JSON from coach LLM response.
 * Supports:
 * - <WORKOUT_JSON>{ "title", "sport", "date", "totalMinutes", "descriptionMarkdown" }</WORKOUT_JSON>
 * - ```json { "calendarInsert": true, "mode", "items": [...] } ```
 * - Inline { "calendarInsert": true ... }
 */
export function parseCalendarInsertFromResponse(responseText: string): CalendarInsertPayload | null {
  const trimmed = responseText.trim();

  // 1) <WORKOUT_JSON>...</WORKOUT_JSON> (single workout wrapper; text before/after allowed)
  const workoutJsonBlock = trimmed.match(/<WORKOUT_JSON>\s*([\s\S]*?)<\/WORKOUT_JSON>/i);
  if (workoutJsonBlock) {
    try {
      const raw = workoutJsonBlock[1].trim();
      const parsed = JSON.parse(raw) as unknown;
      const result = workoutJsonItemSchema.safeParse(parsed);
      if (result.success) return payloadFromWorkoutJson(result.data);
    } catch {
      // fall through
    }
  }

  // 2) ```json ... ``` block
  const jsonBlock = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonBlock) {
    const raw = jsonBlock[1].trim();
    try {
      const parsed = JSON.parse(raw) as unknown;
      const result = calendarInsertPayloadSchema.safeParse(parsed);
      return result.success ? result.data : null;
    } catch {
      return null;
    }
  }

  // 3) Inline { "calendarInsert": true ... }
  const inline = trimmed.match(/\{\s*"calendarInsert"\s*:\s*true[\s\S]*\}/);
  if (inline) {
    try {
      const parsed = JSON.parse(inline[0]) as unknown;
      const result = calendarInsertPayloadSchema.safeParse(parsed);
      return result.success ? result.data : null;
    } catch {
      return null;
    }
  }

  return null;
}
