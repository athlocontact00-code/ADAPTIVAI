/**
 * Readiness Score Service
 * Computes athlete readiness (0-100) based on diary signals, training load, and optional HRV.
 */

export type ReadinessStatus = "OPTIMAL" | "CAUTION" | "FATIGUED";

export interface ReadinessFactor {
  factor: string;
  impact: number; // positive or negative
  description: string;
}

export interface ReadinessResult {
  score: number; // 0-100
  status: ReadinessStatus;
  factors: ReadinessFactor[];
  confidence: number; // 0-100
}

export interface DiarySignals {
  mood?: number | null; // 1-5
  energy?: number | null; // 1-5
  sleepHrs?: number | null;
  sleepQual?: number | null; // 1-5
  stress?: number | null; // 1-5
  soreness?: number | null; // 1-5
}

export interface LoadSignals {
  atl?: number | null; // Acute Training Load
  ctl?: number | null; // Chronic Training Load
  tsb?: number | null; // Training Stress Balance
  weeklyTss?: number | null;
}

export interface HRVSignals {
  hrv?: number | null;
  hrvBaseline?: number | null;
}

/**
 * Compute readiness score from available signals
 */
export function computeReadiness(
  diary: DiarySignals,
  load: LoadSignals,
  hrv?: HRVSignals
): ReadinessResult {
  const factors: ReadinessFactor[] = [];
  let baseScore = 70; // Start with neutral-good baseline
  let dataPoints = 0;

  // === DIARY SIGNALS ===
  
  // Sleep Quality (1-5) - Major factor
  if (diary.sleepQual != null) {
    dataPoints++;
    const sleepImpact = (diary.sleepQual - 3) * 8; // -16 to +16
    baseScore += sleepImpact;
    factors.push({
      factor: "sleep_quality",
      impact: sleepImpact,
      description: diary.sleepQual >= 4 ? "Good sleep quality" : diary.sleepQual <= 2 ? "Poor sleep quality" : "Average sleep",
    });
  }

  // Sleep Duration
  if (diary.sleepHrs != null) {
    dataPoints++;
    const optimalSleep = 7.5;
    const sleepDiff = diary.sleepHrs - optimalSleep;
    const sleepHrsImpact = Math.max(-12, Math.min(8, sleepDiff * 4));
    baseScore += sleepHrsImpact;
    factors.push({
      factor: "sleep_duration",
      impact: Math.round(sleepHrsImpact),
      description: diary.sleepHrs >= 7 ? `${diary.sleepHrs.toFixed(1)}h sleep` : `Only ${diary.sleepHrs.toFixed(1)}h sleep`,
    });
  }

  // Mood (1-5)
  if (diary.mood != null) {
    dataPoints++;
    const moodImpact = (diary.mood - 3) * 6; // -12 to +12
    baseScore += moodImpact;
    factors.push({
      factor: "mood",
      impact: moodImpact,
      description: diary.mood >= 4 ? "Positive mood" : diary.mood <= 2 ? "Low mood" : "Neutral mood",
    });
  }

  // Energy (1-5)
  if (diary.energy != null) {
    dataPoints++;
    const energyImpact = (diary.energy - 3) * 6; // -12 to +12
    baseScore += energyImpact;
    factors.push({
      factor: "energy",
      impact: energyImpact,
      description: diary.energy >= 4 ? "High energy" : diary.energy <= 2 ? "Low energy" : "Normal energy",
    });
  }

  // Stress (1-5, higher = worse)
  if (diary.stress != null) {
    dataPoints++;
    const stressImpact = (3 - diary.stress) * 5; // +10 to -10
    baseScore += stressImpact;
    factors.push({
      factor: "stress",
      impact: stressImpact,
      description: diary.stress <= 2 ? "Low stress" : diary.stress >= 4 ? "High stress" : "Moderate stress",
    });
  }

  // Soreness (1-5, higher = worse)
  if (diary.soreness != null) {
    dataPoints++;
    const sorenessImpact = (3 - diary.soreness) * 6; // +12 to -12
    baseScore += sorenessImpact;
    factors.push({
      factor: "soreness",
      impact: sorenessImpact,
      description: diary.soreness <= 2 ? "Fresh muscles" : diary.soreness >= 4 ? "Significant soreness" : "Some soreness",
    });
  }

  // === LOAD SIGNALS ===
  
  // TSB (Training Stress Balance) - Key indicator
  if (load.tsb != null) {
    dataPoints++;
    // TSB typically ranges from -30 to +30
    // Positive = fresh, Negative = fatigued
    const tsbImpact = Math.max(-15, Math.min(15, load.tsb * 0.8));
    baseScore += tsbImpact;
    factors.push({
      factor: "training_balance",
      impact: Math.round(tsbImpact),
      description: load.tsb > 5 ? "Well recovered" : load.tsb < -10 ? "Accumulated fatigue" : "Normal training load",
    });
  }

  // ATL vs CTL ratio (acute vs chronic)
  if (load.atl != null && load.ctl != null && load.ctl > 0) {
    dataPoints++;
    const ratio = load.atl / load.ctl;
    // Optimal ratio ~0.8-1.2, >1.3 = risk, <0.7 = detrained
    let ratioImpact = 0;
    if (ratio > 1.4) ratioImpact = -10;
    else if (ratio > 1.2) ratioImpact = -5;
    else if (ratio < 0.6) ratioImpact = -3;
    else ratioImpact = 3;
    
    baseScore += ratioImpact;
    factors.push({
      factor: "load_ratio",
      impact: ratioImpact,
      description: ratio > 1.3 ? "High acute load" : ratio < 0.7 ? "Low recent training" : "Balanced load",
    });
  }

  // === HRV SIGNALS (Optional) ===
  if (hrv?.hrv != null && hrv?.hrvBaseline != null && hrv.hrvBaseline > 0) {
    dataPoints++;
    const hrvPct = ((hrv.hrv - hrv.hrvBaseline) / hrv.hrvBaseline) * 100;
    const hrvImpact = Math.max(-15, Math.min(10, hrvPct * 0.5));
    baseScore += hrvImpact;
    factors.push({
      factor: "hrv",
      impact: Math.round(hrvImpact),
      description: hrvPct > 5 ? "HRV above baseline" : hrvPct < -10 ? "HRV below baseline" : "HRV normal",
    });
  }

  // === FINAL CALCULATIONS ===
  
  // Clamp score to 0-100
  const finalScore = Math.max(0, Math.min(100, Math.round(baseScore)));

  // Determine status
  let status: ReadinessStatus;
  if (finalScore >= 70) {
    status = "OPTIMAL";
  } else if (finalScore >= 45) {
    status = "CAUTION";
  } else {
    status = "FATIGUED";
  }

  // Confidence based on data availability
  // More data points = higher confidence
  const maxDataPoints = 8; // diary(6) + load(2)
  const confidence = Math.min(100, Math.round((dataPoints / maxDataPoints) * 100 + 20));

  // Sort factors by absolute impact
  factors.sort((a, b) => Math.abs(b.impact) - Math.abs(a.impact));

  return {
    score: finalScore,
    status,
    factors: factors.slice(0, 5), // Top 5 factors
    confidence: Math.min(100, confidence),
  };
}

