import type { CoachIntentResult, ValidateWorkoutResult } from "@/lib/coach/intent";
import { validateWorkoutMatchesIntent } from "@/lib/coach/intent";
import { ensureExactTotalMeters } from "@/lib/coach/swim-utils";
import type { CalendarInsertPayload } from "@/lib/schemas/coach-calendar-insert";

export function buildSportCorrectionPrompt(
  userPrompt: string,
  expectedSport: string,
  detectedSport: string
): string {
  return `${userPrompt}\n\n[Correction: The user asked for ${expectedSport}. Your reply was about ${detectedSport}. Reply again with a prescription only for ${expectedSport}.]`;
}

export function buildSwimMetersCorrectionPrompt(userPrompt: string): string {
  return `${userPrompt}\n\n[Correction: Rewrite the swim plan with explicit meters for every set (e.g. "400m", "4×50m") and include a line "TOTAL METERS: <sum>" at the end.]`;
}

export function buildStructureCorrectionPrompt(params: {
  userPrompt: string;
  expectedSport?: string | null;
  detectedSport?: string | null;
  missing: string[];
}): string {
  const sportForRetry = params.expectedSport ?? params.detectedSport ?? "the requested sport";
  return `${params.userPrompt}\n\n[Correction: Rewrite the workout as a complete, save-ready ${sportForRetry} session. Missing elements: ${params.missing.join(", ")}. Include clear Warm-up, Main set, Cool-down sections and explicit targets.]`;
}

export function maybeRepairSwimPayloadToIntent(params: {
  intent: CoachIntentResult;
  payload: CalendarInsertPayload;
  validation: ValidateWorkoutResult;
}): {
  payload: CalendarInsertPayload;
  validation: ValidateWorkoutResult;
  repaired: boolean;
} {
  const { intent, payload, validation } = params;
  if (
    validation.valid ||
    validation.offByMeters == null ||
    validation.offByMeters > 300 ||
    intent.swimMeters == null ||
    intent.swimMeters <= 0 ||
    payload.items.length === 0
  ) {
    return { payload, validation, repaired: false };
  }

  const item = payload.items[0];
  const fixedMd = ensureExactTotalMeters(item.descriptionMd ?? "", intent.swimMeters);
  const repairedPayload: CalendarInsertPayload = {
    ...payload,
    items: [{ ...item, descriptionMd: fixedMd, totalDistanceMeters: intent.swimMeters }],
  };
  return {
    payload: repairedPayload,
    validation: validateWorkoutMatchesIntent(intent, repairedPayload),
    repaired: true,
  };
}

export function shouldRetryCalendarPayloadAsStrictJson(validation: ValidateWorkoutResult): boolean {
  return !validation.valid && (validation.offByMeters == null || validation.offByMeters > 300);
}

export function buildStrictJsonCorrectionPrompt(
  userPrompt: string,
  coachIntent: Pick<CoachIntentResult, "targetDateISO" | "sport" | "swimMeters">
): string {
  return `${userPrompt}\n\n[Correction: Output ONLY a JSON code block. REQUIRED: date=${coachIntent.targetDateISO ?? "today"}, sport=${coachIntent.sport}, totalMeters=${coachIntent.swimMeters ?? "match requested"}. No other text.]`;
}

export function shouldBlockSwimSaveAfterRetry(
  intent: Pick<CoachIntentResult, "swimMeters">,
  validation: ValidateWorkoutResult
): boolean {
  return intent.swimMeters != null && intent.swimMeters > 0 && !validation.valid;
}

export function buildSwimPoolLengthClarification(targetMeters: number): string {
  return `Nie mogę stworzyć treningu na ${targetMeters} m — podaj długość basenu (25 m lub 50 m), wtedy dopasuję dystans.`;
}
