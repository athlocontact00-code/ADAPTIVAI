/**
 * Burnout Prevention Service
 * Detects burnout risk and provides recovery recommendations.
 */

export type BurnoutStatus = "LOW" | "MODERATE" | "HIGH";

export interface BurnoutDriver {
  driver: string;
  weight: number;
  description: string;
}

export interface BurnoutResult {
  risk: number; // 0-100
  status: BurnoutStatus;
  drivers: BurnoutDriver[];
  recommendation: string;
  suggestedActions: BurnoutAction[];
}

export interface BurnoutAction {
  id: string;
  label: string;
  description: string;
  type: "simplify" | "recovery";
}

export interface BurnoutInputs {
  // Diary signals
  mood?: number | null; // 1-5
  sleepQual?: number | null; // 1-5
  soreness?: number | null; // 1-5
  stress?: number | null; // 1-5
  
  // System signals
  fatigueType?: string | null;
  readinessScore?: number | null;
  complianceScore?: number | null;
  complianceStatus?: string | null;
  
  // Pattern signals
  lowMoodDays?: number; // Count of days with mood <= 2 in last 7 days
  lowSleepDays?: number; // Count of days with sleep quality <= 2
  highSorenessDays?: number; // Count of days with soreness >= 4
}

/**
 * Compute burnout risk from available signals
 */
export function computeBurnoutRisk(inputs: BurnoutInputs): BurnoutResult {
  const drivers: BurnoutDriver[] = [];
  let risk = 0;

  // === PSYCHOLOGICAL FACTORS ===
  
  // Low mood (major driver)
  if (inputs.mood != null && inputs.mood <= 2) {
    risk += 25;
    drivers.push({
      driver: "low_mood",
      weight: 25,
      description: "Low mood today",
    });
  } else if (inputs.mood != null && inputs.mood <= 3) {
    risk += 10;
    drivers.push({
      driver: "moderate_mood",
      weight: 10,
      description: "Mood could be better",
    });
  }

  // Persistent low mood
  if (inputs.lowMoodDays != null && inputs.lowMoodDays >= 3) {
    risk += 20;
    drivers.push({
      driver: "persistent_low_mood",
      weight: 20,
      description: `Low mood for ${inputs.lowMoodDays} of last 7 days`,
    });
  }

  // High stress
  if (inputs.stress != null && inputs.stress >= 4) {
    risk += 15;
    drivers.push({
      driver: "high_stress",
      weight: 15,
      description: "High stress levels",
    });
  }

  // === SLEEP FACTORS ===
  
  if (inputs.sleepQual != null && inputs.sleepQual <= 2) {
    risk += 15;
    drivers.push({
      driver: "poor_sleep",
      weight: 15,
      description: "Poor sleep quality",
    });
  }

  if (inputs.lowSleepDays != null && inputs.lowSleepDays >= 3) {
    risk += 15;
    drivers.push({
      driver: "persistent_poor_sleep",
      weight: 15,
      description: `Poor sleep for ${inputs.lowSleepDays} of last 7 days`,
    });
  }

  // === PHYSICAL FACTORS ===
  
  if (inputs.soreness != null && inputs.soreness >= 4) {
    risk += 10;
    drivers.push({
      driver: "high_soreness",
      weight: 10,
      description: "Significant muscle soreness",
    });
  }

  if (inputs.highSorenessDays != null && inputs.highSorenessDays >= 3) {
    risk += 10;
    drivers.push({
      driver: "persistent_soreness",
      weight: 10,
      description: `High soreness for ${inputs.highSorenessDays} of last 7 days`,
    });
  }

  // === SYSTEMIC FACTORS ===
  
  // CNS or psychological fatigue type
  if (inputs.fatigueType === "CNS" || inputs.fatigueType === "PSYCHOLOGICAL") {
    risk += 20;
    drivers.push({
      driver: "fatigue_type",
      weight: 20,
      description: `${inputs.fatigueType} fatigue detected`,
    });
  }

  // Low compliance (losing motivation)
  if (inputs.complianceStatus === "FRAGILE") {
    risk += 15;
    drivers.push({
      driver: "low_compliance",
      weight: 15,
      description: "Training consistency has dropped",
    });
  } else if (inputs.complianceStatus === "SLIPPING") {
    risk += 8;
    drivers.push({
      driver: "slipping_compliance",
      weight: 8,
      description: "Consistency starting to slip",
    });
  }

  // Very low readiness
  if (inputs.readinessScore != null && inputs.readinessScore < 40) {
    risk += 10;
    drivers.push({
      driver: "low_readiness",
      weight: 10,
      description: "Body not ready for training",
    });
  }

  // === FINAL CALCULATIONS ===
  
  // Cap risk at 100
  risk = Math.min(100, risk);

  // Determine status
  let status: BurnoutStatus;
  if (risk >= 50) {
    status = "HIGH";
  } else if (risk >= 30) {
    status = "MODERATE";
  } else {
    status = "LOW";
  }

  // Sort drivers by weight
  drivers.sort((a, b) => b.weight - a.weight);

  // Generate recommendation
  const recommendation = getRecommendation(status, drivers);

  // Generate suggested actions
  const suggestedActions = getSuggestedActions(status);

  return {
    risk,
    status,
    drivers: drivers.slice(0, 4),
    recommendation,
    suggestedActions,
  };
}