/**
 * Format factors as JSON for storage
 */
export function formatFactorsJson(factors: ReadinessFactor[]): string {
  const obj: Record<string, number> = {};
  for (const f of factors.slice(0, 3)) {
    obj[f.factor] = f.impact;
  }
  return JSON.stringify(obj);
}

/**
 * Get status color for UI
 */
export function getReadinessColor(status: ReadinessStatus): string {
  switch (status) {
    case "OPTIMAL":
      return "green";
    case "CAUTION":
      return "yellow";
    case "FATIGUED":
      return "red";
  }
}

/**
 * Get explanation based on explainLevel
 */
export function getReadinessExplanation(
  result: ReadinessResult,
  explainLevel: "minimal" | "standard" | "deep"
): string {
  if (explainLevel === "minimal") {
    return `Readiness: ${result.status.toLowerCase()}`;
  }

  if (explainLevel === "standard") {
    const topFactor = result.factors[0];
    return `${result.score}/100 - ${topFactor?.description || result.status}`;
  }

  // Deep explanation
  const factorDescriptions = result.factors
    .slice(0, 3)
    .map((f) => `${f.description} (${f.impact > 0 ? "+" : ""}${f.impact})`)
    .join(", ");
  return `Readiness ${result.score}/100 (${result.confidence}% confidence). Key factors: ${factorDescriptions}`;
}
