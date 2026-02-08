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

/**
 * Extract and parse the calendar insert JSON from coach LLM response.
 * Expects a fenced block like:
 *   ```json
 *   { "calendarInsert": true, "mode": "draft", "items": [...] }
 *   ```
 * or a single line containing the object. No trailing commas or comments.
 */
export function parseCalendarInsertFromResponse(responseText: string): CalendarInsertPayload | null {
  const trimmed = responseText.trim();

  // Try ```json ... ``` block first
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

  // Try inline { "calendarInsert": true ... }
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
