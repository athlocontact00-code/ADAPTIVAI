/**
 * Safety Guardrails Service
 * Monitors training load ramp rate and provides safety recommendations.
 */

export type RampStatus = "SAFE" | "WARNING" | "DANGER";

export interface LoadMetrics {
  currentWeekLoad: number;
  previousWeekLoad: number;
  rampRate: number | null; // percentage, null if no baseline
  status: RampStatus;
  noBaseline: boolean; // true if previousWeekLoad is 0
}

export interface GuardrailWarning {
  type: "RAMP_RATE" | "CONSECUTIVE_HARD" | "NO_REST" | "OVERREACHING";
  message: string;
  severity: "low" | "medium" | "high";
  recommendation: string;
}

export interface GuardrailResult {
  isWithinLimits: boolean;
  warnings: GuardrailWarning[];
  adjustments: WorkoutAdjustment[];
  riskScore: number; // 0-100
}

export interface WorkoutAdjustment {
  date: Date;
  originalDuration: number;
  adjustedDuration: number;
  originalIntensity: string;
  adjustedIntensity: string;
  reason: string;
}

export interface PlannedWorkout {
  date: Date;
  durationMin: number;
  intensity: "easy" | "moderate" | "hard";
  tss?: number;
}

export const DEFAULT_RAMP_THRESHOLD = 15; // 15% max week-over-week increase

/**
 * Calculate weekly load from workouts
 */
export function calculateWeeklyLoad(workouts: { tss?: number | null; durationMin?: number | null }[]): number {
  return workouts.reduce((sum, w) => {
    // Use TSS if available, otherwise estimate from duration
    if (w.tss != null) return sum + w.tss;
    if (w.durationMin != null) return sum + Math.round(w.durationMin * 0.8);
    return sum;
  }, 0);
}

/**
 * Calculate ramp rate between two weeks
 * Returns null if there's no baseline (previousWeek === 0)
 */
export function calculateRampRate(currentWeek: number, previousWeek: number): number | null {
  if (previousWeek === 0) return null;
  return ((currentWeek - previousWeek) / previousWeek) * 100;
}

/**
 * Determine ramp status
 * If rampRate is null (no baseline), use currentWeekLoad to determine status
 */
export function getRampStatus(
  rampRate: number | null,
  threshold: number = DEFAULT_RAMP_THRESHOLD,
  currentWeekLoad: number = 0,
  previousWeekLoad: number = 0
): RampStatus {
  if (rampRate === null) {
    if (previousWeekLoad === 0 && currentWeekLoad > 200) return "WARNING";
    if (previousWeekLoad === 0 && currentWeekLoad > 400) return "DANGER";
    return "SAFE";
  }
  if (rampRate <= threshold) return "SAFE";
  if (rampRate <= threshold * 1.5) return "WARNING";
  return "DANGER";
}

/**
 * Get load metrics for current and previous week
 */
export function getLoadMetrics(
  currentWeekWorkouts: { tss?: number | null; durationMin?: number | null }[],
  previousWeekWorkouts: { tss?: number | null; durationMin?: number | null }[],
  threshold: number = DEFAULT_RAMP_THRESHOLD
): LoadMetrics {
  const currentWeekLoad = calculateWeeklyLoad(currentWeekWorkouts);
  const previousWeekLoad = calculateWeeklyLoad(previousWeekWorkouts);
  const rampRate = calculateRampRate(currentWeekLoad, previousWeekLoad);
  const status = getRampStatus(rampRate, threshold, currentWeekLoad, previousWeekLoad);
  const noBaseline = previousWeekLoad === 0;

  return {
    currentWeekLoad,
    previousWeekLoad,
    rampRate: rampRate !== null ? Math.round(rampRate * 10) / 10 : null,
    status,
    noBaseline,
  };
}

/**
 * Check guardrails and return warnings/adjustments
 */
