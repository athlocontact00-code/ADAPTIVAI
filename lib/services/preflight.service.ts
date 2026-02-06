/**
 * Pre-Flight Check Service
 * Evaluates workout safety based on athlete signals and readiness data.
 * Deterministic, offline, explainable.
 */

export type AIDecision = "PROCEED" | "REDUCE_INTENSITY" | "SHORTEN" | "SWAP_RECOVERY" | "REST";

export interface CheckInData {
  mood: number; // 1-5
  energy: number; // 1-5
  stress: number; // 1-5
  sorenessAreas: string[];
  notes?: string;
}

export interface ReadinessContext {
  readinessScore?: number;
  readinessStatus?: string;
  fatigueType?: string;
  burnoutRisk?: number;
  tsb?: number;
}

export interface WorkoutContext {
  type: string;
  durationMin?: number;
  tss?: number;
  aiGenerated: boolean;
}

export interface PreFlightResult {
  decision: AIDecision;
  confidence: number;
  reasons: { factor: string; impact: string; weight: number }[];
  adaptedWorkout?: {
    newDurationMin?: number;
    newType?: string;
    intensityReduction?: number; // percentage
  };
  explanation: string;
}

// Critical soreness areas that warrant extra caution
const CRITICAL_SORENESS_AREAS = [
  "lower_back",
  "knee",
  "achilles",
  "hip",
  "shoulder",
  "neck",
];

// Soreness areas that affect specific workout types
const SORENESS_WORKOUT_CONFLICTS: Record<string, string[]> = {
  lower_back: ["Run", "Strength", "Cycling"],
  knee: ["Run", "Cycling", "Strength"],
  achilles: ["Run"],
  hip: ["Run", "Cycling"],
  shoulder: ["Swim", "Strength"],
  hamstring: ["Run", "Cycling"],
  quad: ["Run", "Cycling", "Strength"],
  calf: ["Run"],
};

/**
 * Run pre-flight safety check
 */
export function runPreFlightCheck(
  checkIn: CheckInData,
  readiness: ReadinessContext,
  workout: WorkoutContext
): PreFlightResult {
  throw new Error(
    "Legacy preflight service is disabled. Use lib/services/daily-checkin.service.ts and DailyCheckIn evaluation instead."
  );
}

/**
 * Get decision display info
 */
export function getDecisionDisplay(decision: AIDecision): {
  label: string;
  color: string;
  icon: string;
} {
  switch (decision) {
    case "PROCEED":
      return { label: "Proceed as Planned", color: "text-green-500", icon: "✓" };
    case "REDUCE_INTENSITY":
      return { label: "Reduce Intensity", color: "text-yellow-500", icon: "↓" };
    case "SHORTEN":
      return { label: "Shorten Session", color: "text-orange-500", icon: "⏱" };
    case "SWAP_RECOVERY":
      return { label: "Swap to Recovery", color: "text-blue-500", icon: "🔄" };
    case "REST":
      return { label: "Rest Day Recommended", color: "text-red-500", icon: "⏸" };
  }
}

/**
 * Soreness area options for UI
 */
export const SORENESS_AREAS = [
  { value: "neck", label: "Neck" },
  { value: "shoulder", label: "Shoulders" },
  { value: "upper_back", label: "Upper Back" },
  { value: "lower_back", label: "Lower Back" },
  { value: "hip", label: "Hips" },
  { value: "quad", label: "Quadriceps" },
  { value: "hamstring", label: "Hamstrings" },
  { value: "knee", label: "Knees" },
  { value: "calf", label: "Calves" },
  { value: "achilles", label: "Achilles" },
  { value: "ankle", label: "Ankles" },
  { value: "foot", label: "Feet" },
];

/**
 * Format reasons for display
 */
export function formatReasonsForDisplay(
  reasons: { factor: string; impact: string; weight: number }[]
): string {
  if (reasons.length === 0) return "No concerns detected.";
  
  return reasons
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 3)
    .map((r) => `• ${r.factor}: ${r.impact}`)
    .join("\n");
}
