/**
 * Robust workout extraction from coach text (markdown/labeled/heuristic).
 * Used when calendarInsert JSON block is missing so "add to calendar" still works.
 */

import type { CalendarInsertPayload } from "@/lib/schemas/coach-calendar-insert";
import { parseSwimMetersFromText } from "@/lib/utils/swim-meters";

const JUNK_PATTERNS = [
  /this is because the recent signals[\s\S]*?\./gi,
  /this is because[\s\S]*?\./gi,
  /recent signals and plan summary[\s\S]*?\./gi,
  /^\s*This is because[^\n]*$/gim,
  /^\s*Odd\s+This is because[^\n]*$/gim,
];

/**
 * Remove junk lines and normalize whitespace. Run before parsing and before displaying.
 */
export function sanitizeCoachText(text: string): string {
  let out = text;
  for (const re of JUNK_PATTERNS) {
    out = out.replace(re, "");
  }
  out = out
    .replace(/\n{3,}/g, "\n\n")
    .replace(/\s+$/gm, "")
    .trim();
  return out;
}

export type ParsedWorkout = {
  title: string;
  sport: "SWIM" | "BIKE" | "RUN" | "STRENGTH";
  date?: string;
  totalMinutes?: number;
  descriptionMarkdown: string;
  totalDistanceM?: number;
};

function todayISO(): string {
  const d = new Date();
  return d.toISOString().slice(0, 10);
}

function inferSport(text: string): "SWIM" | "BIKE" | "RUN" | "STRENGTH" {
  const lower = text.toLowerCase();
  if (/\b(swim|plywanie|pływanie|pool)\b/.test(lower)) return "SWIM";
  if (/\b(bike|rower|cycling|turbo)\b/.test(lower)) return "BIKE";
  if (/\b(strength|silownia|siłownia|weights|gym)\b/.test(lower)) return "STRENGTH";
  return "RUN";
}

/** Format A: --- Title: ... Sport: ... Total: ... --- */
function parseCalendarBlock(text: string): ParsedWorkout | null {
  const block = text.match(/---\s*\n([\s\S]*?)\n---/);
  if (!block) return null;
  const inner = block[1];
  const title = inner.match(/(?:^|\n)\s*Title:\s*(.+?)(?:\n|$)/im)?.[1]?.trim();
  const sportRaw = inner.match(/(?:^|\n)\s*Sport:\s*(.+?)(?:\n|$)/im)?.[1]?.trim()?.toUpperCase();
  const totalRaw = inner.match(/(?:^|\n)\s*Total:\s*(.+?)(?:\n|$)/im)?.[1]?.trim();
  if (!title && !sportRaw) return null;
  const sport =
    sportRaw === "SWIM" || sportRaw === "BIKE" || sportRaw === "RUN" || sportRaw === "STRENGTH"
      ? sportRaw
      : inferSport(inner);
  const titleRes = title || (sport === "SWIM" ? "Swim Session" : sport === "BIKE" ? "Bike Session" : sport === "RUN" ? "Run Session" : "Strength Session");
  const minMatch = totalRaw?.match(/(\d+)\s*(?:min|minutes?|m\b)/i);
  const totalMinutes = minMatch ? parseInt(minMatch[1], 10) : 60;
  return {
    title: titleRes,
    sport,
    totalMinutes,
    descriptionMarkdown: inner.trim(),
    totalDistanceM: undefined,
  };
}

