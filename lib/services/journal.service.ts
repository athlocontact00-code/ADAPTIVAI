/**
 * Intelligent Journal Service
 * Pattern detection, correlation analysis, and AI insights.
 * Deterministic, offline, explainable.
 */

import { getDateKey } from "@/lib/utils";

export type InsightType =
  | "NEGATIVE_STREAK"
  | "BURNOUT_SIGNAL"
  | "MOTIVATION_DROP"
  | "SLEEP_PATTERN"
  | "STRESS_PATTERN"
  | "POSITIVE_TREND";

export type Severity = "LOW" | "MEDIUM" | "HIGH";

export type VisibilityLevel = "FULL_AI_ACCESS" | "METRICS_ONLY" | "HIDDEN";

export interface JournalEntry {
  id: string;
  date: Date;
  mood: number | null;
  energy: number | null;
  sleepHrs: number | null;
  sleepQual: number | null;
  stress: number | null;
  soreness: number | null;
  motivation: number | null;
  notes: string | null;
  visibilityLevel: VisibilityLevel;
}

export interface MetricEntry {
  date: Date;
  tss: number | null;
  ctl: number | null;
  atl: number | null;
  tsb: number | null;
  readinessScore: number | null;
}

export interface DetectedInsight {
  type: InsightType;
  severity: Severity;
  title: string;
  message: string;
  suggestion: string;
  startDate: Date;
  endDate: Date;
  dataPoints: { date: string; value: number }[];
}

// ============================================
// PATTERN DETECTION
// ============================================

/**
 * Detect negative mood streak (3+ days of mood ≤ 2)
 */
export function detectNegativeStreak(entries: JournalEntry[]): DetectedInsight | null {
  const validEntries = entries
    .filter((e) => e.mood !== null && e.visibilityLevel !== "HIDDEN")
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  let streak = 0;
  const streakEntries: JournalEntry[] = [];

  for (const entry of validEntries) {
    if (entry.mood !== null && entry.mood <= 2) {
      streak++;
      streakEntries.push(entry);
    } else {
      break;
    }
  }

  if (streak >= 3) {
    const severity: Severity = streak >= 5 ? "HIGH" : streak >= 4 ? "MEDIUM" : "LOW";
    return {
      type: "NEGATIVE_STREAK",
      severity,
      title: "Low mood pattern detected",
      message: `You've had ${streak} consecutive days with low mood. This is worth paying attention to.`,
      suggestion: "Consider a lighter training day or some active recovery. Sometimes a break helps more than pushing through.",
      startDate: new Date(streakEntries[streakEntries.length - 1].date),
      endDate: new Date(streakEntries[0].date),
      dataPoints: streakEntries.map((e) => ({
        date: getDateKey(new Date(e.date)),
        value: e.mood!,
      })),
    };
  }

  return null;
}

/**
 * Detect burnout signals (high stress + low energy + low motivation)
 */
export function detectBurnoutSignal(entries: JournalEntry[]): DetectedInsight | null {
  const recentEntries = entries
    .filter((e) => e.visibilityLevel !== "HIDDEN")
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 7);

  if (recentEntries.length < 3) return null;

  let burnoutDays = 0;
  const burnoutEntries: JournalEntry[] = [];

  for (const entry of recentEntries) {
    const highStress = entry.stress !== null && entry.stress >= 4;
    const lowEnergy = entry.energy !== null && entry.energy <= 2;
    const lowMotivation = entry.motivation !== null && entry.motivation <= 2;

    // Burnout signal: at least 2 of 3 indicators
    const indicators = [highStress, lowEnergy, lowMotivation].filter(Boolean).length;
    if (indicators >= 2) {
      burnoutDays++;
      burnoutEntries.push(entry);
    }
  }

  if (burnoutDays >= 3) {
    const severity: Severity = burnoutDays >= 5 ? "HIGH" : burnoutDays >= 4 ? "MEDIUM" : "LOW";
    return {
      type: "BURNOUT_SIGNAL",
      severity,
      title: "Burnout warning signs",
      message: `${burnoutDays} of your last 7 days show signs of burnout: high stress combined with low energy or motivation.`,
      suggestion: "This is your body asking for rest. Consider reducing training volume this week and prioritizing sleep.",
      startDate: new Date(burnoutEntries[burnoutEntries.length - 1].date),
      endDate: new Date(burnoutEntries[0].date),
      dataPoints: burnoutEntries.map((e) => ({
        date: getDateKey(new Date(e.date)),
        value: (e.stress || 0) - (e.energy || 0), // Stress-energy gap
      })),
    };
  }

  return null;
}

