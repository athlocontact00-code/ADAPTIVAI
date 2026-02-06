/**
 * Fatigue Type Detection Service
 * Determines the type of fatigue an athlete is experiencing based on signals.
 */

export type FatigueType = "CNS" | "MUSCULAR" | "METABOLIC" | "PSYCHOLOGICAL" | "NONE";

export interface FatigueReason {
  reason: string;
  weight: number;
}

export interface FatigueResult {
  type: FatigueType;
  reasons: FatigueReason[];
  severity: number; // 0-100
  recommendation: string;
}

export interface FatigueInputs {
  // Diary signals
  mood?: number | null; // 1-5
  energy?: number | null; // 1-5
  sleepQual?: number | null; // 1-5
  sleepHrs?: number | null;
  stress?: number | null; // 1-5
  soreness?: number | null; // 1-5
  
  // Load signals
  atl?: number | null;
  ctl?: number | null;
  tsb?: number | null;
  recentHighIntensityDays?: number; // Count of hard sessions in last 7 days
  
  // Pattern signals (computed externally)
  consecutiveTrainingDays?: number;
  persistentFatigueDays?: number; // Days with energy <= 2
}

interface FatigueScore {
  cns: number;
  muscular: number;
  metabolic: number;
  psychological: number;
}

/**
 * Detect fatigue type from available signals
 */
export function detectFatigueType(inputs: FatigueInputs): FatigueResult {
  const scores: FatigueScore = {
    cns: 0,
    muscular: 0,
    metabolic: 0,
    psychological: 0,
  };
  
  const reasons: FatigueReason[] = [];

  // === CNS FATIGUE INDICATORS ===
  // Low sleep quality + high perceived effort + persistent fatigue
  if (inputs.sleepQual != null && inputs.sleepQual <= 2) {
    scores.cns += 25;
    reasons.push({ reason: "Poor sleep quality affecting neural recovery", weight: 25 });
  }
  
  if (inputs.persistentFatigueDays != null && inputs.persistentFatigueDays >= 3) {
    scores.cns += 30;
    reasons.push({ reason: "Persistent fatigue over multiple days", weight: 30 });
  }
  
  if (inputs.energy != null && inputs.energy <= 2 && inputs.sleepHrs != null && inputs.sleepHrs >= 7) {
    scores.cns += 20;
    reasons.push({ reason: "Low energy despite adequate sleep", weight: 20 });
  }
  
  if (inputs.recentHighIntensityDays != null && inputs.recentHighIntensityDays >= 3) {
    scores.cns += 15;
    reasons.push({ reason: "Multiple high-intensity sessions recently", weight: 15 });
  }

  // === MUSCULAR FATIGUE INDICATORS ===
  // High soreness + high ATL
  if (inputs.soreness != null && inputs.soreness >= 4) {
    scores.muscular += 35;
    reasons.push({ reason: "Significant muscle soreness", weight: 35 });
  }
  
  if (inputs.atl != null && inputs.ctl != null && inputs.ctl > 0) {
    const ratio = inputs.atl / inputs.ctl;
    if (ratio > 1.3) {
      scores.muscular += 25;
      reasons.push({ reason: "High acute training load", weight: 25 });
    }
  }
  
  if (inputs.consecutiveTrainingDays != null && inputs.consecutiveTrainingDays >= 5) {
    scores.muscular += 15;
    reasons.push({ reason: "Many consecutive training days", weight: 15 });
  }

  // === METABOLIC FATIGUE INDICATORS ===
  // High training load + low TSB + moderate soreness
  if (inputs.tsb != null && inputs.tsb < -15) {
    scores.metabolic += 30;
    reasons.push({ reason: "Deep negative training balance", weight: 30 });
  }
  
  if (inputs.atl != null && inputs.atl > 80) {
    scores.metabolic += 20;
    reasons.push({ reason: "Very high acute training load", weight: 20 });
  }
  
  if (inputs.energy != null && inputs.energy <= 2) {
    scores.metabolic += 15;
    reasons.push({ reason: "Low energy levels", weight: 15 });
  }

  // === PSYCHOLOGICAL FATIGUE INDICATORS ===
  // Low mood + high stress + low sleep quality
  if (inputs.mood != null && inputs.mood <= 2) {
    scores.psychological += 30;
    reasons.push({ reason: "Low mood", weight: 30 });
  }
  
  if (inputs.stress != null && inputs.stress >= 4) {
    scores.psychological += 25;
    reasons.push({ reason: "High stress levels", weight: 25 });
  }
  
  if (inputs.sleepQual != null && inputs.sleepQual <= 2 && inputs.mood != null && inputs.mood <= 3) {
    scores.psychological += 15;
    reasons.push({ reason: "Poor sleep affecting mental state", weight: 15 });
  }

  // === DETERMINE DOMINANT FATIGUE TYPE ===
  const threshold = 40; // Minimum score to be considered fatigued
  
  const sortedTypes = Object.entries(scores)
    .sort(([, a], [, b]) => b - a) as [keyof FatigueScore, number][];
  
  const [topType, topScore] = sortedTypes[0];
  
  if (topScore < threshold) {
    return {
      type: "NONE",
      reasons: [],
      severity: 0,
      recommendation: "No significant fatigue detected. Continue training as planned.",
    };
  }

  const typeMap: Record<keyof FatigueScore, FatigueType> = {
    cns: "CNS",
    muscular: "MUSCULAR",
    metabolic: "METABOLIC",
    psychological: "PSYCHOLOGICAL",
  };

  const fatigueType = typeMap[topType];
  const severity = Math.min(100, topScore);
  
  // Filter reasons relevant to the detected type
  const relevantReasons = reasons
    .filter((r) => r.weight >= 15)
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 3);

  return {
    type: fatigueType,
    reasons: relevantReasons,
    severity,
    recommendation: getRecommendation(fatigueType, severity),
  };
}

