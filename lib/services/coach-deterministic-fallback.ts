import { finalizeCoachResponseText } from "@/lib/services/coach-response-finalizer";
import { isAddWorkoutRequest } from "@/lib/services/coach-request-router";

export type CoachDeterministicFallbackTone = "SUPPORTIVE" | "DIRECT" | "COACH";

export type CoachDeterministicFallbackContext = {
  userProfile: {
    sportPrimary: string | null;
  };
  planSummary: {
    today: string;
    todaySummary?: string;
    keySessionsNext7d: ReadonlyArray<{
      title: string;
      date: string;
    }>;
  };
  recentSignals: {
    checkIns7d: {
      items: ReadonlyArray<{
        readinessScore: number | null;
      }>;
    };
  };
};

export function buildDeterministicCoachFallback(params: {
  tone: CoachDeterministicFallbackTone;
  context: CoachDeterministicFallbackContext;
  input: string;
}): { text: string; confidence: number } {
  const raw = params.input.trim();
  const lower = raw.toLowerCase();

  const isGreeting =
    /^\s*(hi|hello|hey|yo|cześć|czesc|hej|siema|elo)\b/.test(lower) ||
    /^\s*(how are you|jak tam|co tam)\b/.test(lower);
  if (isGreeting) {
    const todaySummary = params.context.planSummary.todaySummary;
    const summary =
      todaySummary && todaySummary.trim().length > 0 ? `\n\nToday: ${todaySummary.slice(0, 200)}.` : "";
    const msg =
      (params.tone === "DIRECT"
        ? "Hi. Tell me what you're working on today (goal, available time, and how you feel)."
        : params.tone === "COACH"
          ? "Hey. Quick check: how did you sleep, and how do your legs feel right now (fresh / heavy / sore)? Then tell me your goal for today."
          : "Hey! How are you feeling today? Tell me how you slept and how your legs feel (fresh / heavy / sore), and what you want to accomplish.") +
      summary +
      "\n\nWhat would you like — a workout for today, a plan change, or just chat?";
    return { text: msg, confidence: 85 };
  }

  const today = params.context.planSummary.today;
  const key = params.context.planSummary.keySessionsNext7d[0];
  const latestReadiness = params.context.recentSignals.checkIns7d.items.at(-1)?.readinessScore ?? null;

  const base = (() => {
    if (typeof latestReadiness === "number" && latestReadiness < 40) {
      return {
        decision: "take a recovery day or do easy movement",
        confidence: 75,
      };
    }

    if (key) {
      return {
        decision: `focus on your next key session (${key.title}) on ${key.date}, and keep other days easy`,
        confidence: 80,
      };
    }

    return {
      decision: "keep today simple: an easy session or rest depending on how you feel",
      confidence: 65,
      because: `I don't have a specific key session scheduled next 7 days from the current context (today is ${today})`,
    };
  })();

  let msg = `${base.decision}.`;
  msg = finalizeCoachResponseText({ text: msg, confidence: base.confidence, sanitize: false });

  const wantsWorkout =
    isAddWorkoutRequest(params.input) ||
    /\b(workout|trening|session|run|swim|bike|today'?s?)\b/i.test(params.input);
  if (wantsWorkout) {
    const primary = (params.context.userProfile.sportPrimary ?? "").toUpperCase();
    const sport = primary === "SWIM" ? "swim" : primary === "BIKE" ? "bike" : "run";
    msg = `${msg}\n\n**Minimal safe option** (I couldn't reach the full coach right now - try again in a moment for a personalized plan): 45 min easy ${sport} - 10 min warm-up, 25 min steady, 10 min cool-down.`;
  } else {
    msg = `${msg}\n\nNext step: tell me how you slept and how your legs feel right now (fresh / heavy / sore).`;
  }

  return { text: msg, confidence: base.confidence };
}