/**
 * Detect motivation drop (declining trend over 5+ days)
 */
export function detectMotivationDrop(entries: JournalEntry[]): DetectedInsight | null {
  const validEntries = entries
    .filter((e) => e.motivation !== null && e.visibilityLevel !== "HIDDEN")
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .slice(-7);

  if (validEntries.length < 5) return null;

  // Check for declining trend
  let declineCount = 0;
  for (let i = 1; i < validEntries.length; i++) {
    if (validEntries[i].motivation! < validEntries[i - 1].motivation!) {
      declineCount++;
    }
  }

  // Also check if current motivation is low
  const currentMotivation = validEntries[validEntries.length - 1].motivation!;
  const startMotivation = validEntries[0].motivation!;

  if (declineCount >= 3 && currentMotivation <= 2 && startMotivation > currentMotivation) {
    const drop = startMotivation - currentMotivation;
    const severity: Severity = drop >= 3 ? "HIGH" : drop >= 2 ? "MEDIUM" : "LOW";

    return {
      type: "MOTIVATION_DROP",
      severity,
      title: "Motivation trending down",
      message: `Your motivation has dropped from ${startMotivation}/5 to ${currentMotivation}/5 over the past week.`,
      suggestion: "Try mixing up your training with something fun, or set a small achievable goal to rebuild momentum.",
      startDate: new Date(validEntries[0].date),
      endDate: new Date(validEntries[validEntries.length - 1].date),
      dataPoints: validEntries.map((e) => ({
        date: getDateKey(new Date(e.date)),
        value: e.motivation!,
      })),
    };
  }

  return null;
}

/**
 * Detect poor sleep pattern (3+ days of sleep quality ≤ 2 or < 6 hours)
 */
export function detectSleepPattern(entries: JournalEntry[]): DetectedInsight | null {
  const recentEntries = entries
    .filter((e) => e.visibilityLevel !== "HIDDEN")
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 7);

  let poorSleepDays = 0;
  const poorSleepEntries: JournalEntry[] = [];

  for (const entry of recentEntries) {
    const poorQuality = entry.sleepQual !== null && entry.sleepQual <= 2;
    const shortSleep = entry.sleepHrs !== null && entry.sleepHrs < 6;

    if (poorQuality || shortSleep) {
      poorSleepDays++;
      poorSleepEntries.push(entry);
    }
  }

  if (poorSleepDays >= 3) {
    const severity: Severity = poorSleepDays >= 5 ? "HIGH" : poorSleepDays >= 4 ? "MEDIUM" : "LOW";
    return {
      type: "SLEEP_PATTERN",
      severity,
      title: "Sleep needs attention",
      message: `${poorSleepDays} of your last 7 days had poor sleep quality or duration.`,
      suggestion: "Sleep is when your body adapts to training. Try setting a consistent bedtime and limiting screens before bed.",
      startDate: new Date(poorSleepEntries[poorSleepEntries.length - 1].date),
      endDate: new Date(poorSleepEntries[0].date),
      dataPoints: poorSleepEntries.map((e) => ({
        date: getDateKey(new Date(e.date)),
        value: e.sleepQual || 0,
      })),
    };
  }

  return null;
}

/**
 * Detect high stress pattern (4+ days of stress ≥ 4)
 */
export function detectStressPattern(entries: JournalEntry[]): DetectedInsight | null {
  const recentEntries = entries
    .filter((e) => e.stress !== null && e.visibilityLevel !== "HIDDEN")
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 7);

  let highStressDays = 0;
  const highStressEntries: JournalEntry[] = [];

  for (const entry of recentEntries) {
    if (entry.stress !== null && entry.stress >= 4) {
      highStressDays++;
      highStressEntries.push(entry);
    }
  }

  if (highStressDays >= 4) {
    const severity: Severity = highStressDays >= 6 ? "HIGH" : highStressDays >= 5 ? "MEDIUM" : "LOW";
    return {
      type: "STRESS_PATTERN",
      severity,
      title: "Elevated stress levels",
      message: `You've reported high stress on ${highStressDays} of the last 7 days.`,
      suggestion: "High stress impacts recovery. Consider adding some relaxation practices or reducing training intensity.",
      startDate: new Date(highStressEntries[highStressEntries.length - 1].date),
      endDate: new Date(highStressEntries[0].date),
      dataPoints: highStressEntries.map((e) => ({
        date: getDateKey(new Date(e.date)),
        value: e.stress!,
      })),
    };
  }

  return null;
}

