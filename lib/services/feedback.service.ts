/**
 * Feedback Aggregation Service
 * Aggregates post-workout feedback weekly and generates AI learning insights.
 * Deterministic, offline, explainable.
 */

export type PerceivedDifficulty = "EASY" | "OK" | "HARD" | "BRUTAL";
export type VsPlanned = "EASIER" | "SAME" | "HARDER";
export type ToneAdjustment = "ENCOURAGING" | "NEUTRAL" | "CAUTIOUS";

export interface FeedbackEntry {
  perceivedDifficulty: PerceivedDifficulty;
  vsPlanned: VsPlanned;
  enjoyment: number;
  painOrDiscomfort: string | null;
  comment: string | null;
  visibleToAI: boolean;
  visibleToFuturePlanning: boolean;
}

export interface WeeklyAggregation {
  totalWorkouts: number;
  feedbackCount: number;
  avgEnjoyment: number | null;
  tooHardCount: number;
  harderThanPlannedCount: number;
  easierThanPlannedCount: number;
  painReportedCount: number;
}

export interface AILearningOutput {
  intensityAdjustment: number; // -20 to +20 percentage
  confidenceImpact: number; // -10 to +10
  toneAdjustment: ToneAdjustment;
  insights: string[];
}

/**
 * Aggregate feedback entries for a week
 */
export function aggregateFeedback(entries: FeedbackEntry[]): WeeklyAggregation {
  // Only consider entries visible to AI
  const visibleEntries = entries.filter((e) => e.visibleToAI);

  if (visibleEntries.length === 0) {
    return {
      totalWorkouts: entries.length,
      feedbackCount: 0,
      avgEnjoyment: null,
      tooHardCount: 0,
      harderThanPlannedCount: 0,
      easierThanPlannedCount: 0,
      painReportedCount: 0,
    };
  }

  const enjoymentSum = visibleEntries.reduce((sum, e) => sum + e.enjoyment, 0);
  const tooHardCount = visibleEntries.filter(
    (e) => e.perceivedDifficulty === "HARD" || e.perceivedDifficulty === "BRUTAL"
  ).length;
  const harderThanPlannedCount = visibleEntries.filter(
    (e) => e.vsPlanned === "HARDER"
  ).length;
  const easierThanPlannedCount = visibleEntries.filter(
    (e) => e.vsPlanned === "EASIER"
  ).length;
  const painReportedCount = visibleEntries.filter(
    (e) => e.painOrDiscomfort && e.painOrDiscomfort.trim().length > 0
  ).length;

  return {
    totalWorkouts: entries.length,
    feedbackCount: visibleEntries.length,
    avgEnjoyment: Math.round((enjoymentSum / visibleEntries.length) * 10) / 10,
    tooHardCount,
    harderThanPlannedCount,
    easierThanPlannedCount,
    painReportedCount,
  };
}

/**
 * Generate AI learning outputs from aggregated feedback
 */
