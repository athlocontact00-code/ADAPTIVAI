/**
 * Premium quality gates for AI Coach output.
 * Used to validate sport correctness and swim distance completeness.
 */

import { parseSwimMetersFromText } from "./swim-meters";

const SPORT_KEYWORDS: Record<string, RegExp> = {
  SWIM: /\b(swim|swimming|pool|pływ|basen|meters?|m\s*easy|main set|drill|catch-up)\b/i,
  RUN: /\b(run|running|jog|bieg|km|pace|strides?|cadence)\b/i,
  BIKE: /\b(bike|cycling|ride|rower|ftp|watts?|cadence|spin)\b/i,
  STRENGTH: /\b(strength|gym|siłownia|lift|squat|rep[s]?|sets?)\b/i,
};

/**
 * Detect which sport the response text describes (first strong match).
 */
export function detectSportInResponse(text: string): "SWIM" | "RUN" | "BIKE" | "STRENGTH" | null {
  if (!text || typeof text !== "string") return null;
  const trimmed = text.slice(0, 3000);
  let best: { sport: keyof typeof SPORT_KEYWORDS; score: number } | null = null;
  for (const [sport, re] of Object.entries(SPORT_KEYWORDS)) {
    const matches = trimmed.match(re);
    const score = matches ? matches.length : 0;
    if (score > 0 && (!best || score > best.score)) {
      best = { sport: sport as keyof typeof SPORT_KEYWORDS, score };
    }
  }
  return (best?.sport ?? null) as "SWIM" | "RUN" | "BIKE" | "STRENGTH" | null;
}

/**
 * Validate that the response matches the expected sport (e.g. user's primary or requested).
 * Returns true if valid or expectedSport is not provided.
 */
export function validateSportCorrectness(
  responseText: string,
  expectedSport: string | null | undefined
): { valid: boolean; detectedSport: string | null } {
  const detected = detectSportInResponse(responseText);
  if (!expectedSport) return { valid: true, detectedSport: detected };
  const expected = expectedSport.toUpperCase();
  if (expected !== "SWIM" && expected !== "RUN" && expected !== "BIKE" && expected !== "STRENGTH") {
    return { valid: true, detectedSport: detected };
  }
  const valid = detected === expected;
  return { valid, detectedSport: detected };
}

/**
 * Validate that a SWIM plan includes distances and total meters.
 * Returns true if text has TOTAL METERS line or parseSwimMetersFromText returns a number.
 */
export function validateSwimMetersCompleteness(responseText: string): boolean {
  if (!responseText || typeof responseText !== "string") return false;
  if (/\bTOTAL\s*METERS?\b[^0-9\n]{0,10}\d+/i.test(responseText)) return true;
  const total = parseSwimMetersFromText(responseText);
  return total != null && total > 0;
}

export type CoachWorkoutStructureValidation = {
  valid: boolean;
  detectedSport: "SWIM" | "RUN" | "BIKE" | "STRENGTH" | null;
  missing: string[];
};

/**
 * Validate that a generated workout contains the minimum structure needed to be useful and save-ready.
 * This is intentionally format-tolerant: it checks for sections and intensity cues, not exact markdown layout.
 */
export function validateWorkoutStructure(
  responseText: string,
  expectedSport?: string | null
): CoachWorkoutStructureValidation {
  if (!responseText || typeof responseText !== "string") {
    return { valid: false, detectedSport: null, missing: ["workout content"] };
  }

  const text = responseText.trim();
  const detectedSport = detectSportInResponse(text);
  const sport =
    expectedSport === "SWIM" || expectedSport === "RUN" || expectedSport === "BIKE" || expectedSport === "STRENGTH"
      ? expectedSport
      : detectedSport;

  const missing: string[] = [];
  const hasWarmup = /\b(warm[\s-]?up|rozgrzewka)\b/i.test(text);
  const hasMainSet = /\b(main set|main|główn[aey]|cz[eę][śs]ć gł[oó]wn[aey])\b/i.test(text);
  const hasCooldown = /\b(cool[\s-]?down|schłodzenie|cool down)\b/i.test(text);
  const hasTargets = /\b(targets?|pace|rpe|ftp|watts?|hr|heart rate|cadence|threshold|tempo|easy|zone\s*[1-5]|z[1-5])\b/i.test(
    text
  );
  const hasSetsReps = /\b\d+\s*[x×]\s*\d+\b/i.test(text);
  const hasRest = /\b(rest|recover(?:y)?|przerwa)\s*\d+/i.test(text) || /\b\d+\s*s\b/i.test(text);
  const hasCore = /\b(core|dead bug|pallof|plank|anti-rotation|anti-extension)\b/i.test(text);

  if (!hasWarmup) missing.push("warm-up");
  if (!hasMainSet) missing.push("main set");
  if (!hasCooldown) missing.push("cool-down");

  if (sport === "SWIM") {
    if (!validateSwimMetersCompleteness(text)) missing.push("explicit swim meters");
    if (!hasSetsReps && !/\b\d+\s*m\b/i.test(text)) missing.push("structured swim reps or set distances");
    if (!hasTargets) missing.push("pace/RPE targets");
    if (!hasRest) missing.push("rest cues");
  } else if (sport === "RUN" || sport === "BIKE") {
    if (!hasTargets) missing.push("intensity targets");
  } else if (sport === "STRENGTH") {
    if (!hasCore) missing.push("core section");
    if (!hasSetsReps) missing.push("sets x reps");
    if (!/\b(rpe|tempo|rest)\b/i.test(text)) missing.push("RPE/tempo/rest cues");
  } else {
    if (!hasTargets) missing.push("intensity targets");
  }

  return {
    valid: missing.length === 0,
    detectedSport,
    missing,
  };
}

/** Derive expected sport from user message or primary sport. "I am a swimmer" -> SWIM. */
export function deriveExpectedSport(
  message: string,
  sportPrimary: string | null
): "SWIM" | "RUN" | "BIKE" | "STRENGTH" | null {
  const lower = message.toLowerCase();
  if (/\b(swim|swimmer|pływ|pływak|plyw|pool|basen)\b/.test(lower)) return "SWIM";
  if (/\b(run|runner|bieg|biegacz|jog)\b/.test(lower)) return "RUN";
  if (/\b(bike|cyclist|rower|cycling)\b/.test(lower)) return "BIKE";
  if (/\b(strength|siłownia|silownia|gym)\b/.test(lower)) return "STRENGTH";
  const primary = (sportPrimary ?? "").toUpperCase();
  if (primary === "SWIM" || primary === "RUN" || primary === "BIKE" || primary === "STRENGTH") return primary;
  return null;
}