/**
 * Detect positive trend (improvement in mood/energy/motivation)
 */
export function detectPositiveTrend(entries: JournalEntry[]): DetectedInsight | null {
  const validEntries = entries
    .filter((e) => e.visibilityLevel !== "HIDDEN")
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .slice(-7);

  if (validEntries.length < 5) return null;

  // Calculate average of first half vs second half
  const midpoint = Math.floor(validEntries.length / 2);
  const firstHalf = validEntries.slice(0, midpoint);
  const secondHalf = validEntries.slice(midpoint);

  const avgFirst = calculateAverageWellbeing(firstHalf);
  const avgSecond = calculateAverageWellbeing(secondHalf);

  if (avgSecond > avgFirst + 0.5 && avgSecond >= 3.5) {
    return {
      type: "POSITIVE_TREND",
      severity: "LOW", // Positive insights are always gentle
      title: "Things are looking up! 🌟",
      message: `Your overall wellbeing has improved over the past week. Keep up the good work!`,
      suggestion: "You're in a good place. This might be a good time to push a bit harder if you're feeling it.",
      startDate: new Date(validEntries[0].date),
      endDate: new Date(validEntries[validEntries.length - 1].date),
      dataPoints: validEntries.map((e) => ({
        date: getDateKey(new Date(e.date)),
        value: calculateEntryWellbeing(e),
      })),
    };
  }

  return null;
}

function calculateEntryWellbeing(entry: JournalEntry): number {
  const scores = [entry.mood, entry.energy, entry.motivation].filter(
    (s) => s !== null
  ) as number[];
  if (scores.length === 0) return 0;
  return scores.reduce((a, b) => a + b, 0) / scores.length;
}

function calculateAverageWellbeing(entries: JournalEntry[]): number {
  const scores = entries.map(calculateEntryWellbeing).filter((s) => s > 0);
  if (scores.length === 0) return 0;
  return scores.reduce((a, b) => a + b, 0) / scores.length;
}

/**
 * Run all pattern detections
 */
export function detectAllPatterns(entries: JournalEntry[]): DetectedInsight[] {
  const insights: DetectedInsight[] = [];

  const negativeStreak = detectNegativeStreak(entries);
  if (negativeStreak) insights.push(negativeStreak);

  const burnoutSignal = detectBurnoutSignal(entries);
  if (burnoutSignal) insights.push(burnoutSignal);

  const motivationDrop = detectMotivationDrop(entries);
  if (motivationDrop) insights.push(motivationDrop);

  const sleepPattern = detectSleepPattern(entries);
  if (sleepPattern) insights.push(sleepPattern);

  const stressPattern = detectStressPattern(entries);
  if (stressPattern) insights.push(stressPattern);

  const positiveTrend = detectPositiveTrend(entries);
  if (positiveTrend) insights.push(positiveTrend);

  // Sort by severity (HIGH first)
  const severityOrder: Record<Severity, number> = { HIGH: 0, MEDIUM: 1, LOW: 2 };
  insights.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

  return insights;
}

// ============================================
// CORRELATION ANALYSIS
// ============================================

export interface CorrelationResult {
  metric1: string;
  metric2: string;
  correlation: number; // -1 to 1
  strength: "STRONG" | "MODERATE" | "WEAK" | "NONE";
  direction: "POSITIVE" | "NEGATIVE" | "NONE";
  insight: string;
}

/**
 * Calculate Pearson correlation coefficient
 */