export function generateAILearning(
  aggregation: WeeklyAggregation,
  previousAggregation?: WeeklyAggregation | null
): AILearningOutput {
  const insights: string[] = [];
  let intensityAdjustment = 0;
  let confidenceImpact = 0;
  let toneAdjustment: ToneAdjustment = "NEUTRAL";

  if (aggregation.feedbackCount === 0) {
    return {
      intensityAdjustment: 0,
      confidenceImpact: -5,
      toneAdjustment: "NEUTRAL",
      insights: ["No feedback provided this week - AI confidence reduced"],
    };
  }

  const feedbackRate = aggregation.feedbackCount / aggregation.totalWorkouts;
  const tooHardRate = aggregation.tooHardCount / aggregation.feedbackCount;
  const harderRate = aggregation.harderThanPlannedCount / aggregation.feedbackCount;
  const easierRate = aggregation.easierThanPlannedCount / aggregation.feedbackCount;
  const painRate = aggregation.painReportedCount / aggregation.feedbackCount;

  // 1. Intensity adjustment based on difficulty feedback
  if (tooHardRate >= 0.5) {
    // More than half sessions felt too hard
    intensityAdjustment = -15;
    insights.push(`${Math.round(tooHardRate * 100)}% of sessions felt too hard - reducing intensity`);
  } else if (tooHardRate >= 0.3) {
    intensityAdjustment = -10;
    insights.push(`${Math.round(tooHardRate * 100)}% of sessions felt too hard - slight intensity reduction`);
  } else if (easierRate >= 0.5 && aggregation.avgEnjoyment && aggregation.avgEnjoyment >= 4) {
    // Sessions felt easier AND enjoyment is high - can increase
    intensityAdjustment = 5;
    insights.push("Sessions felt easier than planned with high enjoyment - can increase intensity");
  }

  // 2. Mismatch adjustment (planned vs felt)
  if (harderRate >= 0.4) {
    intensityAdjustment -= 5;
    confidenceImpact -= 3;
    insights.push(`${Math.round(harderRate * 100)}% of sessions felt harder than planned - calibration needed`);
  } else if (easierRate >= 0.4) {
    confidenceImpact += 2;
    insights.push(`${Math.round(easierRate * 100)}% of sessions felt easier than planned - good adaptation`);
  }

  // 3. Pain/discomfort response
  if (painRate >= 0.3) {
    intensityAdjustment -= 10;
    toneAdjustment = "CAUTIOUS";
    insights.push(`Pain reported in ${Math.round(painRate * 100)}% of sessions - prioritizing recovery`);
  }

  // 4. Enjoyment impact
  if (aggregation.avgEnjoyment !== null) {
    if (aggregation.avgEnjoyment >= 4) {
      confidenceImpact += 3;
      if (toneAdjustment === "NEUTRAL") toneAdjustment = "ENCOURAGING";
      insights.push(`High enjoyment (${aggregation.avgEnjoyment}/5) - training is sustainable`);
    } else if (aggregation.avgEnjoyment <= 2) {
      confidenceImpact -= 5;
      toneAdjustment = "CAUTIOUS";
      insights.push(`Low enjoyment (${aggregation.avgEnjoyment}/5) - considering variety and recovery`);
    }
  }

  // 5. Feedback engagement
  if (feedbackRate >= 0.8) {
    confidenceImpact += 2;
    insights.push("High feedback engagement - AI has good data quality");
  } else if (feedbackRate < 0.3) {
    confidenceImpact -= 3;
    insights.push("Low feedback engagement - AI confidence reduced");
  }

  // 6. Trend comparison with previous week
  if (previousAggregation && previousAggregation.feedbackCount > 0) {
    const prevTooHardRate = previousAggregation.tooHardCount / previousAggregation.feedbackCount;
    if (tooHardRate < prevTooHardRate - 0.2) {
      insights.push("Difficulty perception improved from last week");
      confidenceImpact += 2;
    } else if (tooHardRate > prevTooHardRate + 0.2) {
      insights.push("Difficulty perception worsened from last week");
      confidenceImpact -= 2;
    }
  }

  // Clamp values
  intensityAdjustment = Math.max(-20, Math.min(20, intensityAdjustment));
  confidenceImpact = Math.max(-10, Math.min(10, confidenceImpact));

  return {
    intensityAdjustment,
    confidenceImpact,
    toneAdjustment,
    insights,
  };
}

/**
 * Get difficulty display info
 */
export function getDifficultyDisplay(difficulty: PerceivedDifficulty): {
  label: string;
  color: string;
  emoji: string;
} {
  switch (difficulty) {
    case "EASY":
      return { label: "Easy", color: "text-green-500", emoji: "😊" };
    case "OK":
      return { label: "OK", color: "text-blue-500", emoji: "👍" };
    case "HARD":
      return { label: "Hard", color: "text-orange-500", emoji: "😤" };
    case "BRUTAL":
      return { label: "Brutal", color: "text-red-500", emoji: "🥵" };
  }
}

/**
 * Get vs planned display info
 */
export function getVsPlannedDisplay(vsPlanned: VsPlanned): {
  label: string;
  color: string;
} {
  switch (vsPlanned) {
    case "EASIER":
      return { label: "Easier than planned", color: "text-green-500" };
    case "SAME":
      return { label: "As planned", color: "text-blue-500" };
    case "HARDER":
      return { label: "Harder than planned", color: "text-orange-500" };
  }
}

/**
 * Format feedback for AI context
 */
export function formatFeedbackForAI(
  entries: FeedbackEntry[],
  limit = 5
): string {
  const visibleEntries = entries
    .filter((e) => e.visibleToAI && e.visibleToFuturePlanning)
    .slice(0, limit);

  if (visibleEntries.length === 0) {
    return "No recent feedback available.";
  }

  return visibleEntries
    .map((e, i) => {
      let summary = `Session ${i + 1}: ${e.perceivedDifficulty.toLowerCase()}, ${e.vsPlanned.toLowerCase()} than planned, enjoyment ${e.enjoyment}/5`;
      if (e.comment) {
        summary += `. Comment: "${e.comment}"`;
      }
      if (e.painOrDiscomfort) {
        summary += `. Pain: ${e.painOrDiscomfort}`;
      }
      return summary;
    })
    .join("\n");
}

/**
 * Generate coaching tone based on feedback
 */
export function getCoachingTone(toneAdjustment: ToneAdjustment): {
  greeting: string;
  style: string;
} {
  switch (toneAdjustment) {
    case "ENCOURAGING":
      return {
        greeting: "Great work this week!",
        style: "Push a bit harder, you're adapting well.",
      };
    case "CAUTIOUS":
      return {
        greeting: "Let's be smart about this week.",
        style: "Focus on quality over quantity. Recovery is training too.",
      };
    case "NEUTRAL":
    default:
      return {
        greeting: "Ready for another week?",
        style: "Stay consistent and listen to your body.",
      };
  }
}
