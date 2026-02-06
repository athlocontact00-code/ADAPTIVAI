/**
 * Simulator Service
 * Deterministic what-if simulation engine for training scenarios.
 * Does NOT modify real data - only projects future metrics.
 */

export type IntensityBias = "LOW" | "BALANCED" | "HIGH";
export type RecoveryFocus = "NORMAL" | "EXTRA";
export type ComplianceAssumption = "REALISTIC" | "OPTIMISTIC" | "CONSERVATIVE";
export type IdentityMode = "competitive" | "longevity" | "comeback" | "busy_pro";

export interface ScenarioParams {
  volumeChange: number; // -50 to +50 (%)
  intensityBias: IntensityBias;
  recoveryFocus: RecoveryFocus;
  complianceAssumption: ComplianceAssumption;
  identityModeOverride?: IdentityMode;
}

export interface BaselineMetrics {
  ctl: number;
  atl: number;
  tsb: number;
  avgWeeklyTSS: number;
  avgReadiness: number;
  avgBurnoutRisk: number;
  identityMode: IdentityMode;
}

export interface WeeklySimulationResult {
  weekIndex: number;
  simulatedCTL: number;
  simulatedATL: number;
  simulatedTSB: number;
  simulatedReadinessAvg: number;
  simulatedBurnoutRisk: number;
  weeklyTSS: number;
  insights: string[];
  warnings: string[];
}

export interface SimulationOutput {
  weeks: WeeklySimulationResult[];
  summary: {
    finalCTL: number;
    finalATL: number;
    finalTSB: number;
    ctlChange: number;
    peakBurnoutRisk: number;
    totalWarnings: number;
    recommendation: string;
  };
}

// Guardrail constants
const MAX_RAMP_RATE = 0.10; // 10% max week-over-week increase
const DANGER_RAMP_RATE = 0.15; // 15% triggers warning
const MAX_CTL_JUMP_PER_WEEK = 5;
const MIN_TSB_SAFE = -30;
const BURNOUT_THRESHOLD = 70;

// Identity mode modifiers
const IDENTITY_MODIFIERS: Record<IdentityMode, { rampLimit: number; recoveryBonus: number; intensityTolerance: number }> = {
  competitive: { rampLimit: 1.0, recoveryBonus: 0, intensityTolerance: 1.2 },
  longevity: { rampLimit: 0.7, recoveryBonus: 10, intensityTolerance: 0.8 },
  comeback: { rampLimit: 0.5, recoveryBonus: 15, intensityTolerance: 0.6 },
  busy_pro: { rampLimit: 0.8, recoveryBonus: 5, intensityTolerance: 0.9 },
};

// Preset scenarios
export const SCENARIO_PRESETS: Record<string, { name: string; params: ScenarioParams; description: string }> = {
  aggressive_build: {
    name: "Aggressive Build",
    params: {
      volumeChange: 25,
      intensityBias: "HIGH",
      recoveryFocus: "NORMAL",
      complianceAssumption: "OPTIMISTIC",
    },
    description: "Push hard for rapid fitness gains. Higher risk of overtraining.",
  },
  balanced_progress: {
    name: "Balanced Progress",
    params: {
      volumeChange: 10,
      intensityBias: "BALANCED",
      recoveryFocus: "NORMAL",
      complianceAssumption: "REALISTIC",
    },
    description: "Steady, sustainable progress with moderate risk.",
  },
  longevity_first: {
    name: "Longevity First",
    params: {
      volumeChange: 0,
      intensityBias: "LOW",
      recoveryFocus: "EXTRA",
      complianceAssumption: "CONSERVATIVE",
    },
    description: "Prioritize health and consistency over rapid gains.",
  },
  comeback_safe: {
    name: "Comeback Safe",
    params: {
      volumeChange: -10,
      intensityBias: "LOW",
      recoveryFocus: "EXTRA",
      complianceAssumption: "CONSERVATIVE",
      identityModeOverride: "comeback",
    },
    description: "Gentle return to training after break or injury.",
  },
};

/**
 * Run deterministic simulation for a scenario
 */