function pearsonCorrelation(x: number[], y: number[]): number {
  if (x.length !== y.length || x.length < 3) return 0;

  const n = x.length;
  const sumX = x.reduce((a, b) => a + b, 0);
  const sumY = y.reduce((a, b) => a + b, 0);
  const sumXY = x.reduce((acc, xi, i) => acc + xi * y[i], 0);
  const sumX2 = x.reduce((acc, xi) => acc + xi * xi, 0);
  const sumY2 = y.reduce((acc, yi) => acc + yi * yi, 0);

  const numerator = n * sumXY - sumX * sumY;
  const denominator = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));

  if (denominator === 0) return 0;
  return numerator / denominator;
}

/**
 * Analyze correlations between journal and performance metrics
 */
export function analyzeCorrelations(
  journalEntries: JournalEntry[],
  metrics: MetricEntry[]
): CorrelationResult[] {
  const results: CorrelationResult[] = [];

  // Match entries by date
  const journalByDate = new Map(
    journalEntries
      .filter((e) => e.visibilityLevel !== "HIDDEN")
      .map((e) => [getDateKey(new Date(e.date)), e])
  );
  const metricsByDate = new Map(
    metrics.map((m) => [getDateKey(new Date(m.date)), m])
  );

  // Get common dates
  const commonDates = [...journalByDate.keys()].filter((d) => metricsByDate.has(d));
  if (commonDates.length < 5) return results;

  // Mood vs Readiness
  const moodValues = commonDates
    .map((d) => journalByDate.get(d)?.mood)
    .filter((v) => v !== null && v !== undefined) as number[];
  const readinessValues = commonDates
    .map((d) => metricsByDate.get(d)?.readinessScore)
    .filter((v) => v !== null && v !== undefined) as number[];

  if (moodValues.length >= 5 && readinessValues.length >= 5) {
    const corr = pearsonCorrelation(moodValues, readinessValues);
    results.push(formatCorrelation("Mood", "Readiness", corr));
  }

  // Sleep Quality vs TSB (Form)
  const sleepValues = commonDates
    .map((d) => journalByDate.get(d)?.sleepQual)
    .filter((v) => v !== null && v !== undefined) as number[];
  const tsbValues = commonDates
    .map((d) => metricsByDate.get(d)?.tsb)
    .filter((v) => v !== null && v !== undefined) as number[];

  if (sleepValues.length >= 5 && tsbValues.length >= 5) {
    const corr = pearsonCorrelation(sleepValues, tsbValues);
    results.push(formatCorrelation("Sleep Quality", "Form (TSB)", corr));
  }

  // Stress vs Training Load (ATL)
  const stressValues = commonDates
    .map((d) => journalByDate.get(d)?.stress)
    .filter((v) => v !== null && v !== undefined) as number[];
  const atlValues = commonDates
    .map((d) => metricsByDate.get(d)?.atl)
    .filter((v) => v !== null && v !== undefined) as number[];

  if (stressValues.length >= 5 && atlValues.length >= 5) {
    const corr = pearsonCorrelation(stressValues, atlValues);
    results.push(formatCorrelation("Stress", "Training Load", corr));
  }

  return results;
}

function formatCorrelation(metric1: string, metric2: string, correlation: number): CorrelationResult {
  const absCorr = Math.abs(correlation);
  let strength: CorrelationResult["strength"];
  let direction: CorrelationResult["direction"];
  let insight: string;

  if (absCorr >= 0.7) strength = "STRONG";
  else if (absCorr >= 0.4) strength = "MODERATE";
  else if (absCorr >= 0.2) strength = "WEAK";
  else strength = "NONE";

  if (correlation > 0.1) direction = "POSITIVE";
  else if (correlation < -0.1) direction = "NEGATIVE";
  else direction = "NONE";

  // Generate insight
  if (strength === "NONE") {
    insight = `No clear relationship between ${metric1.toLowerCase()} and ${metric2.toLowerCase()}.`;
  } else if (direction === "POSITIVE") {
    insight = `Higher ${metric1.toLowerCase()} tends to coincide with higher ${metric2.toLowerCase()}.`;
  } else {
    insight = `Higher ${metric1.toLowerCase()} tends to coincide with lower ${metric2.toLowerCase()}.`;
  }

  return {
    metric1,
    metric2,
    correlation: Math.round(correlation * 100) / 100,
    strength,
    direction,
    insight,
  };
}

// ============================================
// 14-DAY COMPARISON
// ============================================

export interface PeriodComparison {
  metric: string;
  current: number;
  previous: number;
  change: number;
  changePercent: number;
  trend: "UP" | "DOWN" | "STABLE";
  emoji: string;
}

