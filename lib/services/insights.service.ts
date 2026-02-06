/**
 * Daily Insights Service
 * Generates premium, minimal daily insights based on athlete state.
 */

export type InsightType = "readiness" | "compliance" | "fatigue" | "motivation" | "recovery";

export interface InsightDriver {
  factor: string;
  value: string | number;
}

export interface DailyInsightResult {
  text: string;
  type: InsightType;
  drivers: InsightDriver[];
  priority: number; // 1-5, higher = more important
}

export interface InsightInputs {
  // Readiness
  readinessScore?: number | null;
  readinessStatus?: string | null;
  
  // Fatigue
  fatigueType?: string | null;
  
  // Compliance
  complianceScore?: number | null;
  complianceStatus?: string | null;
  currentStreak?: number | null;
  
  // Burnout
  burnoutRisk?: number | null;
  burnoutStatus?: string | null;
  
  // Diary
  mood?: number | null;
  sleepQual?: number | null;
  soreness?: number | null;
  
  // Context
  identityMode?: string;
  dayOfWeek?: number; // 0 = Sunday
  hasWorkoutToday?: boolean;
}

/**
 * Generate a daily insight based on current state
 * Rules-based, deterministic, returns max 1 insight
 */
export function generateDailyInsight(inputs: InsightInputs): DailyInsightResult | null {
  const candidates: DailyInsightResult[] = [];

  // === HIGH PRIORITY: Burnout/Recovery ===
  
  if (inputs.burnoutStatus === "HIGH") {
    candidates.push({
      text: "Your body and mind are sending signals. Today's priority isn't training—it's recovery. Even elite athletes take breaks.",
      type: "recovery",
      drivers: [{ factor: "burnout_risk", value: inputs.burnoutRisk || "high" }],
      priority: 5,
    });
  }

  if (inputs.fatigueType === "CNS" || inputs.fatigueType === "PSYCHOLOGICAL") {
    candidates.push({
      text: `${inputs.fatigueType === "CNS" ? "Neural" : "Mental"} fatigue detected. Light movement or complete rest today will serve you better than pushing through.`,
      type: "fatigue",
      drivers: [{ factor: "fatigue_type", value: inputs.fatigueType }],
      priority: 4,
    });
  }

  // === MEDIUM PRIORITY: Compliance/Motivation ===
  
  if (inputs.currentStreak != null && inputs.currentStreak >= 7) {
    const streakMessages = [
      `${inputs.currentStreak}-day streak! Consistency compounds. You're building something sustainable.`,
      `Week-long streak achieved. This is where real progress happens—keep showing up.`,
      `${inputs.currentStreak} days strong. The hardest part is done—you've built the habit.`,
    ];
    candidates.push({
      text: streakMessages[inputs.currentStreak % streakMessages.length],
      type: "motivation",
      drivers: [{ factor: "streak", value: inputs.currentStreak }],
      priority: 3,
    });
  }

  if (inputs.complianceStatus === "FRAGILE" && inputs.burnoutStatus !== "HIGH") {
    candidates.push({
      text: "Training has slipped lately, and that's okay. One small session today can restart the momentum.",
      type: "compliance",
      drivers: [{ factor: "compliance_status", value: "fragile" }],
      priority: 3,
    });
  }

  // === READINESS-BASED INSIGHTS ===
  
  if (inputs.readinessScore != null && inputs.readinessScore >= 80 && inputs.hasWorkoutToday) {
    const readyMessages = getHighReadinessMessage(inputs.identityMode);
    candidates.push({
      text: readyMessages,
      type: "readiness",
      drivers: [{ factor: "readiness", value: inputs.readinessScore }],
      priority: 2,
    });
  }

  if (inputs.readinessScore != null && inputs.readinessScore < 45 && inputs.readinessScore >= 30) {
    candidates.push({
      text: "Readiness is low today. If you train, keep it easy and short. Tomorrow will be better.",
      type: "readiness",
      drivers: [{ factor: "readiness", value: inputs.readinessScore }],
      priority: 3,
    });
  }

  // === SLEEP-BASED INSIGHTS ===
  
  if (inputs.sleepQual != null && inputs.sleepQual >= 4 && inputs.readinessScore != null && inputs.readinessScore >= 60) {
    candidates.push({
      text: "Good sleep pays dividends. Your body is primed for quality work today.",
      type: "readiness",
      drivers: [{ factor: "sleep_quality", value: inputs.sleepQual }],
      priority: 2,
    });
  }

  if (inputs.sleepQual != null && inputs.sleepQual <= 2) {
    candidates.push({
      text: "Sleep wasn't great. Consider an easier session or prioritize an early night tonight.",
      type: "recovery",
      drivers: [{ factor: "sleep_quality", value: inputs.sleepQual }],
      priority: 3,
    });
  }

  // === DAY-OF-WEEK CONTEXTUAL ===
  
  if (inputs.dayOfWeek === 1 && inputs.readinessScore != null && inputs.readinessScore >= 50) { // Monday
    candidates.push({
      text: "New week, fresh start. Set one intention for this week and let consistency do the rest.",
      type: "motivation",
      drivers: [{ factor: "day", value: "monday" }],
      priority: 1,
    });
  }

  if (inputs.dayOfWeek === 0 && !inputs.hasWorkoutToday) { // Sunday rest day
    candidates.push({
      text: "Rest days are training days. Recovery is when adaptation happens.",
      type: "recovery",
      drivers: [{ factor: "day", value: "sunday" }],
      priority: 1,
    });
  }

  // === NO INSIGHT IF NOTHING NOTABLE ===
  
  if (candidates.length === 0) {
    return null;
  }

  // Return highest priority insight
  candidates.sort((a, b) => b.priority - a.priority);
  return candidates[0];
}

/**
 * Get high readiness message based on identity mode
 */
function getHighReadinessMessage(identityMode?: string): string {
  switch (identityMode) {
    case "competitive":
      return "Body is primed. This is the day to push—make it count.";
    case "longevity":
      return "Feeling good today. Enjoy the movement without overdoing it.";
    case "comeback":
      return "Great readiness! Stay patient—consistent progress beats rushed gains.";
    case "busy_pro":
      return "High readiness meets tight schedule. Maximum impact, minimum time today.";
    default:
      return "You're in great shape today. Trust the process and give your best effort.";
  }
}

/**
 * Format insight drivers as JSON for storage
 */
export function formatInsightDriversJson(drivers: InsightDriver[]): string {
  return JSON.stringify(drivers);
}

/**
 * Get insight type icon name
 */
export function getInsightIcon(type: InsightType): string {
  switch (type) {
    case "readiness":
      return "battery";
    case "compliance":
      return "target";
    case "fatigue":
      return "alert-triangle";
    case "motivation":
      return "zap";
    case "recovery":
      return "heart";
  }
}

/**
 * Get insight type color
 */
export function getInsightColor(type: InsightType): string {
  switch (type) {
    case "readiness":
      return "blue";
    case "compliance":
      return "purple";
    case "fatigue":
      return "orange";
    case "motivation":
      return "green";
    case "recovery":
      return "pink";
  }
}
