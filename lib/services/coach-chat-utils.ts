import type { PlanRigidity } from "@/lib/services/ai-coach-behavior.service";
import { parseCalendarInsertFromResponse } from "@/lib/schemas/coach-calendar-insert";
import { parseWorkoutFromText, parsedWorkoutToPayload, sanitizeCoachText } from "@/lib/coach/workout-parser";

export function startOfLocalDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function endExclusiveOfLocalDay(d: Date): Date {
  const x = startOfLocalDay(d);
  x.setDate(x.getDate() + 1);
  return x;
}

export function parseCoachPlanRigidity(value: string | null): PlanRigidity {
  if (
    value === "LOCKED_TODAY" ||
    value === "LOCKED_1_DAY" ||
    value === "LOCKED_2_DAYS" ||
    value === "LOCKED_3_DAYS" ||
    value === "FLEXIBLE_WEEK"
  ) {
    return value;
  }
  return "LOCKED_1_DAY";
}

export function stripMedicalDiagnosisLanguage(text: string): string {
  const patterns: RegExp[] = [
    /\byou (have|might have|likely have)\b/gi,
    /\bdiagnos(e|is|ing)\b/gi,
    /\bmedical diagnosis\b/gi,
    /\bclinically\b/gi,
  ];

  let out = text;
  for (const re of patterns) out = out.replace(re, "");
  return out;
}

export function isOpenAIQuotaError(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error);
  return (
    msg.includes("insufficient_quota") ||
    msg.includes("You exceeded your current quota") ||
    msg.includes("OpenAI error: 429")
  );
}

export function isTransientLLMError(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error);
  if (/OpenAI error:\s*429\b/.test(msg)) return true;
  if (/OpenAI error:\s*5\d{2}\b/.test(msg)) return true;
  if (/timeout|ETIMEDOUT|ECONNRESET|fetch failed|network/i.test(msg)) return true;
  if (error instanceof TypeError && msg.includes("fetch")) return true;
  return false;
}

export function extractPayloadFromCoachText(text: string): ReturnType<typeof parseCalendarInsertFromResponse> {
  const sanitized = sanitizeCoachText(text);
  const payload = parseCalendarInsertFromResponse(sanitized);
  if (payload && payload.items.length > 0) return payload;
  const parsed = parseWorkoutFromText(sanitized);
  if (parsed) return parsedWorkoutToPayload(parsed);
  return null;
}
