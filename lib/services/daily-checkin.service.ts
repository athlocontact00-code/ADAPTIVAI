/**
 * Daily Check-In & Pre-Training Adaptation Service
 * Evaluates athlete readiness and adapts workouts accordingly.
 * Deterministic, offline, explainable AI logic.
 */

export type MuscleSoreness = "NONE" | "MILD" | "MODERATE" | "SEVERE";

export type AIDecision = 
  | "PROCEED"           // Keep workout unchanged
  | "REDUCE_INTENSITY"  // Lower intensity by 10-20%
  | "SHORTEN"           // Reduce duration by 20-30%
  | "SWAP_RECOVERY"     // Replace with recovery session
  | "REST";             // Recommend rest day

export interface CheckInData {
  sleepDuration: number;    // Hours
  sleepQuality: number;     // 1-5
  physicalFatigue: number;  // 1-5 (1=fresh, 5=exhausted)
  mentalReadiness: number;  // 1-5 (1=not ready, 5=fully ready)
  motivation: number;       // 1-5
  muscleSoreness: MuscleSoreness;
  stressLevel: number;      // 1-5
  notes?: string;
}

export interface TrainingContext {
  ctl: number;              // Chronic Training Load
  atl: number;              // Acute Training Load
  tsb: number;              // Training Stress Balance (form)
  yesterdayTSS: number;     // Yesterday's training stress
  plannedTSS: number;       // Today's planned TSS
  plannedDuration: number;  // Today's planned duration (minutes)
  workoutType: string;      // run, bike, swim, strength, etc.
}

export interface EvaluationResult {
  decision: AIDecision;
  confidence: number;       // 0-100
  explanation: string;      // Human-readable, coaching language
  reasons: EvaluationReason[];
  adaptations: WorkoutAdaptation[];
}

export interface EvaluationReason {
  factor: string;
  value: number | string;
  impact: "positive" | "negative" | "neutral";
  description: string;
}

export interface WorkoutAdaptation {
  type: "intensity" | "duration" | "type" | "rest";
  originalValue: string | number;
  adaptedValue: string | number;
  reason: string;
}

/**
 * Calculate readiness score from check-in data (0-100)
 */
export function calculateReadinessScore(checkIn: CheckInData): number {
  // Sleep component (0-30 points)
  const sleepDurationScore = Math.min(checkIn.sleepDuration / 8, 1) * 15;
  const sleepQualityScore = (checkIn.sleepQuality / 5) * 15;
  const sleepScore = sleepDurationScore + sleepQualityScore;

  // Physical state component (0-30 points)
  const fatigueScore = ((6 - checkIn.physicalFatigue) / 5) * 15; // Inverse
  const sorenessScore = getSorenessScore(checkIn.muscleSoreness);
  const physicalScore = fatigueScore + sorenessScore;

  // Mental state component (0-40 points)
  const mentalScore = (checkIn.mentalReadiness / 5) * 15;
  const motivationScore = (checkIn.motivation / 5) * 15;
  const stressScore = ((6 - checkIn.stressLevel) / 5) * 10; // Inverse
  const mentalTotal = mentalScore + motivationScore + stressScore;

  return Math.round(sleepScore + physicalScore + mentalTotal);
}

function getSorenessScore(soreness: MuscleSoreness): number {
  switch (soreness) {
    case "NONE": return 15;
    case "MILD": return 10;
    case "MODERATE": return 5;
    case "SEVERE": return 0;
  }
}

/**
 * Decision mapping table for readiness score.
 *
 * | Readiness Score | Decision          |
 * |-----------------|-------------------|
 * | >= 70           | PROCEED           |
 * | 50 - 69         | REDUCE_INTENSITY  |
 * | 40 - 49         | SHORTEN           |
 * | 30 - 39         | SWAP_RECOVERY     |
 * | < 30            | REST              |
 */
export function mapScoreToDecision(score: number): AIDecision {
  if (score >= 70) return "PROCEED";
  if (score >= 50) return "REDUCE_INTENSITY";
  if (score >= 40) return "SHORTEN";
  if (score >= 30) return "SWAP_RECOVERY";
  return "REST";
}

/**
 * Evaluate pre-training readiness and determine workout adaptation
 */
