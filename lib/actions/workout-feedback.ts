"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { track } from "@/lib/analytics/events";
import { createRequestId, logError, logInfo } from "@/lib/logger";
import { updateCoachInsightsFromFeedback } from "@/lib/services/ai-memory.service";

// Types
export type PerceivedDifficulty = "EASY" | "OK" | "HARD" | "BRUTAL";
export type FeltVsPlanned = "EASIER" | "SAME" | "HARDER";
export type Discomfort = "NONE" | "MILD" | "MODERATE" | "SEVERE";
export type PostWorkoutFeeling = "GREAT" | "GOOD" | "OK" | "TIRED" | "BAD";
export type LegsFeel = "FRESH" | "NORMAL" | "HEAVY" | "SORE";

export interface SaveFeedbackInput {
  workoutId: string;
  perceivedDifficulty: PerceivedDifficulty;
  vsPlanned: FeltVsPlanned;
  enjoyment: number; // 1-5
  discomfort: Discomfort;
  mentalState: number; // 1-5
  actualAvgHR?: number;
  actualMaxHR?: number;
  actualPaceText?: string;
  actualRpe?: number;
  actualFeel?: number;
  sessionEquipment?: string;
  sessionTerrain?: string;
  sessionAvailability?: string;
  comment?: string;
  visibleToAI?: boolean;
  visibleToFuturePlanning?: boolean;
  // Premium: metrics for AI learning
  durationMin?: number;
  distanceMeters?: number;
  avgPower?: number;
  avgPaceSecPerKm?: number;
  avgSpeedKph?: number;
  swimAvgPaceSecPer100m?: number;
  feeling?: PostWorkoutFeeling;
  legs?: LegsFeel;
  intervalsJson?: Record<string, unknown> | Array<Record<string, unknown>>;
}

export interface FeedbackResult {
  success: boolean;
  error?: string;
  feedbackId?: string;
  semanticTags?: ExtractedSignal[];
}

export interface FeedbackData {
  id: string;
  workoutId: string;
  perceivedDifficulty: string;
  vsPlanned: string;
  enjoyment: number;
  discomfort: string;
  mentalState: number;
  actualAvgHR: number | null;
  actualMaxHR: number | null;
  actualPaceText: string | null;
  actualRpe: number | null;
  actualFeel: number | null;
  sessionEquipment: string | null;
  sessionTerrain: string | null;
  sessionAvailability: string | null;
  comment: string | null;
  visibleToAI: boolean;
  createdAt: Date;
  updatedAt: Date;
  isEditable: boolean;
  // Premium
  durationMin: number | null;
  distanceMeters: number | null;
  avgPower: number | null;
  avgPaceSecPerKm: number | null;
  avgSpeedKph: number | null;
  swimAvgPaceSecPer100m: number | null;
  feeling: PostWorkoutFeeling | null;
  legs: LegsFeel | null;
  intervalsJson: unknown;
}

export interface FeedbackPatterns {
  totalFeedback: number;
  avgEnjoyment: number;
  avgMentalState: number;
  tooHardCount: number;
  harderThanPlannedCount: number;
  easierThanPlannedCount: number;
  discomfortCount: number;
  lowEnjoymentStreak: number;
  insights: string[];
  recommendations: string[];
}

