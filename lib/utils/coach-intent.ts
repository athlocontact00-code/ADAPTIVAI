/**
 * Detect user intents from coach chat message (PL/EN).
 * Used for: add to calendar, create/modify workout, sport/date/constraints.
 */

export type SportIntent = "SWIM" | "BIKE" | "RUN" | "STRENGTH";

export type CoachAction =
  | "ADD_TO_CALENDAR"
  | "CREATE_WORKOUT"
  | "MODIFY_WORKOUT"
  | "WEEK_PLAN"
  | "ASK_EXPLANATION"
  | "CHAT";

export type CoachIntent = {
  action: CoachAction;
  sport: SportIntent | "MIXED" | "UNKNOWN";
  constraints?: {
    distanceM?: number;
    distanceKm?: number;
    durationMin?: number;
    intensity?: string;
    date?: string;
  };
  target?: string;
  flags?: {
    noGoal?: boolean;
    timeUnknown?: boolean;
    beginner?: boolean;
    injuryOrFatigue?: boolean;
  };
};

/**
 * Extract sport from user message for "add X workout to calendar".
 * PL: pływacki/pływanie, rower/rowerowy, bieg/bieganie, siłowy/core; EN: swim, bike, run, strength/core.
 */
export function getSportIntentFromMessage(text: string): SportIntent | null {
  const lower = text.trim().toLowerCase();
  if (/\b(swim|plywacki|pływacki|plywanie|pływanie|pool|swimming)\b/.test(lower)) return "SWIM";
  if (/\b(bike|rower|cycling|rowerowy|turbo)\b/.test(lower)) return "BIKE";
  if (/\b(run|bieg|bieganie|running)\b/.test(lower)) return "RUN";
  if (/\b(strength|silownia|siłownia|silowy|siłowy|weights|gym|core)\b/.test(lower)) return "STRENGTH";
  return null;
}

export function isSendToCalendarIntent(text: string): boolean {
  const lower = text.trim().toLowerCase();
  const hasCalendar =
    /\bcalendar\b/i.test(lower) || /do\s+kalendarza\b/i.test(lower) || /\bkalendarz/i.test(lower);
  const addSend =
    /\b(send|add|wklej|dodaj|wrzuć|wrzuc|zapisz|zapisać)\b/i.test(lower);
  if (hasCalendar && addSend) {
    if (/do\s+kalendarza\b/i.test(lower) || /\b(send|add)\s+.*to\s+(?:the\s+)?calendar\b/i.test(lower))
      return true;
    if (/\b(add|dodaj)\s+(to\s+)?(the\s+)?calendar\b/i.test(lower)) return true;
    if (/\b(wklej|dodaj|wrzuć|zapisz)\s+do\s+kalendarza\b/i.test(lower)) return true;
  }
  return (
    /\b(send|add)\s+(it\s+)?(to\s+)?(the\s+)?calendar\b/i.test(lower) ||
    /\b(wklej|dodaj|wrzuć|wrzuc|zapisz|zapisać)\s+do\s+kalendarza\b/i.test(lower) ||
    /\b(zapisz|zapisać)\s+(to\s+)?(w\s+)?kalendarz/i.test(lower) ||
    /do\s+kalendarza\s+(aby\s+)?zapisać/i.test(lower)
  );
}

