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

/** Try to parse JSON, optionally with trailing commas removed. */
function tryParseJson(raw: string): unknown {
  const normalized = raw.replace(/,(\s*[}\]])/g, "$1").trim();
  try {
    return JSON.parse(normalized) as unknown;
  } catch {
    try {
      return JSON.parse(raw) as unknown;
    } catch {
      return null;
    }
  }
}

/** Normalize LLM output to CalendarInsertPayload (accept descriptionMarkdown, string durationMin). */
function normalizeToPayload(parsed: unknown): CalendarInsertPayload | null {
  if (parsed == null || typeof parsed !== "object" || !("items" in parsed) || !Array.isArray((parsed as { items?: unknown }).items)) {
    return null;
  }
  const obj = parsed as { calendarInsert?: unknown; mode?: string; items: unknown[] };
  const items: CalendarInsertItem[] = [];
  for (const it of obj.items) {
    if (it == null || typeof it !== "object") continue;
    const i = it as Record<string, unknown>;
    const date = typeof i.date === "string" ? i.date : null;
    const sport = typeof i.sport === "string" ? i.sport.toUpperCase() : null;
    const title = typeof i.title === "string" ? i.title : null;
    if (!date || !sport || !title || !/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
    if (!["SWIM", "BIKE", "RUN", "STRENGTH"].includes(sport)) continue;
    const durationMin = typeof i.durationMin === "number" ? i.durationMin : typeof i.durationMin === "string" ? parseInt(i.durationMin, 10) : 60;
    const descriptionMd = typeof i.descriptionMd === "string" ? i.descriptionMd : typeof i.descriptionMarkdown === "string" ? i.descriptionMarkdown : title;
    items.push({
      date,
      sport: sport as "SWIM" | "BIKE" | "RUN" | "STRENGTH",
      title,
      durationMin: Number.isFinite(durationMin) && durationMin >= 1 ? durationMin : 60,
      descriptionMd: descriptionMd || title,
      prescriptionJson: (i.prescriptionJson && typeof i.prescriptionJson === "object") ? (i.prescriptionJson as Record<string, unknown>) : { steps: [] },
      totalDistanceMeters: typeof i.totalDistanceMeters === "number" ? i.totalDistanceMeters : undefined,
    });
  }
  if (items.length === 0) return null;
  return {
    calendarInsert: true,
    mode: obj.mode === "draft" ? "draft" : "final",
    items,
  };
}

/**
 * Extract and parse the calendar insert JSON from coach LLM response.
 * Supports:
 * - <WORKOUT_JSON>{ "title", "sport", "date", "totalMinutes", "descriptionMarkdown" }</WORKOUT_JSON>
 * - ```json { "calendarInsert": true, "mode", "items": [...] } ``` (tries all code blocks, last first)
 * - Inline { "calendarInsert": true ... }
 * Accepts descriptionMarkdown, string durationMin, trailing commas.
 */
export function parseCalendarInsertFromResponse(responseText: string): CalendarInsertPayload | null {
  const trimmed = responseText.trim();

  // 1) <WORKOUT_JSON>...</WORKOUT_JSON>
  const workoutJsonBlock = trimmed.match(/<WORKOUT_JSON>\s*([\s\S]*?)<\/WORKOUT_JSON>/i);
  if (workoutJsonBlock) {
    const parsed = tryParseJson(workoutJsonBlock[1].trim());
    if (parsed) {
      const result = workoutJsonItemSchema.safeParse(parsed);
      if (result.success) return payloadFromWorkoutJson(result.data);
    }
  }

  // 2) All ``` ... ``` blocks (try last first — calendar block is often last)
  const codeBlocks = [...trimmed.matchAll(/```(?:json)?\s*([\s\S]*?)```/g)];
  for (let i = codeBlocks.length - 1; i >= 0; i--) {
    const raw = codeBlocks[i][1].trim();
    const parsed = tryParseJson(raw);
    if (parsed) {
      const strict = calendarInsertPayloadSchema.safeParse(parsed);
      if (strict.success) return strict.data;
      const normalized = normalizeToPayload(parsed);
      if (normalized) return normalized;
    }
  }

  // 3) Inline { "calendarInsert": true ... } or any JSON with "items" array
  const inline = trimmed.match(/\{\s*["']?calendarInsert["']?\s*:\s*true[\s\S]*\}/);
  if (inline) {
    const parsed = tryParseJson(inline[0]);
    if (parsed) {
      const strict = calendarInsertPayloadSchema.safeParse(parsed);
      if (strict.success) return strict.data;
      const normalized = normalizeToPayload(parsed);
      if (normalized) return normalized;
    }
  }

  // 4) Any JSON object containing "items" with at least one workout-like object
  const anyJson = trimmed.match(/\{\s*[\s\S]*"items"\s*:\s*\[[\s\S]*\]\s*\}/);
  if (anyJson) {
    const parsed = tryParseJson(anyJson[0]);
    if (parsed) {
      const normalized = normalizeToPayload(parsed);
      if (normalized) return normalized;
    }
  }

  return null;
}