export function evaluatePreTraining(
  checkIn: CheckInData,
  context: TrainingContext
): EvaluationResult {
  const readinessScore = calculateReadinessScore(checkIn);
  const reasons: EvaluationReason[] = [];
  const adaptations: WorkoutAdaptation[] = [];

  // Analyze each factor
  analyzeSleep(checkIn, reasons);
  analyzePhysicalState(checkIn, reasons);
  analyzeMentalState(checkIn, reasons);
  analyzeTrainingLoad(context, reasons);

  // Determine decision based on readiness and context
  const { decision, confidence } = determineDecision(readinessScore, checkIn, context, reasons);

  // Generate adaptations based on decision
  generateAdaptations(decision, context, adaptations, reasons);

  // Generate human-readable explanation
  const explanation = generateExplanation(decision, readinessScore, reasons);

  return {
    decision,
    confidence,
    explanation,
    reasons,
    adaptations,
  };
}

function analyzeSleep(checkIn: CheckInData, reasons: EvaluationReason[]): void {
  // Sleep duration
  if (checkIn.sleepDuration < 6) {
    reasons.push({
      factor: "Sleep Duration",
      value: checkIn.sleepDuration,
      impact: "negative",
      description: `Only ${checkIn.sleepDuration} hours of sleep - below optimal recovery threshold`,
    });
  } else if (checkIn.sleepDuration >= 7.5) {
    reasons.push({
      factor: "Sleep Duration",
      value: checkIn.sleepDuration,
      impact: "positive",
      description: `${checkIn.sleepDuration} hours of quality rest`,
    });
  }

  // Sleep quality
  if (checkIn.sleepQuality <= 2) {
    reasons.push({
      factor: "Sleep Quality",
      value: checkIn.sleepQuality,
      impact: "negative",
      description: "Poor sleep quality affects recovery and performance",
    });
  } else if (checkIn.sleepQuality >= 4) {
    reasons.push({
      factor: "Sleep Quality",
      value: checkIn.sleepQuality,
      impact: "positive",
      description: "Good sleep quality supports optimal performance",
    });
  }
}

function analyzePhysicalState(checkIn: CheckInData, reasons: EvaluationReason[]): void {
  // Physical fatigue
  if (checkIn.physicalFatigue >= 4) {
    reasons.push({
      factor: "Physical Fatigue",
      value: checkIn.physicalFatigue,
      impact: "negative",
      description: "High physical fatigue - body needs more recovery time",
    });
  } else if (checkIn.physicalFatigue <= 2) {
    reasons.push({
      factor: "Physical Fatigue",
      value: checkIn.physicalFatigue,
      impact: "positive",
      description: "Feeling physically fresh and recovered",
    });
  }

  // Muscle soreness
  if (checkIn.muscleSoreness === "SEVERE") {
    reasons.push({
      factor: "Muscle Soreness",
      value: checkIn.muscleSoreness,
      impact: "negative",
      description: "Severe muscle soreness - training may worsen recovery",
    });
  } else if (checkIn.muscleSoreness === "MODERATE") {
    reasons.push({
      factor: "Muscle Soreness",
      value: checkIn.muscleSoreness,
      impact: "negative",
      description: "Moderate soreness - consider reducing intensity",
    });
  }
}

function analyzeMentalState(checkIn: CheckInData, reasons: EvaluationReason[]): void {
  // Mental readiness
  if (checkIn.mentalReadiness <= 2) {
    reasons.push({
      factor: "Mental Readiness",
      value: checkIn.mentalReadiness,
      impact: "negative",
      description: "Low mental readiness - forcing training may be counterproductive",
    });
  } else if (checkIn.mentalReadiness >= 4) {
    reasons.push({
      factor: "Mental Readiness",
      value: checkIn.mentalReadiness,
      impact: "positive",
      description: "Mentally prepared and focused",
    });
  }

  // Motivation
  if (checkIn.motivation <= 2) {
    reasons.push({
      factor: "Motivation",
      value: checkIn.motivation,
      impact: "negative",
      description: "Low motivation - consider a lighter or more enjoyable session",
    });
  } else if (checkIn.motivation >= 4) {
    reasons.push({
      factor: "Motivation",
      value: checkIn.motivation,
      impact: "positive",
      description: "High motivation - great mindset for training",
    });
  }

  // Stress level
  if (checkIn.stressLevel >= 4) {
    reasons.push({
      factor: "Stress Level",
      value: checkIn.stressLevel,
      impact: "negative",
      description: "High stress levels - training may add to overall load",
    });
  }
}