export function runSimulation(
  baseline: BaselineMetrics,
  params: ScenarioParams,
  durationWeeks: number
): SimulationOutput {
  const weeks: WeeklySimulationResult[] = [];
  
  // Use identity mode override if provided
  const identityMode = params.identityModeOverride || baseline.identityMode;
  const modifiers = IDENTITY_MODIFIERS[identityMode];
  
  // Calculate target weekly TSS based on volume change
  const baseWeeklyTSS = baseline.avgWeeklyTSS || 250;
  const targetWeeklyTSS = Math.round(baseWeeklyTSS * (1 + params.volumeChange / 100));
  
  // Intensity multiplier affects TSS distribution
  const intensityMultiplier = params.intensityBias === "HIGH" ? 1.15 : params.intensityBias === "LOW" ? 0.85 : 1.0;
  
  // Recovery focus affects readiness recovery
  const recoveryBonus = params.recoveryFocus === "EXTRA" ? 10 : 0;
  
  // Compliance affects actual vs planned
  const complianceRate = params.complianceAssumption === "OPTIMISTIC" ? 0.95 
    : params.complianceAssumption === "CONSERVATIVE" ? 0.75 
    : 0.85;
  
  // Initialize from baseline
  let currentCTL = baseline.ctl || 50;
  let currentATL = baseline.atl || 40;
  let previousWeekTSS = baseWeeklyTSS;
  let peakBurnoutRisk = baseline.avgBurnoutRisk || 20;
  let totalWarnings = 0;
  
  for (let week = 1; week <= durationWeeks; week++) {
    const insights: string[] = [];
    const warnings: string[] = [];
    
    // Calculate this week's TSS with gradual ramp
    const rampProgress = week / durationWeeks;
    const plannedTSS = Math.round(
      baseWeeklyTSS + (targetWeeklyTSS - baseWeeklyTSS) * rampProgress * intensityMultiplier
    );
    
    // Apply compliance
    const actualTSS = Math.round(plannedTSS * complianceRate);
    
    // Check ramp rate guardrail
    const rampRate = previousWeekTSS > 0 ? (actualTSS - previousWeekTSS) / previousWeekTSS : 0;
    const effectiveRampLimit = MAX_RAMP_RATE * modifiers.rampLimit;
    
    let cappedTSS = actualTSS;
    if (rampRate > effectiveRampLimit) {
      cappedTSS = Math.round(previousWeekTSS * (1 + effectiveRampLimit));
      warnings.push(`Week ${week}: TSS capped from ${actualTSS} to ${cappedTSS} (ramp limit ${Math.round(effectiveRampLimit * 100)}%)`);
      totalWarnings++;
    }
    
    if (rampRate > DANGER_RAMP_RATE) {
      warnings.push(`Week ${week}: Dangerous ramp rate detected (${Math.round(rampRate * 100)}%)`);
      totalWarnings++;
    }
    
    // Update CTL (42-day time constant, simplified to weekly)
    // CTL_new = CTL_old + (TSS - CTL_old) / 6 (approx for weekly)
    const ctlDelta = (cappedTSS / 7 - currentCTL) / 6;
    const newCTL = Math.min(currentCTL + ctlDelta, currentCTL + MAX_CTL_JUMP_PER_WEEK);
    
    // Update ATL (7-day time constant)
    // ATL responds faster to load changes
    const atlDelta = (cappedTSS / 7 - currentATL) / 1.5;
    const newATL = currentATL + atlDelta;
    
    // Calculate TSB
    const newTSB = newCTL - newATL;
    
    // Check TSB guardrail
    if (newTSB < MIN_TSB_SAFE) {
      warnings.push(`Week ${week}: TSB critically low (${Math.round(newTSB)}). High injury/overtraining risk.`);
      totalWarnings++;
    }
    
    // Estimate readiness (simplified model)
    // Higher TSB = better readiness, but also affected by recovery focus
    let readiness = 50 + newTSB + recoveryBonus + modifiers.recoveryBonus;
    readiness = Math.max(20, Math.min(95, Math.round(readiness)));
    
    // Estimate burnout risk
    // Factors: low TSB, high ramp, low compliance, high intensity
    let burnoutRisk = 20;
    if (newTSB < -20) burnoutRisk += 20;
    if (newTSB < -30) burnoutRisk += 15;
    if (rampRate > 0.08) burnoutRisk += 15;
    if (params.intensityBias === "HIGH") burnoutRisk += 10;
    if (params.complianceAssumption === "OPTIMISTIC") burnoutRisk += 5;
    burnoutRisk -= recoveryBonus;
    burnoutRisk = Math.max(5, Math.min(95, burnoutRisk));
    
    if (burnoutRisk > BURNOUT_THRESHOLD) {
      warnings.push(`Week ${week}: Elevated burnout risk (${burnoutRisk}%). Consider reducing load.`);
      totalWarnings++;
    }
    
    peakBurnoutRisk = Math.max(peakBurnoutRisk, burnoutRisk);
    
    // Generate insights
    if (week === 1) {
      insights.push(`Starting from CTL ${Math.round(currentCTL)}, targeting ${Math.round(params.volumeChange)}% volume change`);
    }
    
    if (newCTL > currentCTL + 3) {
      insights.push(`Strong fitness gain this week (+${(newCTL - currentCTL).toFixed(1)} CTL)`);
    }
    
    if (readiness >= 70) {
      insights.push("Good readiness - body adapting well");
    } else if (readiness < 50) {
      insights.push("Low readiness - prioritize recovery");
    }
    
    if (week === durationWeeks) {
      const totalCTLGain = newCTL - baseline.ctl;
      insights.push(`Final projection: ${totalCTLGain > 0 ? "+" : ""}${totalCTLGain.toFixed(1)} CTL over ${durationWeeks} weeks`);
    }
    
    weeks.push({
      weekIndex: week,
      simulatedCTL: Math.round(newCTL * 10) / 10,
      simulatedATL: Math.round(newATL * 10) / 10,
      simulatedTSB: Math.round(newTSB * 10) / 10,
      simulatedReadinessAvg: readiness,
      simulatedBurnoutRisk: burnoutRisk,
      weeklyTSS: cappedTSS,
      insights,
      warnings,
    });
    
    // Update for next iteration
    currentCTL = newCTL;
    currentATL = newATL;
    previousWeekTSS = cappedTSS;
  }
  
  // Generate summary
  const finalWeek = weeks[weeks.length - 1];
  const ctlChange = finalWeek.simulatedCTL - baseline.ctl;
  
  let recommendation = "";
  if (totalWarnings === 0 && peakBurnoutRisk < 50) {
    recommendation = "This scenario appears safe and sustainable. Good balance of progress and recovery.";
  } else if (totalWarnings <= 2 && peakBurnoutRisk < 70) {
    recommendation = "Moderate risk scenario. Monitor closely and adjust if fatigue accumulates.";
  } else {
    recommendation = "High risk scenario. Consider reducing volume or intensity to avoid overtraining.";
  }
  
  return {
    weeks,
    summary: {
      finalCTL: finalWeek.simulatedCTL,
      finalATL: finalWeek.simulatedATL,
      finalTSB: finalWeek.simulatedTSB,
      ctlChange: Math.round(ctlChange * 10) / 10,
      peakBurnoutRisk,
      totalWarnings,
      recommendation,
    },
  };
}