export function checkGuardrails(
  plannedWorkouts: PlannedWorkout[],
  previousWeekLoad: number,
  recentWorkouts: { date: Date; intensity?: string; durationMin?: number | null }[] = [],
  threshold: number = DEFAULT_RAMP_THRESHOLD
): GuardrailResult {
  const warnings: GuardrailWarning[] = [];
  const adjustments: WorkoutAdjustment[] = [];
  let riskScore = 0;

  // Calculate planned week load
  const plannedLoad = calculateWeeklyLoad(
    plannedWorkouts.map((w) => ({ tss: w.tss, durationMin: w.durationMin }))
  );

  // Check ramp rate
  const rampRate = calculateRampRate(plannedLoad, previousWeekLoad);
  const noBaseline = previousWeekLoad === 0;
  
  if (noBaseline && plannedLoad > 0) {
    riskScore += plannedLoad > 400 ? 30 : plannedLoad > 200 ? 15 : 5;
    warnings.push({
      type: "RAMP_RATE",
      message: `No baseline last week. This week load: ${plannedLoad}`,
      severity: plannedLoad > 400 ? "high" : plannedLoad > 200 ? "medium" : "low",
      recommendation: "Load increased from 0 last week; be conservative and monitor how you feel.",
    });
  } else if (rampRate !== null && rampRate > threshold) {
    const severity = rampRate > threshold * 1.5 ? "high" : "medium";
    riskScore += severity === "high" ? 40 : 25;
    
    warnings.push({
      type: "RAMP_RATE",
      message: `Weekly load increase of ${Math.round(rampRate)}% exceeds ${threshold}% threshold`,
      severity,
      recommendation: `Reduce planned volume by ${Math.round(rampRate - threshold)}% to stay within safe limits`,
    });

    // Calculate adjustments needed
    const targetLoad = previousWeekLoad * (1 + threshold / 100);
    const reductionNeeded = (plannedLoad - targetLoad) / plannedLoad;

    // Adjust hardest workouts first
    const sortedWorkouts = [...plannedWorkouts].sort((a, b) => {
      const intensityOrder = { hard: 3, moderate: 2, easy: 1 };
      return intensityOrder[b.intensity] - intensityOrder[a.intensity];
    });

    let remainingReduction = plannedLoad - targetLoad;
    
    for (const workout of sortedWorkouts) {
      if (remainingReduction <= 0) break;
      
      const workoutLoad = workout.tss || Math.round(workout.durationMin * 0.8);
      const reduction = Math.min(remainingReduction, workoutLoad * 0.3);
      const newDuration = Math.round(workout.durationMin * (1 - reduction / workoutLoad));
      
      let newIntensity = workout.intensity;
      if (workout.intensity === "hard" && reduction > workoutLoad * 0.2) {
        newIntensity = "moderate";
      }

      if (newDuration !== workout.durationMin || newIntensity !== workout.intensity) {
        adjustments.push({
          date: workout.date,
          originalDuration: workout.durationMin,
          adjustedDuration: Math.max(20, newDuration),
          originalIntensity: workout.intensity,
          adjustedIntensity: newIntensity,
          reason: "Guardrail: ramp rate capped",
        });
        remainingReduction -= reduction;
      }
    }
  }

  // Check for consecutive hard days
  const hardDays: Date[] = [];
  const allWorkouts = [...recentWorkouts, ...plannedWorkouts.map((w) => ({ 
    date: w.date, 
    intensity: w.intensity,
    durationMin: w.durationMin 
  }))];
  
  allWorkouts.sort((a, b) => a.date.getTime() - b.date.getTime());
  
  for (let i = 1; i < allWorkouts.length; i++) {
    const prev = allWorkouts[i - 1];
    const curr = allWorkouts[i];
    const dayDiff = Math.round((curr.date.getTime() - prev.date.getTime()) / (1000 * 60 * 60 * 24));
    
    if (dayDiff === 1 && prev.intensity === "hard" && curr.intensity === "hard") {
      hardDays.push(curr.date);
    }
  }

  if (hardDays.length > 0) {
    riskScore += 20;
    warnings.push({
      type: "CONSECUTIVE_HARD",
      message: `${hardDays.length} back-to-back hard sessions detected`,
      severity: "medium",
      recommendation: "Add recovery day between hard sessions",
    });
  }

  // Check for lack of rest days
  const plannedDates = new Set(plannedWorkouts.map((w) => w.date.toDateString()));
  if (plannedDates.size >= 7) {
    riskScore += 15;
    warnings.push({
      type: "NO_REST",
      message: "No rest days planned this week",
      severity: "low",
      recommendation: "Consider adding at least one complete rest day",
    });
  }

  // Cap risk score
  riskScore = Math.min(100, riskScore);

  return {
    isWithinLimits: warnings.filter((w) => w.severity !== "low").length === 0,
    warnings,
    adjustments,
    riskScore,
  };
}

/**
 * Apply deload adjustments to workouts
 */
export function applyDeload(
  workouts: PlannedWorkout[],
  deloadPercent: number = 40
): { adjusted: PlannedWorkout[]; description: string } {
  const adjusted = workouts.map((w) => {
    const reductionFactor = 1 - deloadPercent / 100;
    let newIntensity = w.intensity;
    
    // Reduce hard to moderate, moderate to easy
    if (w.intensity === "hard") newIntensity = "moderate";
    else if (w.intensity === "moderate") newIntensity = "easy";

    return {
      ...w,
      durationMin: Math.round(w.durationMin * reductionFactor),
      intensity: newIntensity,
      tss: w.tss ? Math.round(w.tss * reductionFactor * 0.8) : undefined,
    };
  });

  const totalReduction = workouts.reduce((sum, w) => sum + w.durationMin, 0) -
    adjusted.reduce((sum, w) => sum + w.durationMin, 0);

  return {
    adjusted,
    description: `Deload applied: ${deloadPercent}% volume reduction (${totalReduction} min removed), intensities lowered`,
  };
}

/**
 * Get ramp status color for UI
 */
export function getRampStatusColor(status: RampStatus): string {
  switch (status) {
    case "SAFE":
      return "green";
    case "WARNING":
      return "yellow";
    case "DANGER":
      return "red";
  }
}

/**
 * Get risk level description
 */
export function getRiskDescription(riskScore: number): string {
  if (riskScore < 20) return "Low risk";
  if (riskScore < 50) return "Moderate risk";
  if (riskScore < 75) return "High risk";
  return "Very high risk";
}

/**
 * Format warnings for display based on explainLevel
 */
export function formatGuardrailWarnings(
  result: GuardrailResult,
  explainLevel: "minimal" | "standard" | "deep"
): string {
  if (result.warnings.length === 0) {
    return explainLevel === "minimal" ? "OK" : "Training load within safe limits";
  }

  if (explainLevel === "minimal") {
    return `${result.warnings.length} warning(s)`;
  }

  if (explainLevel === "standard") {
    return result.warnings.map((w) => w.message).join(". ");
  }

  // Deep
  return result.warnings
    .map((w) => `⚠️ ${w.message}\n   → ${w.recommendation}`)
    .join("\n\n");
}