function analyzeTrainingLoad(context: TrainingContext, reasons: EvaluationReason[]): void {
  // TSB (form)
  if (context.tsb < -20) {
    reasons.push({
      factor: "Training Form (TSB)",
      value: context.tsb,
      impact: "negative",
      description: "Deep fatigue state - accumulated training load is high",
    });
  } else if (context.tsb > 10) {
    reasons.push({
      factor: "Training Form (TSB)",
      value: context.tsb,
      impact: "positive",
      description: "Fresh and well-recovered",
    });
  }

  // Yesterday's load
  if (context.yesterdayTSS > 100) {
    reasons.push({
      factor: "Yesterday's Load",
      value: context.yesterdayTSS,
      impact: "negative",
      description: "Heavy training yesterday - may still be recovering",
    });
  }
}

function determineDecision(
  readinessScore: number,
  checkIn: CheckInData,
  _context: TrainingContext,
  reasons: EvaluationReason[]
): { decision: AIDecision; confidence: number } {
  const decision = mapScoreToDecision(readinessScore);
  const confidence = calculateConfidence(readinessScore, reasons);
  return { decision, confidence };
}

function generateAdaptations(
  decision: AIDecision,
  context: TrainingContext,
  adaptations: WorkoutAdaptation[],
  reasons: EvaluationReason[]
): void {
  switch (decision) {
    case "REDUCE_INTENSITY":
      adaptations.push({
        type: "intensity",
        originalValue: "100%",
        adaptedValue: "80-85%",
        reason: "Reducing intensity to match current readiness",
      });
      break;

    case "SHORTEN":
      const reducedDuration = Math.round(context.plannedDuration * 0.7);
      adaptations.push({
        type: "duration",
        originalValue: `${context.plannedDuration} min`,
        adaptedValue: `${reducedDuration} min`,
        reason: "Shortening session to prevent overreaching",
      });
      adaptations.push({
        type: "intensity",
        originalValue: "100%",
        adaptedValue: "85-90%",
        reason: "Slightly reducing intensity for shorter session",
      });
      break;

    case "SWAP_RECOVERY":
      adaptations.push({
        type: "type",
        originalValue: context.workoutType,
        adaptedValue: "Recovery",
        reason: "Swapping to recovery session for optimal adaptation",
      });
      adaptations.push({
        type: "duration",
        originalValue: `${context.plannedDuration} min`,
        adaptedValue: "30-45 min",
        reason: "Light movement to promote blood flow and recovery",
      });
      break;

    case "REST":
      adaptations.push({
        type: "rest",
        originalValue: context.workoutType,
        adaptedValue: "Rest Day",
        reason: "Complete rest recommended for recovery",
      });
      break;

    case "PROCEED":
      // No adaptations needed
      break;
  }
}

function generateExplanation(
  decision: AIDecision,
  readinessScore: number,
  reasons: EvaluationReason[]
): string {
  const negativeReasons = reasons.filter(r => r.impact === "negative");
  const positiveReasons = reasons.filter(r => r.impact === "positive");

  let explanation: string;
  switch (decision) {
    case "PROCEED":
      if (positiveReasons.length > 0) {
        explanation = `You're in a good place today! Your readiness score is ${readinessScore}/100. ${positiveReasons[0].description}. Let's make the most of this session.`;
      } else {
        explanation = `Your readiness looks solid at ${readinessScore}/100. You're good to go with today's planned workout.`;
      }
      break;

    case "REDUCE_INTENSITY":
      {
        const intensityReason = negativeReasons[0]?.description || "some signals suggest caution";
        explanation = `I'd suggest dialing back the intensity a bit today. ${intensityReason}. Training at 80-85% will still give you a quality session while respecting your body's signals.`;
      }
      break;

    case "SHORTEN":
      {
        const shortenReason = negativeReasons[0]?.description || "your body is asking for a lighter day";
        explanation = `Let's make today a shorter session. ${shortenReason}. A focused 70% duration workout will keep you on track without pushing too hard.`;
      }
      break;

    case "SWAP_RECOVERY":
      {
        const recoveryReason = negativeReasons.slice(0, 2).map(r => r.description.toLowerCase()).join(" and ");
        explanation = `Today might be better as a recovery day. ${recoveryReason || "Multiple signals suggest your body needs gentler movement"}. Light activity will actually help you bounce back faster.`;
      }
      break;

    case "REST":
      explanation = `I'm recommending a rest day today. Your body is sending clear signals that it needs recovery. Taking today off will help you come back stronger for your next session.`;
      break;

    default:
      explanation = `Readiness score: ${readinessScore}/100`;
  }

  return limitSentences(explanation, 3);
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
      return { label: "Proceed as Planned", color: "text-green-500", icon: "check" };
    case "REDUCE_INTENSITY":
      return { label: "Reduce Intensity", color: "text-yellow-500", icon: "trending-down" };
    case "SHORTEN":
      return { label: "Shorten Session", color: "text-orange-500", icon: "clock" };
    case "SWAP_RECOVERY":
      return { label: "Recovery Session", color: "text-blue-500", icon: "heart" };
    case "REST":
      return { label: "Rest Day", color: "text-purple-500", icon: "moon" };
    default:
      return { label: decision, color: "text-muted-foreground", icon: "help" };
  }
}