/**
 * Compare multiple scenarios
 */
export function compareScenarios(
  baseline: BaselineMetrics,
  scenarios: { name: string; params: ScenarioParams; durationWeeks: number }[]
): {
  name: string;
  finalCTL: number;
  ctlChange: number;
  peakBurnoutRisk: number;
  totalWarnings: number;
  riskLevel: "LOW" | "MODERATE" | "HIGH";
}[] {
  return scenarios.map((scenario) => {
    const result = runSimulation(baseline, scenario.params, scenario.durationWeeks);
    
    let riskLevel: "LOW" | "MODERATE" | "HIGH" = "LOW";
    if (result.summary.totalWarnings > 2 || result.summary.peakBurnoutRisk >= 70) {
      riskLevel = "HIGH";
    } else if (result.summary.totalWarnings > 0 || result.summary.peakBurnoutRisk >= 50) {
      riskLevel = "MODERATE";
    }
    
    return {
      name: scenario.name,
      finalCTL: result.summary.finalCTL,
      ctlChange: result.summary.ctlChange,
      peakBurnoutRisk: result.summary.peakBurnoutRisk,
      totalWarnings: result.summary.totalWarnings,
      riskLevel,
    };
  });
}

/**
 * Get risk level color
 */
export function getRiskLevelColor(level: "LOW" | "MODERATE" | "HIGH"): string {
  switch (level) {
    case "LOW":
      return "text-green-500";
    case "MODERATE":
      return "text-yellow-500";
    case "HIGH":
      return "text-red-500";
  }
}

/**
 * Format scenario params for display
 */
export function formatScenarioParams(params: ScenarioParams): string {
  const parts = [
    `Volume: ${params.volumeChange >= 0 ? "+" : ""}${params.volumeChange}%`,
    `Intensity: ${params.intensityBias}`,
    `Recovery: ${params.recoveryFocus}`,
    `Compliance: ${params.complianceAssumption}`,
  ];
  if (params.identityModeOverride) {
    parts.push(`Mode: ${params.identityModeOverride}`);
  }
  return parts.join(" • ");
}

/**
 * Parse params JSON safely
 */
export function parseScenarioParams(json: string): ScenarioParams {
  try {
    const parsed = JSON.parse(json);
    return {
      volumeChange: parsed.volumeChange ?? 0,
      intensityBias: parsed.intensityBias ?? "BALANCED",
      recoveryFocus: parsed.recoveryFocus ?? "NORMAL",
      complianceAssumption: parsed.complianceAssumption ?? "REALISTIC",
      identityModeOverride: parsed.identityModeOverride,
    };
  } catch {
    return {
      volumeChange: 0,
      intensityBias: "BALANCED",
      recoveryFocus: "NORMAL",
      complianceAssumption: "REALISTIC",
    };
  }
}