/**
 * Get recommendation based on burnout status
 */
function getRecommendation(status: BurnoutStatus, drivers: BurnoutDriver[]): string {
  const topDriver = drivers[0]?.driver;

  if (status === "HIGH") {
    if (topDriver === "low_mood" || topDriver === "persistent_low_mood") {
      return "Your mental energy is depleted. Consider a recovery break—fitness can wait, your wellbeing can't.";
    }
    if (topDriver === "poor_sleep" || topDriver === "persistent_poor_sleep") {
      return "Sleep debt is accumulating. Prioritize rest over training this week.";
    }
    return "Multiple stress signals detected. It's time to ease back and recover properly.";
  }

  if (status === "MODERATE") {
    if (topDriver === "high_stress") {
      return "Life stress is elevated. Keep training light and enjoyable—don't add more pressure.";
    }
    return "You're showing early signs of overload. A lighter week would be protective.";
  }

  return "You're in a good place. Stay consistent and listen to your body.";
}

/**
 * Get suggested recovery actions
 */
function getSuggestedActions(status: BurnoutStatus): BurnoutAction[] {
  if (status === "LOW") {
    return [];
  }

  const actions: BurnoutAction[] = [
    {
      id: "simplify",
      label: "Simplify Next 7 Days",
      description: "Reduce intensity but keep the habit. Shorter, easier sessions.",
      type: "simplify",
    },
    {
      id: "recovery",
      label: "Recovery Microcycle",
      description: "2-3 easy sessions + mobility + rest. Full reset.",
      type: "recovery",
    },
  ];

  return status === "HIGH" ? actions : [actions[0]];
}

/**
 * Format burnout drivers as JSON for storage
 */
export function formatBurnoutDriversJson(drivers: BurnoutDriver[]): string {
  const obj: Record<string, number> = {};
  for (const d of drivers.slice(0, 4)) {
    obj[d.driver] = d.weight;
  }
  return JSON.stringify(obj);
}

/**
 * Get burnout status color
 */
export function getBurnoutStatusColor(status: BurnoutStatus): string {
  switch (status) {
    case "LOW":
      return "green";
    case "MODERATE":
      return "yellow";
    case "HIGH":
      return "red";
  }
}

/**
 * Apply simplify action - reduce intensity but keep habit
 */
export function getSimplifyAdjustments(
  workouts: { durationMin: number; intensity: string }[]
): { durationMin: number; intensity: string; reason: string }[] {
  return workouts.map((w) => ({
    durationMin: Math.round(w.durationMin * 0.7),
    intensity: w.intensity === "hard" ? "moderate" : "easy",
    reason: "Simplified for recovery—keeping the habit, lowering the load",
  }));
}

/**
 * Generate recovery microcycle workouts
 */
export function getRecoveryMicrocycle(
  startDate: Date,
  sport: string
): { date: Date; title: string; type: string; durationMin: number; intensity: string; reason: string }[] {
  const workouts = [];
  
  const sportTemplates: Record<string, { title: string; type: string; duration: number }[]> = {
    running: [
      { title: "Easy Walk/Jog", type: "run", duration: 25 },
      { title: "Mobility & Stretching", type: "other", duration: 20 },
      { title: "Easy Recovery Run", type: "run", duration: 30 },
    ],
    cycling: [
      { title: "Easy Spin", type: "bike", duration: 30 },
      { title: "Mobility & Core", type: "other", duration: 20 },
      { title: "Recovery Ride", type: "bike", duration: 35 },
    ],
    triathlon: [
      { title: "Easy Swim", type: "swim", duration: 25 },
      { title: "Mobility & Stretching", type: "other", duration: 20 },
      { title: "Easy Spin or Walk", type: "bike", duration: 30 },
    ],
    swimming: [
      { title: "Easy Swim Drills", type: "swim", duration: 25 },
      { title: "Mobility & Stretching", type: "other", duration: 20 },
      { title: "Easy Swim", type: "swim", duration: 30 },
    ],
    strength: [
      { title: "Light Mobility", type: "other", duration: 20 },
      { title: "Easy Walk", type: "other", duration: 25 },
      { title: "Light Movement", type: "strength", duration: 25 },
    ],
  };

  const templates = sportTemplates[sport] || sportTemplates.running;
  
  // Day 1, 3, 5 - easy workouts, Day 2, 4, 6, 7 - rest
  const workoutDays = [0, 2, 4];
  
  for (let i = 0; i < 7; i++) {
    const date = new Date(startDate);
    date.setDate(date.getDate() + i);
    
    const workoutIndex = workoutDays.indexOf(i);
    if (workoutIndex !== -1 && templates[workoutIndex]) {
      const template = templates[workoutIndex];
      workouts.push({
        date,
        title: template.title,
        type: template.type,
        durationMin: template.duration,
        intensity: "easy",
        reason: "Recovery microcycle—gentle movement for physical and mental reset",
      });
    }
  }

  return workouts;
}