/**
 * Weekly aggregation for pattern detection
 */
export interface WeeklyCheckInSummary {
  weekStart: Date;
  weekEnd: Date;
  checkInCount: number;
  avgReadiness: number;
  avgSleepDuration: number;
  avgSleepQuality: number;
  avgPhysicalFatigue: number;
  avgMentalReadiness: number;
  avgMotivation: number;
  avgStressLevel: number;
  severesorenessCount: number;
  patterns: DetectedPattern[];
}

export interface DetectedPattern {
  type: "CHRONIC_FATIGUE" | "MOTIVATION_DROP" | "STRESS_ACCUMULATION" | "SLEEP_DEFICIT" | "POSITIVE_TREND";
  severity: "LOW" | "MEDIUM" | "HIGH";
  description: string;
  recommendation: string;
}

export function detectPatterns(checkIns: CheckInData[]): DetectedPattern[] {
  const patterns: DetectedPattern[] = [];

  if (checkIns.length < 3) return patterns;

  // Calculate averages
  const avgFatigue = checkIns.reduce((sum, c) => sum + c.physicalFatigue, 0) / checkIns.length;
  const avgMotivation = checkIns.reduce((sum, c) => sum + c.motivation, 0) / checkIns.length;
  const avgStress = checkIns.reduce((sum, c) => sum + c.stressLevel, 0) / checkIns.length;
  const avgSleep = checkIns.reduce((sum, c) => sum + c.sleepDuration, 0) / checkIns.length;

  // Chronic fatigue detection
  if (avgFatigue >= 3.5) {
    patterns.push({
      type: "CHRONIC_FATIGUE",
      severity: avgFatigue >= 4 ? "HIGH" : "MEDIUM",
      description: `Average fatigue level of ${avgFatigue.toFixed(1)}/5 over the past ${checkIns.length} days`,
      recommendation: "Consider a deload week or additional recovery days",
    });
  }

  // Motivation drop detection
  if (avgMotivation <= 2.5) {
    patterns.push({
      type: "MOTIVATION_DROP",
      severity: avgMotivation <= 2 ? "HIGH" : "MEDIUM",
      description: `Motivation averaging ${avgMotivation.toFixed(1)}/5 - below optimal levels`,
      recommendation: "Mix up training with enjoyable activities or take a mental break",
    });
  }

  // Stress accumulation
  if (avgStress >= 3.5) {
    patterns.push({
      type: "STRESS_ACCUMULATION",
      severity: avgStress >= 4 ? "HIGH" : "MEDIUM",
      description: `Elevated stress levels averaging ${avgStress.toFixed(1)}/5`,
      recommendation: "Prioritize stress management and consider reducing training volume",
    });
  }

  // Sleep deficit
  if (avgSleep < 6.5) {
    patterns.push({
      type: "SLEEP_DEFICIT",
      severity: avgSleep < 6 ? "HIGH" : "MEDIUM",
      description: `Average sleep of ${avgSleep.toFixed(1)} hours - below recovery threshold`,
      recommendation: "Focus on sleep hygiene and aim for 7-8 hours nightly",
    });
  }

  // Positive trend (if things are good)
  if (avgFatigue <= 2 && avgMotivation >= 4 && avgStress <= 2) {
    patterns.push({
      type: "POSITIVE_TREND",
      severity: "LOW",
      description: "Great balance of recovery, motivation, and stress management",
      recommendation: "Keep up the good work! You're in a great training state",
    });
  }

  return patterns;
}

function limitSentences(text: string, maxSentences: number): string {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (!normalized) return "";
  const sentences = normalized.match(/[^.!?]+[.!?]?/g);
  if (!sentences) return normalized;
  return sentences.slice(0, maxSentences).join(" ").trim();
}

function calculateConfidence(readinessScore: number, reasons: EvaluationReason[]): number {
  const positiveCount = reasons.filter(r => r.impact === "positive").length;
  const negativeCount = reasons.filter(r => r.impact === "negative").length;
  const base = Math.round(readinessScore);
  const adjustment = Math.max(-10, Math.min(8, (positiveCount - negativeCount) * 3));
  const raw = base + adjustment + 5;
  return Math.max(35, Math.min(95, raw));
}
