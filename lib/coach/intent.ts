/**
 * Coach intent extraction — single source of truth for sport, date, volume, mode.
 * Used to drive prompt injection and validation so the coach never ignores or overwrites user intent.
 */

import {
  extractCoachIntent,
  resolveIntentDate,
  type CoachIntent,
  type SportIntent,
} from "@/lib/utils/coach-intent";
import { parseSwimMetersFromText } from "@/lib/utils/swim-meters";

export type CoachIntentMode =
  | "generate"
  | "change"
  | "add_to_calendar"
  | "generate_and_add";

/** Action intent for routing: when to generate, when to only save draft, when to skip save. */
export type CoachActionIntent = "GENERATE" | "CHANGE" | "ADD_TO_CALENDAR" | "QUESTION_ONLY";

export type CoachIntentResult = {
  sport: SportIntent | "UNKNOWN";
  targetDateISO: string | null;
  swimMeters: number | null;
  durationMin: number | null;
  mode: CoachIntentMode;
  confidence: number;
  /** Raw constraints for backward compatibility */
  raw: CoachIntent;
};

/**
 * Derive routing action: GENERATE (generate + save), CHANGE (replace existing), ADD_TO_CALENDAR (save last draft only), QUESTION_ONLY (no save).
 */
export function getCoachActionIntent(
  message: string,
  intent: CoachIntentResult
): CoachActionIntent {
  const lower = message.trim().toLowerCase();
  const questionOnly =
    message.length < 120 &&
    /\b(why|how|what|which|dlaczego|jak|co|czy|wyjaśnij|explain)\b/i.test(lower) &&
    !/\b(swim|run|bike|workout|trening|session|add|dodaj|calendar|kalendarz)\b/i.test(lower);
  if (questionOnly) return "QUESTION_ONLY";
  if (intent.mode === "change") return "CHANGE";
  if (intent.mode === "add_to_calendar") return "ADD_TO_CALENDAR";
  if (intent.mode === "generate_and_add" || intent.mode === "generate") return "GENERATE";
  return "GENERATE";
}

/** Parse swim volume: "3500m", "3.5km", "3500 meters", "3km swim". */
function parseSwimVolume(lower: string): number | null {
  const m = lower.match(/\b(\d{2,4})\s*m\b/);
  if (m) return parseInt(m[1], 10);
  const meters = lower.match(/\b(\d{2,4})\s*meters?\b/i);
  if (meters) return parseInt(meters[1], 10);
  const km = lower.match(/\b(\d+(?:[.,]\d+)?)\s*km\b/);
  if (km) {
    const v = parseFloat(km[1].replace(",", "."));
    if (v > 0 && v <= 20) return Math.round(v * 1000);
  }
  return null;
}

/** Parse duration in minutes: "60 min", "1h", "1.5 hours". */
function parseDurationMin(lower: string): number | null {
  const min = lower.match(/\b(\d{1,3})\s*(?:min|minutes?|minut)\b/i);
  if (min) return Math.min(180, Math.max(10, parseInt(min[1], 10)));
  const hr = lower.match(/\b(\d+(?:[.,]\d+)?)\s*h(?:ours?|r)?\b/i);
  if (hr) {
    const v = parseFloat(hr[1].replace(",", "."));
    if (v > 0 && v <= 4) return Math.round(v * 60);
  }
  return null;
}

/** Resolve date from intent constraints or message: today, tomorrow, or ISO. */
function resolveTargetDate(raw: CoachIntent, messageLower: string): string | null {
  const date = raw.constraints?.date;
  if (date && /^\d{4}-\d{2}-\d{2}$/.test(date)) return date;
  if (/\b(tomorrow|jutro|jutrzejszy|na\s+jutro)\b/.test(messageLower)) return resolveIntentDate("tomorrow");
  if (/\b(today|dziś|dzis|na\s+dziś)\b/.test(messageLower)) return resolveIntentDate("today");
  const iso = messageLower.match(/\b(20\d{2}-\d{2}-\d{2})\b/);
  if (iso) return iso[1];
  return date ?? null;
}