function buildFeedbackData(input: SaveFeedbackInput) {
  return {
    perceivedDifficulty: input.perceivedDifficulty,
    vsPlanned: input.vsPlanned,
    enjoyment: input.enjoyment,
    discomfort: input.discomfort,
    mentalState: input.mentalState,
    actualAvgHR: typeof input.actualAvgHR === "number" ? input.actualAvgHR : null,
    actualMaxHR: typeof input.actualMaxHR === "number" ? input.actualMaxHR : null,
    actualPaceText: input.actualPaceText ? String(input.actualPaceText) : null,
    actualRpe: typeof input.actualRpe === "number" ? input.actualRpe : null,
    actualFeel: typeof input.actualFeel === "number" ? input.actualFeel : null,
    sessionEquipment: input.sessionEquipment ? String(input.sessionEquipment) : null,
    sessionTerrain: input.sessionTerrain ? String(input.sessionTerrain) : null,
    sessionAvailability: input.sessionAvailability ? String(input.sessionAvailability) : null,
    comment: input.comment ? String(input.comment) : null,
    visibleToAI: input.visibleToAI ?? true,
    visibleToFuturePlanning: input.visibleToFuturePlanning ?? true,
    durationMin: input.durationMin ?? null,
    distanceMeters: input.distanceMeters ?? null,
    avgPower: input.avgPower ?? null,
    avgPaceSecPerKm: input.avgPaceSecPerKm ?? null,
    avgSpeedKph: input.avgSpeedKph ?? null,
    swimAvgPaceSecPer100m: input.swimAvgPaceSecPer100m ?? null,
    feeling: input.feeling ?? null,
    legs: input.legs ?? null,
    intervalsJson:
      input.intervalsJson != null ? (input.intervalsJson as Prisma.InputJsonValue) : Prisma.JsonNull,
  };
}

/**
 * Check if feedback exists for a workout
 */
