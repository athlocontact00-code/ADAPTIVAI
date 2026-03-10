import type { CoachActionIntent } from "@/lib/coach/intent";

export type CoachFallbackRoute =
  | "MANUAL_ADD_WORKOUT"
  | "TODAY_WORKOUTS"
  | "SEVEN_DAY_PLAN"
  | "LLM_CHAT";

export type CoachRequestRoute = {
  immediateRoute: "ADD_TO_CALENDAR" | null;
  preferBrain: boolean;
  fallbackRoute: CoachFallbackRoute;
};

export function isAddWorkoutRequest(input: string): boolean {
  const s = input.toLowerCase();
  const hasVerb = /(^|\b)(dodaj|zaplanuj|wstaw|ustaw|add|schedule|plan)\b/.test(s);
  if (!hasVerb) return false;

  const hasNoun = /(\btrening\b|\bworkout\b|\bsession\b)/.test(s);
  const hasSportWord =
    /(\bbieg\b|\brun\b|\brower\b|\bbike\b|\bpływanie\b|\bplywanie\b|\bswim\b|\bsiłownia\b|\bsilownia\b|\bstrength\b)/.test(
      s
    );

  return hasNoun || hasSportWord;
}

export function isSevenDayPlanRequest(input: string): boolean {
  const s = input.toLowerCase();
  if (/(^|\b)(generate|create|make|build)(\b|\s).*\b(7|seven)\b.*\b(day|days)\b.*\b(plan)\b/.test(s)) {
    return true;
  }
  if (/\b7\s*day\s*training\s*plan\b/.test(s)) return true;
  if (/\bweekly\s*plan\b/.test(s) && /\b7\b/.test(s)) return true;
  return false;
}

export function isTodayWorkoutsRequest(input: string): boolean {
  const s = input.toLowerCase().trim();
  if (/\b(generate|create|write|give\s+me|prescribe|plan\s+me\s+a|zaplanuj|napisz|daj\s+mi)\b/.test(s)) {
    return false;
  }
  if (/(^|\b)(today|todays|to-day)\b/.test(s) && /\b(workout|workouts|training|session|sessions)\b/.test(s)) {
    return true;
  }
  if (/\b(trening|treningi)\b/.test(s) && /\b(dzisiaj|na\s+dzisiaj|dzis)\b/.test(s)) {
    return true;
  }
  if (/\bco\s+mam\s+dzisiaj\b/.test(s)) return true;
  if (/\bplan\b/.test(s) && /\b(dzisiaj|today)\b/.test(s)) return true;
  return false;
}

export function classifyCoachRequestRoute(
  message: string,
  actionIntent: CoachActionIntent
): CoachRequestRoute {
  if (actionIntent === "ADD_TO_CALENDAR") {
    return {
      immediateRoute: "ADD_TO_CALENDAR",
      preferBrain: false,
      fallbackRoute: "LLM_CHAT",
    };
  }

  let fallbackRoute: CoachFallbackRoute = "LLM_CHAT";
  if (isAddWorkoutRequest(message)) fallbackRoute = "MANUAL_ADD_WORKOUT";
  else if (isTodayWorkoutsRequest(message)) fallbackRoute = "TODAY_WORKOUTS";
  else if (isSevenDayPlanRequest(message)) fallbackRoute = "SEVEN_DAY_PLAN";

  return {
    immediateRoute: null,
    preferBrain: actionIntent !== "QUESTION_ONLY",
    fallbackRoute,
  };
}