/** Resolve "today"|"tomorrow" to YYYY-MM-DD. */
export function resolveIntentDate(relative: "today" | "tomorrow"): string {
  const d = new Date();
  if (relative === "tomorrow") d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

/**
 * Universal intent extractor from last user message (PL/EN).
 * Rule: "send/add to calendar" → action ADD_TO_CALENDAR regardless of rest.
 */
export function extractCoachIntent(text: string): CoachIntent {
  const t = text.trim();
  const lower = t.toLowerCase();

  if (isSendToCalendarIntent(t)) {
    const sport = getSportIntentFromMessage(t) ?? "UNKNOWN";
    const date = parseIntentDate(lower);
    return {
      action: "ADD_TO_CALENDAR",
      sport: sport === null ? "UNKNOWN" : sport,
      constraints: date ? { date } : undefined,
    };
  }

  const modify =
    /\b(change|zmień|zmien|modify|replace|skróć|skroc|skróć|zrób\s+(\d+)\s*(m|km)\s*(zamiast)?|shorten|longer)\b/i.test(lower) ||
    /\b(jutrzejszy|tomorrow'?s?)\s+(workout|trening|training)\b/i.test(lower) ||
    /\bzamiast\b/i.test(lower);
  if (modify && (/\b(trening|workout|training|session|jutro|tomorrow)\b/i.test(lower) || /\b(\d+)\s*(m|km)\s*(zamiast|instead)/i.test(lower))) {
    const sport = getSportIntentFromMessage(t) ?? "UNKNOWN";
    const date = parseIntentDate(lower);
    const constraints = parseConstraints(lower);
    return {
      action: "MODIFY_WORKOUT",
      sport: sport === null ? "UNKNOWN" : sport,
      constraints: { ...constraints, ...(date ? { date } : undefined) },
    };
  }

  const weekPlan = /\b(plan\s+na\s+tydzień|tydzień|week\s+plan|weekly|ten\s+tydzień)\b/i.test(lower);
  if (weekPlan) {
    return { action: "WEEK_PLAN", sport: getSportIntentFromMessage(t) ?? "UNKNOWN" };
  }

  const explain = /\b(why|dlaczego|wyjaśnij|explain|co\s+to\s+znaczy)\b/i.test(lower);
  if (explain && t.length < 120) {
    return { action: "ASK_EXPLANATION", sport: "UNKNOWN" };
  }

  const constraints = parseConstraints(lower);
  const date = parseIntentDate(lower);
  const sport = getSportIntentFromMessage(t);
  const flags: CoachIntent["flags"] = {};
  if (/\b(no\s+goal|nie\s+mam\s+celu|bez\s+celu)\b/i.test(lower)) flags.noGoal = true;
  if (/\b(slept\s+well|dobrze\s+spałem|wyspany)\b/i.test(lower)) flags.timeUnknown = false;
  if (/\b(beginner|początkujący|age\s+group)\b/i.test(lower)) flags.beginner = true;
  if (/\b(injury|kontuzja|fatigue|zmęczony|boli)\b/i.test(lower)) flags.injuryOrFatigue = true;

  return {
    action: "CREATE_WORKOUT",
    sport: sport ?? "UNKNOWN",
    constraints: { ...constraints, ...(date ? { date } : undefined) },
    flags: Object.keys(flags).length > 0 ? flags : undefined,
  };
}

function parseIntentDate(lower: string): string | undefined {
  const tomorrow = /\b(tomorrow|jutro|jutrzejszy|na\s+jutro)\b/.test(lower);
  const today = /\b(today|dziś|dzis|na\s+dziś)\b/.test(lower);
  const iso = lower.match(/\b(20\d{2})-(\d{2})-(\d{2})\b/);
  if (iso) return iso[0];
  if (tomorrow) return resolveIntentDate("tomorrow");
  if (today) return resolveIntentDate("today");
  return undefined;
}

function parseConstraints(lower: string): CoachIntent["constraints"] {
  const out: NonNullable<CoachIntent["constraints"]> = {};
  const m = lower.match(/\b(\d{2,4})\s*m\b/);
  if (m) out.distanceM = parseInt(m[1], 10);
  const km = lower.match(/\b(\d+(?:[.,]\d+)?)\s*km\b/);
  if (km) out.distanceKm = parseFloat(km[1].replace(",", "."));
  const min = lower.match(/\b(\d{1,3})\s*(?:min|minutes?|minut)\b/);
  if (min) out.durationMin = parseInt(min[1], 10);
  if (/\b(pace|tempo|rpe|power|hr|tss)\b/i.test(lower)) out.intensity = "mentioned";
  return Object.keys(out).length > 0 ? out : undefined;
}