export async function getFeedbackForWorkout(workoutId: string): Promise<FeedbackData | null> {
  const requestId = crypto.randomUUID();

  try {
    const session = await auth();
    if (!session?.user?.id) return null;

    const feedback = await db.postWorkoutFeedback.findUnique({
      where: { workoutId },
    });

    if (!feedback || feedback.userId !== session.user.id) return null;

    // Check if editable (same day only)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const feedbackDate = new Date(feedback.createdAt);
    feedbackDate.setHours(0, 0, 0, 0);
    const isEditable = feedbackDate.getTime() === today.getTime();

    const withActuals = feedback as unknown as {
      actualAvgHR?: number | null;
      actualMaxHR?: number | null;
      actualPaceText?: string | null;
      actualRpe?: number | null;
      actualFeel?: number | null;
      sessionEquipment?: string | null;
      sessionTerrain?: string | null;
      sessionAvailability?: string | null;
    };

    const f = feedback as typeof feedback & {
      durationMin?: number | null;
      distanceMeters?: number | null;
      avgPower?: number | null;
      avgPaceSecPerKm?: number | null;
      avgSpeedKph?: number | null;
      swimAvgPaceSecPer100m?: number | null;
      feeling?: PostWorkoutFeeling | null;
      legs?: LegsFeel | null;
      intervalsJson?: unknown;
    };
    return {
      id: feedback.id,
      workoutId: feedback.workoutId,
      perceivedDifficulty: feedback.perceivedDifficulty,
      vsPlanned: feedback.vsPlanned,
      enjoyment: feedback.enjoyment,
      discomfort: feedback.discomfort,
      mentalState: feedback.mentalState,
      actualAvgHR: typeof withActuals.actualAvgHR === "number" ? withActuals.actualAvgHR : null,
      actualMaxHR: typeof withActuals.actualMaxHR === "number" ? withActuals.actualMaxHR : null,
      actualPaceText: typeof withActuals.actualPaceText === "string" ? withActuals.actualPaceText : null,
      actualRpe: typeof withActuals.actualRpe === "number" ? withActuals.actualRpe : null,
      actualFeel: typeof withActuals.actualFeel === "number" ? withActuals.actualFeel : null,
      sessionEquipment: typeof withActuals.sessionEquipment === "string" ? withActuals.sessionEquipment : null,
      sessionTerrain: typeof withActuals.sessionTerrain === "string" ? withActuals.sessionTerrain : null,
      sessionAvailability: typeof withActuals.sessionAvailability === "string" ? withActuals.sessionAvailability : null,
      comment: feedback.comment,
      visibleToAI: feedback.visibleToAI,
      createdAt: feedback.createdAt,
      updatedAt: feedback.updatedAt,
      isEditable,
      durationMin: typeof f.durationMin === "number" ? f.durationMin : null,
      distanceMeters: typeof f.distanceMeters === "number" ? f.distanceMeters : null,
      avgPower: typeof f.avgPower === "number" ? f.avgPower : null,
      avgPaceSecPerKm: typeof f.avgPaceSecPerKm === "number" ? f.avgPaceSecPerKm : null,
      avgSpeedKph: typeof f.avgSpeedKph === "number" ? f.avgSpeedKph : null,
      swimAvgPaceSecPer100m: typeof f.swimAvgPaceSecPer100m === "number" ? f.swimAvgPaceSecPer100m : null,
      feeling: f.feeling ?? null,
      legs: f.legs ?? null,
      intervalsJson: f.intervalsJson ?? null,
    };
  } catch (error) {
    logError("feedback.fetch_failed", {
      requestId,
      action: "getFeedbackForWorkout",
      workoutId,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

/**
 * Save or update workout feedback
 */
export async function saveFeedback(input: SaveFeedbackInput): Promise<FeedbackResult> {
  const requestId = createRequestId();
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Not authenticated" };
    }

    logInfo("feedback.submit.started", {
      requestId,
      userId: session.user.id,
      action: "saveFeedback",
      workoutId: input.workoutId,
      visibleToAI: input.visibleToAI ?? true,
      visibleToFuturePlanning: input.visibleToFuturePlanning ?? true,
    });
    const semanticTags = await extractSemanticTags(input.comment);

    // Verify workout belongs to user
    const workout = await db.workout.findUnique({
      where: { id: input.workoutId },
    });

    if (!workout || workout.userId !== session.user.id) {
      return { success: false, error: "Workout not found" };
    }

    // Check if feedback already exists
    const existingFeedback = await db.postWorkoutFeedback.findUnique({
      where: { workoutId: input.workoutId },
    });

    if (existingFeedback) {
      // Check if editable (same day only)
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const feedbackDate = new Date(existingFeedback.createdAt);
      feedbackDate.setHours(0, 0, 0, 0);

      if (feedbackDate.getTime() !== today.getTime()) {
        return { success: false, error: "Feedback can only be edited on the same day" };
      }

      // Update existing feedback
      const updateData = buildFeedbackData(input);
      const updated = await db.postWorkoutFeedback.update({
        where: { id: existingFeedback.id },
        data: updateData,
      });

      revalidatePath(`/workouts/${input.workoutId}`);
      revalidatePath("/dashboard");

      await track({
        name: "feedback_submitted",
        userId: session.user.id,
        requestId,
        route: "/calendar",
        source: "workout_feedback",
        properties: {
          workoutId: input.workoutId,
          isEdit: true,
          visibleToAI: input.visibleToAI ?? true,
          visibleToFuturePlanning: input.visibleToFuturePlanning ?? true,
        },
      });

      logInfo("feedback.submit.succeeded", {
        requestId,
        userId: session.user.id,
        action: "saveFeedback",
        workoutId: input.workoutId,
        feedbackId: updated.id,
        isEdit: true,
      });

      updateCoachInsightsFromFeedback(session.user.id).catch(() => {});
      return { success: true, feedbackId: updated.id, semanticTags };
    }

    // Create new feedback
    const createData = buildFeedbackData(input);
    const feedback = await db.postWorkoutFeedback.create({
      data: {
        userId: session.user.id,
        workoutId: input.workoutId,
        ...createData,
      },
    });

    revalidatePath(`/workouts/${input.workoutId}`);
    revalidatePath("/dashboard");

    await track({
      name: "feedback_submitted",
      userId: session.user.id,
      requestId,
      route: "/calendar",
      source: "workout_feedback",
      properties: {
        workoutId: input.workoutId,
        isEdit: false,
        visibleToAI: input.visibleToAI ?? true,
        visibleToFuturePlanning: input.visibleToFuturePlanning ?? true,
      },
    });

    logInfo("feedback.submit.succeeded", {
      requestId,
      userId: session.user.id,
      action: "saveFeedback",
      workoutId: input.workoutId,
      feedbackId: feedback.id,
      isEdit: false,
    });

    updateCoachInsightsFromFeedback(session.user.id).catch(() => {});
    return { success: true, feedbackId: feedback.id, semanticTags };
  } catch (error) {
    logError("feedback.submit.failed", {
      requestId,
      action: "saveFeedback",
      error: error instanceof Error ? error.message : String(error),
    });
    return { success: false, error: "Failed to save feedback" };
  }
}

/**
 * Get feedback patterns for AI analysis (last N days)
 */
export async function getFeedbackPatterns(days: number = 14): Promise<FeedbackPatterns> {
  const defaultPatterns: FeedbackPatterns = {
    totalFeedback: 0,
    avgEnjoyment: 0,
    avgMentalState: 0,
    tooHardCount: 0,
    harderThanPlannedCount: 0,
    easierThanPlannedCount: 0,
    discomfortCount: 0,
    lowEnjoymentStreak: 0,
    insights: [],
    recommendations: [],
  };

  try {
    const session = await auth();
    if (!session?.user?.id) return defaultPatterns;

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const feedbacks = await db.postWorkoutFeedback.findMany({
      where: {
        userId: session.user.id,
        visibleToAI: true,
        createdAt: { gte: startDate },
      },
      orderBy: { createdAt: "desc" },
    });

    if (feedbacks.length === 0) return defaultPatterns;

    // Calculate metrics
    const totalFeedback = feedbacks.length;
    const avgEnjoyment = feedbacks.reduce((sum: number, f) => sum + f.enjoyment, 0) / totalFeedback;
    const avgMentalState = feedbacks.reduce((sum: number, f) => sum + f.mentalState, 0) / totalFeedback;
    const tooHardCount = feedbacks.filter((f) => f.perceivedDifficulty === "HARD" || f.perceivedDifficulty === "BRUTAL").length;
    const harderThanPlannedCount = feedbacks.filter((f) => f.vsPlanned === "HARDER").length;
    const easierThanPlannedCount = feedbacks.filter((f) => f.vsPlanned === "EASIER").length;
    const discomfortCount = feedbacks.filter((f) => f.discomfort !== "NONE").length;

    // Calculate low enjoyment streak
    let lowEnjoymentStreak = 0;
    for (const f of feedbacks) {
      if (f.enjoyment <= 2) {
        lowEnjoymentStreak++;
      } else {
        break;
      }
    }

    // Generate insights
    const insights: string[] = [];
    const recommendations: string[] = [];

    if (tooHardCount >= totalFeedback * 0.4) {
      insights.push(`${Math.round(tooHardCount / totalFeedback * 100)}% of recent sessions were perceived as too hard.`);
      recommendations.push("Consider reducing intensity or volume in upcoming sessions.");
    }

    if (harderThanPlannedCount >= totalFeedback * 0.5) {
      insights.push(`${Math.round(harderThanPlannedCount / totalFeedback * 100)}% of sessions felt harder than planned.`);
      recommendations.push("Training load may be accumulating - consider a recovery period.");
    }

    if (avgEnjoyment < 2.5) {
      insights.push(`Average enjoyment is low (${avgEnjoyment.toFixed(1)}/5).`);
      recommendations.push("Mix in more enjoyable session types to maintain motivation.");
    }

    if (lowEnjoymentStreak >= 3) {
      insights.push(`${lowEnjoymentStreak} consecutive sessions with low enjoyment.`);
      recommendations.push("This pattern suggests potential burnout - prioritize recovery and variety.");
    }

    if (discomfortCount >= totalFeedback * 0.3) {
      insights.push(`Physical discomfort reported in ${Math.round(discomfortCount / totalFeedback * 100)}% of sessions.`);
      recommendations.push("Monitor for injury risk - consider reducing load or consulting a professional.");
    }

    if (avgMentalState < 2.5) {
      insights.push(`Average post-workout mental state is low (${avgMentalState.toFixed(1)}/5).`);
      recommendations.push("Training may be mentally draining - consider shorter or lighter sessions.");
    }

    return {
      totalFeedback,
      avgEnjoyment: Math.round(avgEnjoyment * 10) / 10,
      avgMentalState: Math.round(avgMentalState * 10) / 10,
      tooHardCount,
      harderThanPlannedCount,
      easierThanPlannedCount,
      discomfortCount,
      lowEnjoymentStreak,
      insights,
      recommendations,
    };
  } catch (error) {
    console.error("Error getting feedback patterns:", error);
    return defaultPatterns;
  }
}

/**
 * Get feedback context for AI Coach (formatted string for prompts)
 */
export async function getFeedbackContextForAI(): Promise<string> {
  try {
    const patterns = await getFeedbackPatterns(14);

    if (patterns.totalFeedback === 0) {
      return "No recent workout feedback available.";
    }

    let context = `## Recent Workout Feedback (last 14 days)\n`;
    context += `- Total feedback entries: ${patterns.totalFeedback}\n`;
    context += `- Average enjoyment: ${patterns.avgEnjoyment}/5\n`;
    context += `- Average post-workout mental state: ${patterns.avgMentalState}/5\n`;
    context += `- Sessions perceived as too hard: ${patterns.tooHardCount}\n`;
    context += `- Sessions harder than planned: ${patterns.harderThanPlannedCount}\n`;
    context += `- Sessions easier than planned: ${patterns.easierThanPlannedCount}\n`;
    context += `- Sessions with physical discomfort: ${patterns.discomfortCount}\n`;

    if (patterns.insights.length > 0) {
      context += `\n### Key Insights\n`;
      patterns.insights.forEach(insight => {
        context += `- ${insight}\n`;
      });
    }

    if (patterns.recommendations.length > 0) {
      context += `\n### Recommendations Based on Feedback\n`;
      patterns.recommendations.forEach(rec => {
        context += `- ${rec}\n`;
      });
    }

    return context;
  } catch (error) {
    console.error("Error getting feedback context:", error);
    return "Unable to retrieve feedback data.";
  }
}

/**
 * Get recent feedback history for display
 */
// ============================================
// SEMANTIC TAG EXTRACTION (Spec v1.0 §2.4)
// ============================================

export type SemanticTag = 
  | "heavy_legs"
  | "mental_fatigue"
  | "low_energy"
  | "high_energy"
  | "pain_discomfort"
  | "great_session"
  | "struggled_to_start"
  | "felt_strong"
  | "breathing_issues"
  | "motivation_low"
  | "motivation_high"
  | "weather_impact"
  | "equipment_issue"
  | "technique_focus"
  | "pacing_issue";

export interface ExtractedSignal {
  tag: SemanticTag;
  confidence: number; // 0-100
  sourcePhrase: string;
}

/**
 * Semantic tag patterns for comment analysis
 * Maps phrases to semantic tags with confidence weights
 */
const SEMANTIC_PATTERNS: Array<{
  patterns: RegExp[];
  tag: SemanticTag;
  baseConfidence: number;
}> = [
  {
    patterns: [
      /heavy legs?/i,
      /legs? (felt|were|are) heavy/i,
      /legs? like (concrete|lead|bricks)/i,
      /couldn'?t feel my legs/i,
      /dead legs/i,
    ],
    tag: "heavy_legs",
    baseConfidence: 85,
  },
  {
    patterns: [
      /mental(ly)? (tired|exhausted|drained|fatigued)/i,
      /brain fog/i,
      /couldn'?t focus/i,
      /mind (was|felt) (tired|foggy|slow)/i,
      /mentally (not|wasn'?t) there/i,
    ],
    tag: "mental_fatigue",
    baseConfidence: 85,
  },
  {
    patterns: [
      /no energy/i,
      /low energy/i,
      /felt (flat|empty|drained)/i,
      /running on (empty|fumes)/i,
      /tank was empty/i,
    ],
    tag: "low_energy",
    baseConfidence: 80,
  },
  {
    patterns: [
      /felt (great|amazing|strong|powerful)/i,
      /tons? of energy/i,
      /full of energy/i,
      /energized/i,
      /on fire/i,
    ],
    tag: "high_energy",
    baseConfidence: 85,
  },
  {
    patterns: [
      /pain in/i,
      /hurt(s|ing)?/i,
      /sharp pain/i,
      /discomfort in/i,
      /ache(s|d|ing)?/i,
      /sore (knee|back|hip|shoulder|ankle)/i,
    ],
    tag: "pain_discomfort",
    baseConfidence: 90,
  },
  {
    patterns: [
      /great (session|workout|run|ride)/i,
      /best (session|workout|run|ride)/i,
      /nailed it/i,
      /crushed it/i,
      /perfect (session|workout)/i,
    ],
    tag: "great_session",
    baseConfidence: 85,
  },
  {
    patterns: [
      /didn'?t want to (start|begin|go)/i,
      /hard to (start|get going|begin)/i,
      /struggled to (start|begin|get out)/i,
      /almost (skipped|didn'?t go)/i,
      /had to force myself/i,
    ],
    tag: "struggled_to_start",
    baseConfidence: 80,
  },
  {
    patterns: [
      /felt (strong|powerful)/i,
      /feeling strong/i,
      /legs? felt (good|great|strong)/i,
      /power(ful)? (legs?|session)/i,
    ],
    tag: "felt_strong",
    baseConfidence: 80,
  },
  {
    patterns: [
      /couldn'?t (breathe|catch my breath)/i,
      /breathing (was|felt) (hard|difficult|labored)/i,
      /out of breath/i,
      /gasping/i,
      /lungs? (burning|on fire)/i,
    ],
    tag: "breathing_issues",
    baseConfidence: 85,
  },
  {
    patterns: [
      /no motivation/i,
      /zero motivation/i,
      /didn'?t feel like/i,
      /wasn'?t (feeling it|into it)/i,
      /going through the motions/i,
    ],
    tag: "motivation_low",
    baseConfidence: 80,
  },
  {
    patterns: [
      /super motivated/i,
      /really (wanted|excited) to/i,
      /pumped (up)?/i,
      /couldn'?t wait to/i,
      /fired up/i,
    ],
    tag: "motivation_high",
    baseConfidence: 80,
  },
  {
    patterns: [
      /too (hot|cold|windy|humid)/i,
      /weather (was|made it)/i,
      /rain(ing)?/i,
      /heat (was|got to me)/i,
      /freezing/i,
    ],
    tag: "weather_impact",
    baseConfidence: 75,
  },
  {
    patterns: [
      /bike (broke|issue|problem)/i,
      /flat (tire|tyre)/i,
      /equipment (issue|problem|failure)/i,
      /watch (died|stopped|issue)/i,
      /shoe(s)? (issue|problem|hurt)/i,
    ],
    tag: "equipment_issue",
    baseConfidence: 85,
  },
  {
    patterns: [
      /work(ed|ing) on (form|technique)/i,
      /focus(ed|ing) on (form|technique|cadence)/i,
      /drill(s|ed)?/i,
      /technique (work|session|focus)/i,
    ],
    tag: "technique_focus",
    baseConfidence: 75,
  },
  {
    patterns: [
      /went out too (fast|hard)/i,
      /pacing (was|issue|problem)/i,
      /started too (fast|slow)/i,
      /blew up/i,
      /died (at the end|in the last)/i,
    ],
    tag: "pacing_issue",
    baseConfidence: 80,
  },
];

/**
 * Extract semantic tags from a feedback comment
 * Returns raw signals without storing to memory (per spec: "do NOT generate memory yet")
 */
export async function extractSemanticTags(comment: string | null | undefined): Promise<ExtractedSignal[]> {
  if (!comment || comment.trim().length < 3) {
    return [];
  }

  const signals: ExtractedSignal[] = [];
  const normalizedComment = comment.toLowerCase();

  for (const { patterns, tag, baseConfidence } of SEMANTIC_PATTERNS) {
    for (const pattern of patterns) {
      const match = normalizedComment.match(pattern);
      if (match) {
        // Avoid duplicate tags
        if (!signals.some(s => s.tag === tag)) {
          signals.push({
            tag,
            confidence: baseConfidence,
            sourcePhrase: match[0],
          });
        }
        break; // Found a match for this tag, move to next
      }
    }
  }

  return signals;
}

/**
 * Get semantic signals from recent feedback (for AI context building)
 * Only returns signals from AI-visible feedback
 */
export async function getRecentSemanticSignals(days: number = 14): Promise<{
  signals: Array<{ tag: SemanticTag; count: number; recentPhrases: string[] }>;
  dominantPatterns: SemanticTag[];
}> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { signals: [], dominantPatterns: [] };
    }

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const feedbacks = await db.postWorkoutFeedback.findMany({
      where: {
        userId: session.user.id,
        visibleToAI: true,
        createdAt: { gte: startDate },
        comment: { not: null },
      },
      orderBy: { createdAt: "desc" },
      select: { comment: true },
    });

    // Extract signals from all comments
    const tagCounts: Map<SemanticTag, { count: number; phrases: string[] }> = new Map();

    for (const f of feedbacks) {
      const extracted = await extractSemanticTags(f.comment);
      for (const signal of extracted) {
        const existing = tagCounts.get(signal.tag) || { count: 0, phrases: [] };
        existing.count++;
        if (existing.phrases.length < 3) {
          existing.phrases.push(signal.sourcePhrase);
        }
        tagCounts.set(signal.tag, existing);
      }
    }

    // Convert to array and sort by count
    const signals = Array.from(tagCounts.entries())
      .map(([tag, data]) => ({
        tag,
        count: data.count,
        recentPhrases: data.phrases,
      }))
      .sort((a, b) => b.count - a.count);

    // Dominant patterns = tags appearing 3+ times
    const dominantPatterns = signals
      .filter(s => s.count >= 3)
      .map(s => s.tag);

    return { signals, dominantPatterns };
  } catch (error) {
    console.error("Error getting semantic signals:", error);
    return { signals: [], dominantPatterns: [] };
  }
}

/**
 * Get raw feedback signals for a specific workout (no AI processing)
 * Used for data layer separation
 */
export interface RawFeedbackSignal {
  workoutId: string;
  workoutDate: Date;
  perceivedDifficulty: PerceivedDifficulty;
  vsPlanned: FeltVsPlanned;
  enjoyment: number;
  discomfort: Discomfort;
  mentalState: number;
  semanticTags: ExtractedSignal[];
  visibleToAI: boolean;
  visibleToFuturePlanning: boolean;
}

export async function getRawFeedbackSignals(days: number = 14): Promise<RawFeedbackSignal[]> {
  try {
    const session = await auth();
    if (!session?.user?.id) return [];

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const feedbacks = await db.postWorkoutFeedback.findMany({
      where: {
        userId: session.user.id,
        visibleToFuturePlanning: true,
        createdAt: { gte: startDate },
      },
      orderBy: { createdAt: "desc" },
    });

    const workoutIds = feedbacks.map(f => f.workoutId);
    const workouts = await db.workout.findMany({
      where: { id: { in: workoutIds } },
      select: { id: true, date: true },
    });
    const workoutMap = new Map(workouts.map(w => [w.id, w]));

    const results: RawFeedbackSignal[] = [];
    for (const f of feedbacks) {
      const workout = workoutMap.get(f.workoutId);
      results.push({
        workoutId: f.workoutId,
        workoutDate: workout?.date || f.createdAt,
        perceivedDifficulty: f.perceivedDifficulty as PerceivedDifficulty,
        vsPlanned: f.vsPlanned as FeltVsPlanned,
        enjoyment: f.enjoyment,
        discomfort: f.discomfort as Discomfort,
        mentalState: f.mentalState,
        semanticTags: await extractSemanticTags(f.comment),
        visibleToAI: f.visibleToAI,
        visibleToFuturePlanning: f.visibleToFuturePlanning,
      });
    }

    return results;
  } catch (error) {
    console.error("Error getting raw feedback signals:", error);
    return [];
  }
}

export async function getRecentFeedback(limit: number = 10): Promise<Array<FeedbackData & { workoutTitle: string; workoutDate: Date }>> {
  try {
    const session = await auth();
    if (!session?.user?.id) return [];

    const feedbacks = await db.postWorkoutFeedback.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
      take: limit,
    });

    // Get workout details
    const workoutIds = feedbacks.map((f) => f.workoutId);
    const workouts = await db.workout.findMany({
      where: { id: { in: workoutIds } },
      select: { id: true, title: true, date: true },
    });

    const workoutMap = new Map(workouts.map(w => [w.id, w]));

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return feedbacks.map((f) => {
      const withActuals = f as unknown as {
        actualAvgHR?: number | null;
        actualMaxHR?: number | null;
        actualPaceText?: string | null;
        actualRpe?: number | null;
        actualFeel?: number | null;
        sessionEquipment?: string | null;
        sessionTerrain?: string | null;
        sessionAvailability?: string | null;
        durationMin?: number | null;
        distanceMeters?: number | null;
        avgPower?: number | null;
        avgPaceSecPerKm?: number | null;
        avgSpeedKph?: number | null;
        swimAvgPaceSecPer100m?: number | null;
        feeling?: PostWorkoutFeeling | null;
        legs?: LegsFeel | null;
        intervalsJson?: unknown;
      };

      const workout = workoutMap.get(f.workoutId);
      const feedbackDate = new Date(f.createdAt);
      feedbackDate.setHours(0, 0, 0, 0);

      return {
        id: f.id,
        workoutId: f.workoutId,
        perceivedDifficulty: f.perceivedDifficulty,
        vsPlanned: f.vsPlanned,
        enjoyment: f.enjoyment,
        discomfort: f.discomfort,
        mentalState: f.mentalState,
        actualAvgHR: typeof withActuals.actualAvgHR === "number" ? withActuals.actualAvgHR : null,
        actualMaxHR: typeof withActuals.actualMaxHR === "number" ? withActuals.actualMaxHR : null,
        actualPaceText: typeof withActuals.actualPaceText === "string" ? withActuals.actualPaceText : null,
        actualRpe: typeof withActuals.actualRpe === "number" ? withActuals.actualRpe : null,
        actualFeel: typeof withActuals.actualFeel === "number" ? withActuals.actualFeel : null,
        sessionEquipment: typeof withActuals.sessionEquipment === "string" ? withActuals.sessionEquipment : null,
        sessionTerrain: typeof withActuals.sessionTerrain === "string" ? withActuals.sessionTerrain : null,
        sessionAvailability: typeof withActuals.sessionAvailability === "string" ? withActuals.sessionAvailability : null,
        comment: f.comment,
        visibleToAI: f.visibleToAI,
        createdAt: f.createdAt,
        updatedAt: f.updatedAt,
        isEditable: feedbackDate.getTime() === today.getTime(),
        durationMin: typeof withActuals.durationMin === "number" ? withActuals.durationMin : null,
        distanceMeters: typeof withActuals.distanceMeters === "number" ? withActuals.distanceMeters : null,
        avgPower: typeof withActuals.avgPower === "number" ? withActuals.avgPower : null,
        avgPaceSecPerKm: typeof withActuals.avgPaceSecPerKm === "number" ? withActuals.avgPaceSecPerKm : null,
        avgSpeedKph: typeof withActuals.avgSpeedKph === "number" ? withActuals.avgSpeedKph : null,
        swimAvgPaceSecPer100m: typeof withActuals.swimAvgPaceSecPer100m === "number" ? withActuals.swimAvgPaceSecPer100m : null,
        feeling: withActuals.feeling ?? null,
        legs: withActuals.legs ?? null,
        intervalsJson: withActuals.intervalsJson ?? null,
        workoutTitle: workout?.title || "Unknown Workout",
        workoutDate: workout?.date || f.createdAt,
      };
    });
  } catch (error) {
    console.error("Error getting recent feedback:", error);
    return [];
  }
}