/**
 * Get recommendation based on fatigue type
 */
function getRecommendation(type: FatigueType, severity: number): string {
  const isHigh = severity >= 60;
  
  switch (type) {
    case "CNS":
      return isHigh
        ? "Rest day recommended. Avoid any high-intensity work. Focus on sleep and recovery."
        : "Light activity only. No intervals or heavy lifting. Consider a nap.";
    
    case "MUSCULAR":
      return isHigh
        ? "Active recovery or rest. Foam rolling and stretching. Avoid loaded exercises."
        : "Low-impact activity preferred. Swimming or easy cycling. Avoid running.";
    
    case "METABOLIC":
      return isHigh
        ? "Reduce training volume. Focus on nutrition and hydration. Consider a deload week."
        : "Shorter sessions at lower intensity. Ensure adequate fueling.";
    
    case "PSYCHOLOGICAL":
      return isHigh
        ? "Take a mental break from structured training. Do something enjoyable instead."
        : "Flexible training today. Skip anything that feels like a chore.";
    
    default:
      return "Continue training as planned.";
  }
}

/**
 * Format fatigue reasons as JSON for storage
 */
export function formatFatigueReasonsJson(reasons: FatigueReason[]): string {
  const obj: Record<string, number> = {};
  for (const r of reasons.slice(0, 3)) {
    obj[r.reason.substring(0, 50)] = r.weight;
  }
  return JSON.stringify(obj);
}

/**
 * Get fatigue type color for UI
 */
export function getFatigueColor(type: FatigueType): string {
  switch (type) {
    case "CNS":
      return "red";
    case "MUSCULAR":
      return "orange";
    case "METABOLIC":
      return "yellow";
    case "PSYCHOLOGICAL":
      return "purple";
    case "NONE":
      return "green";
  }
}

/**
 * Get fatigue type icon name for UI
 */
export function getFatigueIcon(type: FatigueType): string {
  switch (type) {
    case "CNS":
      return "brain";
    case "MUSCULAR":
      return "biceps";
    case "METABOLIC":
      return "flame";
    case "PSYCHOLOGICAL":
      return "heart";
    case "NONE":
      return "check";
  }
}

/**
 * Get explanation based on explainLevel
 */
export function getFatigueExplanation(
  result: FatigueResult,
  explainLevel: "minimal" | "standard" | "deep"
): string {
  if (result.type === "NONE") {
    return explainLevel === "minimal" ? "Fresh" : "No fatigue detected";
  }

  if (explainLevel === "minimal") {
    return result.type.toLowerCase();
  }

  if (explainLevel === "standard") {
    return `${result.type} fatigue - ${result.recommendation.split(".")[0]}`;
  }

  // Deep explanation
  const reasonList = result.reasons.map((r) => r.reason).join("; ");
  return `${result.type} fatigue (severity ${result.severity}%). Causes: ${reasonList}. ${result.recommendation}`;
}