/**
 * Extract full coach intent from the latest user message.
 * Single source of truth for: sport, targetDateISO, swimMeters, durationMin, mode.
 */
export function extractCoachIntentFull(
  message: string,
  options?: { defaultSport?: SportIntent | null }
): CoachIntentResult {
  const raw = extractCoachIntent(message);
  const lower = message.trim().toLowerCase();

  let mode: CoachIntentMode = "generate";
  if (raw.action === "ADD_TO_CALENDAR") {
    const hasGeneratePhrase =
      /\b(generate|create|write|give me|rozpisz|napisz|zrób)\b/i.test(message) &&
      (/\b(swim|bike|run|session|workout|trening)\b/i.test(message) ||
        /\b\d+\s*(m|km|min)\b/i.test(message));
    mode = hasGeneratePhrase ? "generate_and_add" : "add_to_calendar";
  } else if (raw.action === "MODIFY_WORKOUT") {
    mode = "change";
  }

  const sportFromMessage = raw.sport !== "UNKNOWN" && raw.sport !== "MIXED" ? raw.sport : options?.defaultSport ?? null;
  const sport: SportIntent | "UNKNOWN" =
    sportFromMessage ?? (options?.defaultSport ?? "UNKNOWN");

  const targetDateISO = resolveTargetDate(raw, lower);
  const swimMeters =
    raw.constraints?.distanceM ?? (sport === "SWIM" ? parseSwimVolume(lower) : null);
  const durationMin = raw.constraints?.durationMin ?? parseDurationMin(lower);

  let confidence = 80;
  if (sport === "UNKNOWN" && !options?.defaultSport) confidence = 60;
  if (mode === "add_to_calendar" && !targetDateISO) confidence = 70;

  return {
    sport,
    targetDateISO,
    swimMeters: swimMeters ?? null,
    durationMin: durationMin ?? null,
    mode,
    confidence,
    raw,
  };
}

export type ValidateWorkoutResult =
  | { valid: true }
  | { valid: false; mismatchReason: string; offByMeters?: number };

/**
 * Validate that the calendar payload matches the user's intent.
 * Used to avoid saving wrong sport/date/volume (e.g. 1800m when user asked 3500m).
 */
export function validateWorkoutMatchesIntent(
  intent: CoachIntentResult,
  payload: { items: Array<{ sport: string; date: string; totalDistanceMeters?: number | null; descriptionMd?: string }> }
): ValidateWorkoutResult {
  if (!payload.items.length) {
    return { valid: false, mismatchReason: "No workout items in payload" };
  }
  const item = payload.items[0];

  if (intent.sport !== "UNKNOWN" && item.sport !== intent.sport) {
    return { valid: false, mismatchReason: `Sport mismatch: user asked for ${intent.sport}, got ${item.sport}` };
  }

  if (intent.targetDateISO && item.date !== intent.targetDateISO) {
    return { valid: false, mismatchReason: `Date mismatch: user asked for ${intent.targetDateISO}, got ${item.date}` };
  }

  if (intent.swimMeters != null && intent.swimMeters > 0 && item.sport === "SWIM") {
    const payloadMeters = getPayloadTotalMeters(item);
    if (payloadMeters == null) {
      return { valid: false, mismatchReason: "Swim workout has no total meters" };
    }
    const offBy = Math.abs(payloadMeters - intent.swimMeters);
    if (offBy > 0) {
      return {
        valid: false,
        mismatchReason: `Swim meters mismatch: user asked ${intent.swimMeters}m, got ${payloadMeters}m`,
        offByMeters: offBy,
      };
    }
  }

  return { valid: true };
}

function getPayloadTotalMeters(
  item: { totalDistanceMeters?: number | null; descriptionMd?: string }
): number | null {
  if (typeof item.totalDistanceMeters === "number") return item.totalDistanceMeters;
  if (item.descriptionMd) return parseSwimMetersFromText(item.descriptionMd);
  return null;
}