export function compareLast14Days(entries: JournalEntry[]): PeriodComparison[] {
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

  const validEntries = entries.filter((e) => e.visibilityLevel !== "HIDDEN");

  const currentWeek = validEntries.filter(
    (e) => new Date(e.date) >= sevenDaysAgo && new Date(e.date) <= now
  );
  const previousWeek = validEntries.filter(
    (e) => new Date(e.date) >= fourteenDaysAgo && new Date(e.date) < sevenDaysAgo
  );

  const comparisons: PeriodComparison[] = [];

  // Mood
  const currentMood = average(currentWeek.map((e) => e.mood).filter(Boolean) as number[]);
  const prevMood = average(previousWeek.map((e) => e.mood).filter(Boolean) as number[]);
  if (currentMood > 0 || prevMood > 0) {
    comparisons.push(formatComparison("Mood", currentMood, prevMood, "😊", "😔"));
  }

  // Energy
  const currentEnergy = average(currentWeek.map((e) => e.energy).filter(Boolean) as number[]);
  const prevEnergy = average(previousWeek.map((e) => e.energy).filter(Boolean) as number[]);
  if (currentEnergy > 0 || prevEnergy > 0) {
    comparisons.push(formatComparison("Energy", currentEnergy, prevEnergy, "⚡", "🔋"));
  }

  // Motivation
  const currentMotivation = average(currentWeek.map((e) => e.motivation).filter(Boolean) as number[]);
  const prevMotivation = average(previousWeek.map((e) => e.motivation).filter(Boolean) as number[]);
  if (currentMotivation > 0 || prevMotivation > 0) {
    comparisons.push(formatComparison("Motivation", currentMotivation, prevMotivation, "🔥", "💤"));
  }

  // Sleep Quality
  const currentSleep = average(currentWeek.map((e) => e.sleepQual).filter(Boolean) as number[]);
  const prevSleep = average(previousWeek.map((e) => e.sleepQual).filter(Boolean) as number[]);
  if (currentSleep > 0 || prevSleep > 0) {
    comparisons.push(formatComparison("Sleep Quality", currentSleep, prevSleep, "😴", "😫"));
  }

  // Stress (lower is better)
  const currentStress = average(currentWeek.map((e) => e.stress).filter(Boolean) as number[]);
  const prevStress = average(previousWeek.map((e) => e.stress).filter(Boolean) as number[]);
  if (currentStress > 0 || prevStress > 0) {
    comparisons.push(formatComparison("Stress", currentStress, prevStress, "😰", "😌", true));
  }

  return comparisons;
}

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10) / 10;
}

function formatComparison(
  metric: string,
  current: number,
  previous: number,
  upEmoji: string,
  downEmoji: string,
  lowerIsBetter = false
): PeriodComparison {
  const change = Math.round((current - previous) * 10) / 10;
  const changePercent = previous > 0 ? Math.round((change / previous) * 100) : 0;

  let trend: PeriodComparison["trend"];
  if (Math.abs(change) < 0.3) trend = "STABLE";
  else if (change > 0) trend = "UP";
  else trend = "DOWN";

  // For stress, down is good
  const isPositive = lowerIsBetter ? trend === "DOWN" : trend === "UP";
  const emoji = isPositive ? upEmoji : trend === "STABLE" ? "➡️" : downEmoji;

  return {
    metric,
    current,
    previous,
    change,
    changePercent,
    trend,
    emoji,
  };
}

// ============================================
// AI ACCESS HELPERS
// ============================================

export function getVisibilityLabel(level: VisibilityLevel): {
  label: string;
  description: string;
  color: string;
} {
  switch (level) {
    case "FULL_AI_ACCESS":
      return {
        label: "Full",
        description: "AI can read scores + notes",
        color: "text-green-500",
      };
    case "METRICS_ONLY":
      return {
        label: "Metrics",
        description: "AI can only see numerical scores",
        color: "text-yellow-500",
      };
    case "HIDDEN":
      return {
        label: "Hidden",
        description: "AI cannot access this entry",
        color: "text-red-500",
      };
  }

  return {
    label: "Hidden",
    description: "AI cannot access this entry",
    color: "text-red-500",
  };
}
