/**
 * Mock data for AI Coach page.
 * Replace with real backend calls when ready.
 */

export type CoachSuggestionType = "adjust_today" | "swap_session" | "rebalance_week";

export interface CoachSuggestion {
  id: string;
  title: string;
  impact: string;
  why: string;
  type: CoachSuggestionType;
  actionId?: string;
}

export const MOCK_COACH_SUGGESTIONS: CoachSuggestion[] = [
  {
    id: "s1",
    title: "Reduce today's intensity",
    impact: "-10% intensity, keep volume",
    why: "Your readiness is 58% and fatigue (ATL) has been elevated. A lighter session today will support recovery without losing training consistency.",
    type: "adjust_today",
  },
  {
    id: "s2",
    title: "Add recovery day tomorrow",
    impact: "Swap Thursday run for easy 30min walk",
    why: "Three consecutive training days with rising TSS. A low-impact active recovery day will help absorb the load and prevent overreaching.",
    type: "swap_session",
  },
  {
    id: "s3",
    title: "Balance bike vs run this week",
    impact: "Add 1 run, reduce bike by 45min",
    why: "Your season focus is triathlon and run volume has been below target. One extra run will better distribute load across disciplines.",
    type: "rebalance_week",
  },
];

/** Sample AI response with structured JSON for WorkoutCard */
export const SAMPLE_WORKOUT_JSON = {
  type: "workout",
  title: "Easy Recovery Run",
  discipline: "Run",
  durationMin: 45,
  tss: 35,
  rpe: "3/10",
  targets: [
    { label: "HR target", value: "130–145 bpm" },
    { label: "RPE", value: "3/10" },
  ],
  warmUp: { minutes: 10, text: "Easy jog, gradually building. Include dynamic stretches." },
  mainSet: { minutes: 25, text: "Conversational aerobic running. Keep cadence relaxed and focus on form." },
  coolDown: { minutes: 10, text: "Easy effort. Light stretching and hydration." },
};

/** Sample AI response with WeekPlanGrid JSON */
export const SAMPLE_WEEK_PLAN_JSON = {
  type: "week_plan",
  days: [
    { day: "Mon", type: "Rest", durationMin: 0, tss: 0 },
    { day: "Tue", type: "Run", durationMin: 45, tss: 35 },
    { day: "Wed", type: "Bike", durationMin: 60, tss: 50 },
    { day: "Thu", type: "Run", durationMin: 30, tss: 25 },
    { day: "Fri", type: "Rest", durationMin: 0, tss: 0 },
    { day: "Sat", type: "Bike", durationMin: 90, tss: 70 },
    { day: "Sun", type: "Run", durationMin: 60, tss: 55 },
  ],
  totalHours: 5.75,
  totalTss: 235,
};

/** Sample AI response with ChangeProposalCard JSON */
export const SAMPLE_PROPOSAL_JSON = {
  type: "change_proposal",
  changeType: "swap",
  description: "Swap today's intervals for steady tempo",
  impact: "Reduce peak HR load by ~15%, keep TSS similar",
  why: "Check-in shows elevated fatigue. Tempo work preserves aerobic stimulus with less systemic stress.",
};