/** Format B: TITLE: / SPORT: / TOTAL TIME: labeled lines (or **TRENING 1: ... ** style) */
function parseLabeledFormat(text: string): ParsedWorkout | null {
  const title =
    text.match(/(?:^|\n)\s*TITLE:\s*(.+?)(?:\n|$)/im)?.[1]?.trim() ||
    text.match(/(?:^|\n)\s*\*\*?(?:TRENING|TRAINING)\s*\d*:?\s*(.+?)\*\*?/im)?.[1]?.trim();
  const sportRaw = text.match(/(?:^|\n)\s*SPORT:\s*(.+?)(?:\n|$)/im)?.[1]?.trim()?.toUpperCase();
  const totalLine = text.match(/(?:^|\n)\s*TOTAL TIME:\s*(.+?)(?:\n|$)/im)?.[1]?.trim();
  const minMatch = (totalLine || text).match(/(\d+)\s*(?:min|minutes?|m\b)/i);
  const totalMinutes = minMatch ? parseInt(minMatch[1], 10) : 60;
  const hasStructure = /\b(MAIN SET|WARM-UP|COOL-DOWN|WARMUP|COOLDOWN|CORE|GOAL)\s*:?\s*\n/im.test(text);
  const hasLabeled = (title || sportRaw) && (totalLine || minMatch || totalMinutes > 0);
  if (!hasStructure && !hasLabeled) return null;
  const sport =
    sportRaw === "SWIM" || sportRaw === "BIKE" || sportRaw === "RUN" || sportRaw === "STRENGTH"
      ? sportRaw
      : inferSport(text);
  const titleRes =
    title ||
    (sport === "SWIM" ? "Swim Session" : sport === "BIKE" ? "Bike Session" : sport === "RUN" ? "Run Session" : "Strength Session");
  return {
    title: titleRes,
    sport,
    totalMinutes,
    descriptionMarkdown: text.trim(),
    totalDistanceM: undefined,
  };
}

/** Format C: Heuristic — sport keyword + numeric training marker */
function parseHeuristic(text: string): ParsedWorkout | null {
  const hasMinutes = /\b(\d{2,3})\s*(?:min|minutes?|m)\b/i.test(text);
  const hasDistance = /\b(\d+(?:[.,]\d+)?)\s*(?:km|m)\b/i.test(text);
  const hasIntervals = /\b\d+\s*[x×]\s*\d+/i.test(text) || /\b(?:rest|przerwa)\s*\d+/i.test(text);
  if (!hasMinutes && !hasDistance && !hasIntervals) return null;
  const sport = inferSport(text);
  // Prefer "min"/"minutes" for duration; bare "m" often means meters (e.g. 400m)
  const minMatch = text.match(/\b(\d+)\s*(?:min|minutes?)\b/i);
  const totalMinutes = minMatch ? parseInt(minMatch[1], 10) : 60;
  const title =
    sport === "SWIM" ? "Swim Session" : sport === "BIKE" ? "Bike Session" : sport === "RUN" ? "Run Session" : "Strength Session";
  return {
    title,
    sport,
    totalMinutes,
    descriptionMarkdown: text.trim(),
    totalDistanceM: undefined,
  };
}

/**
 * Parse workout from coach response text (no JSON block).
 * Tries: calendar block --- ... ---, then labeled TITLE/SPORT/TOTAL TIME, then heuristic.
 */
export function parseWorkoutFromText(text: string): ParsedWorkout | null {
  const sanitized = sanitizeCoachText(text);
  const parsed = parseCalendarBlock(sanitized) ?? parseLabeledFormat(sanitized) ?? parseHeuristic(sanitized);
  if (!parsed) return null;
  return {
    ...parsed,
    date: parsed.date ?? todayISO(),
  };
}

/**
 * Convert a single ParsedWorkout to CalendarInsertPayload (one item).
 * For SWIM, fills totalDistanceMeters from description if not already set (parseSwimMetersFromText).
 */
export function parsedWorkoutToPayload(parsed: ParsedWorkout): CalendarInsertPayload {
  const date = parsed.date ?? todayISO();
  let totalDistanceMeters = parsed.totalDistanceM ?? undefined;
  if (parsed.sport === "SWIM" && totalDistanceMeters == null) {
    const fromText = parseSwimMetersFromText(parsed.descriptionMarkdown);
    if (fromText != null) totalDistanceMeters = fromText;
  }
  return {
    calendarInsert: true,
    mode: "final",
    items: [
      {
        date,
        sport: parsed.sport,
        title: parsed.title,
        durationMin: parsed.totalMinutes ?? 60,
        descriptionMd: parsed.descriptionMarkdown,
        prescriptionJson: { steps: [] },
        totalDistanceMeters,
      },
    ],
  };
}
