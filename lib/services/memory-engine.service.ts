/**
 * AI Memory Engine Service (Spec v1.0 §4)
 * 
 * Implements:
 * - Memory layers: SHORT_TERM (7d), MID_TERM (30d), LONG_TERM (permanent)
 * - Weekly summarization
 * - Monthly trait inference
 * - Confidence scoring with decay
 * - Contradiction handling
 * - Source references (IDs only, no raw text)
 */

import { db } from "@/lib/db";
import { extractSemanticTags, type SemanticTag } from "@/lib/actions/workout-feedback";

type AIMemoryRow = {
  id: string;
  userId: string;
  memoryLayer: string;
  memoryType: string;
  title: string;
  summary: string;
  confidence: number;
  dataPoints: number;
  sourceIdsJson: string | null;
  periodStart: Date;
  periodEnd: Date;
  expiresAt: Date | null;
  version: number;
  supersededBy: string | null;
  createdAt: Date;
  updatedAt: Date;
};

type DailyCheckInRow = {
  id: string;
  userId: string;
  date: Date;
  sleepDuration: number;
  sleepQuality: number;
  physicalFatigue: number;
  mentalReadiness: number;
  motivation: number;
  stressLevel: number;
  muscleSoreness: string;
  readinessScore: number | null;
  aiDecision: string | null;
  aiConfidence: number | null;
  userAccepted: boolean | null;
  userOverrideReason: string | null;
  comment?: string | null;
};

type PostWorkoutFeedbackRow = {
  id: string;
  workoutId?: string;
  createdAt: Date;
  visibleToAI: boolean;
  perceivedDifficulty: string;
  vsPlanned?: string;
  enjoyment: number;
  mentalState?: number;
  comment: string | null;
};

type DiaryEntryRow = {
  id: string;
  date: Date;
  visibilityLevel: string;
  mood: number | null;
  energy: number | null;
  sleepQual: number | null;
  sleepHrs?: number | null;
  soreness: number | null;
  stress: number | null;
  motivation: number | null;
};

type AIMemoryAuditCreateInput = {
  userId: string;
  action: string;
  memoryType?: string | null;
  details?: string | null;
};

type PrismaDelegate = {
  aIMemory: {
    findMany: (args: unknown) => Promise<AIMemoryRow[]>;
    findFirst: (args: unknown) => Promise<AIMemoryRow | null>;
    create: (args: unknown) => Promise<AIMemoryRow>;
    update: (args: unknown) => Promise<AIMemoryRow>;
    delete: (args: unknown) => Promise<AIMemoryRow>;
    deleteMany: (args: unknown) => Promise<{ count: number }>;
  };
  aIMemoryAudit: {
    create: (args: { data: AIMemoryAuditCreateInput }) => Promise<unknown>;
  };
  dailyCheckIn: {
    findMany: (args: unknown) => Promise<DailyCheckInRow[]>;
  };
  postWorkoutFeedback: {
    findMany: (args: unknown) => Promise<PostWorkoutFeedbackRow[]>;
  };
  diaryEntry: {
    findMany: (args: unknown) => Promise<DiaryEntryRow[]>;
  };
};

const prisma = db as unknown as PrismaDelegate;

// ============================================
// TYPES
// ============================================

export type MemoryLayer = "SHORT_TERM" | "MID_TERM" | "LONG_TERM";

export type MemoryType =
  | "PSYCHOLOGICAL"
  | "FATIGUE_RESPONSE"
  | "PREFERENCE"
  | "COMMUNICATION"
  | "OVERRIDE_PATTERN"
  | "LANGUAGE_PATTERN";

export interface MemorySource {
  checkIns: string[];    // DailyCheckIn IDs
  feedback: string[];    // PostWorkoutFeedback IDs
  diary: string[];       // DiaryEntry IDs
}

export interface MemoryRecord {
  id: string;
  layer: MemoryLayer;
  type: MemoryType;
  title: string;
  summary: string;
  confidence: number;
  dataPoints: number;
  sources: MemorySource;
  periodStart: Date;
  periodEnd: Date;
  expiresAt: Date | null;
  createdAt: Date;
}

export interface MemoryExplanation {
  memoryId: string;
  title: string;
  summary: string;
  confidence: number;
  confidenceExplanation: string;
  sources: Array<{
    type: "checkIn" | "feedback" | "diary";
    id: string;
    date: Date;
    safeSnippet: string; // Anonymized/summarized, never raw text
    snippet: string;
  }>;
  canDelete: boolean;
  canEdit: boolean;
}

function safeSnippetFromDiary(params: {
  visibilityLevel: string;
  mood: number | null;
  energy: number | null;
  sleepQual: number | null;
  soreness: number | null;
  stress: number | null;
  motivation: number | null;
}): string {
  const visibilityLevel =
    params.visibilityLevel === "FULL_AI_ACCESS" ||
    params.visibilityLevel === "METRICS_ONLY" ||
    params.visibilityLevel === "HIDDEN"
      ? (params.visibilityLevel as "FULL_AI_ACCESS" | "METRICS_ONLY" | "HIDDEN")
      : "HIDDEN";

  if (visibilityLevel === "HIDDEN") return "";

  const parts: string[] = [];
  if (typeof params.mood === "number") parts.push(`mood=${params.mood}/5`);
  if (typeof params.energy === "number") parts.push(`energy=${params.energy}/5`);
  if (typeof params.sleepQual === "number") parts.push(`sleepQual=${params.sleepQual}/5`);
  if (typeof params.soreness === "number") parts.push(`soreness=${params.soreness}/5`);
  if (typeof params.stress === "number") parts.push(`stress=${params.stress}/5`);
  if (typeof params.motivation === "number") parts.push(`motivation=${params.motivation}/5`);

  return parts.length > 0 ? `Diary metrics: ${parts.join(", ")}` : "Diary entry (metrics only)";
}

// ============================================
// CONFIDENCE MATH
// ============================================

/**
 * Confidence scoring formula:
 * 
 * Base confidence = min(100, dataPoints * 5)
 * 
 * Modifiers:
 * - Recency bonus: +10 if data from last 7 days
 * - Consistency bonus: +15 if no contradictions
 * - Contradiction penalty: -20 per contradiction
 * - Decay penalty: -5 per week since last update (for SHORT/MID term)
 * 
 * Final = clamp(0, 100, base + modifiers)
 */
export function calculateConfidence(params: {
  dataPoints: number;
  hasRecentData: boolean;
  contradictionCount: number;
  weeksSinceUpdate: number;
  layer: MemoryLayer;
}): { confidence: number; explanation: string } {
  const { dataPoints, hasRecentData, contradictionCount, weeksSinceUpdate, layer } = params;

  let confidence = Math.min(100, dataPoints * 5);
  const parts: string[] = [`Base: ${confidence} (${dataPoints} data points × 5)`];

  // Recency bonus
  if (hasRecentData) {
    confidence += 10;
    parts.push("+10 (recent data)");
  }

  // Consistency bonus (no contradictions)
  if (contradictionCount === 0 && dataPoints >= 5) {
    confidence += 15;
    parts.push("+15 (consistent pattern)");
  }

  // Contradiction penalty
  if (contradictionCount > 0) {
    const penalty = contradictionCount * 20;
    confidence -= penalty;
    parts.push(`-${penalty} (${contradictionCount} contradiction${contradictionCount > 1 ? "s" : ""})`);
  }

  // Decay penalty (only for SHORT_TERM and MID_TERM)
  if (layer !== "LONG_TERM" && weeksSinceUpdate > 0) {
    const decay = weeksSinceUpdate * 5;
    confidence -= decay;
    parts.push(`-${decay} (${weeksSinceUpdate} week${weeksSinceUpdate > 1 ? "s" : ""} decay)`);
  }

  // Clamp to 0-100
  confidence = Math.max(0, Math.min(100, confidence));

  return {
    confidence: Math.round(confidence),
    explanation: parts.join(", "),
  };
}

// ============================================
// DECAY RULES
// ============================================

/**
 * Calculate expiration date based on memory layer
 * - SHORT_TERM: 7 days from creation
 * - MID_TERM: 30 days from creation
 * - LONG_TERM: null (never expires)
 */
export function calculateExpiresAt(layer: MemoryLayer, createdAt: Date = new Date()): Date | null {
  switch (layer) {
    case "SHORT_TERM":
      return new Date(createdAt.getTime() + 7 * 24 * 60 * 60 * 1000);
    case "MID_TERM":
      return new Date(createdAt.getTime() + 30 * 24 * 60 * 60 * 1000);
    case "LONG_TERM":
      return null;
  }
}

/**
 * Clean up expired memories
 */
export async function cleanupExpiredMemories(userId: string): Promise<number> {
  const now = new Date();
  
  const result = await prisma.aIMemory.deleteMany({
    where: {
      userId,
      expiresAt: { lt: now },
    },
  });

  if (result.count > 0) {
    await db.aIMemoryAudit.create({
      data: {
        userId,
        action: "EXPIRED",
        details: `${result.count} expired memories cleaned up`,
      },
    });
  }

  return result.count;
}

// ============================================
// WEEKLY SUMMARIZATION JOB
// ============================================

export interface WeeklySummaryInput {
  userId: string;
  weekStart: Date;
  weekEnd: Date;
}

export interface WeeklySummaryResult {
  memoriesCreated: number;
  memoriesUpdated: number;
  patterns: string[];
}

/**
 * Generate weekly memory summaries from check-ins and feedback
 * Called by a scheduled job or manually
 */
export async function generateWeeklySummary(input: WeeklySummaryInput): Promise<WeeklySummaryResult> {
  const { userId, weekStart, weekEnd } = input;
  const result: WeeklySummaryResult = {
    memoriesCreated: 0,
    memoriesUpdated: 0,
    patterns: [],
  };

  // Fetch all data sources for the week
  const [checkIns, feedbacks, diaryEntries] = await Promise.all([
    prisma.dailyCheckIn.findMany({
      where: { userId, date: { gte: weekStart, lte: weekEnd } },
      orderBy: { date: "asc" },
    }),
    prisma.postWorkoutFeedback.findMany({
      where: {
        userId,
        createdAt: { gte: weekStart, lte: weekEnd },
        visibleToAI: true,
      },
      orderBy: { createdAt: "asc" },
    }),
    prisma.diaryEntry.findMany({
      where: {
        userId,
        date: { gte: weekStart, lte: weekEnd },
        visibilityLevel: { in: ["FULL_AI_ACCESS", "METRICS_ONLY"] },
      },
      orderBy: { date: "asc" },
      select: {
        id: true,
        date: true,
        visibilityLevel: true,
        mood: true,
        energy: true,
        sleepQual: true,
        soreness: true,
        stress: true,
        motivation: true,
      },
    }),
  ]);

  const sources: MemorySource = {
    checkIns: checkIns.map((c: { id: string }) => c.id),
    feedback: feedbacks.map((f: { id: string }) => f.id),
    diary: diaryEntries.map((d: { id: string }) => d.id),
  };

  const totalDataPoints = checkIns.length + feedbacks.length + diaryEntries.length;
  if (totalDataPoints < 3) {
    return result; // Not enough data for meaningful summary
  }

  // 1. Summarize readiness patterns (SHORT_TERM)
  if (checkIns.length >= 3) {
    const readinessSummary = summarizeReadinessPatterns(checkIns);
    if (readinessSummary) {
      await upsertMemory({
        userId,
        layer: "SHORT_TERM",
        type: "PSYCHOLOGICAL",
        title: readinessSummary.title,
        summary: readinessSummary.summary,
        dataPoints: checkIns.length,
        sources: { checkIns: sources.checkIns, feedback: [], diary: [] },
        periodStart: weekStart,
        periodEnd: weekEnd,
      });
      result.memoriesCreated++;
      result.patterns.push(readinessSummary.title);
    }
  }

  // 2. Summarize override patterns (SHORT_TERM)
  const overrides = checkIns.filter((c: { userAccepted: boolean | null }) => c.userAccepted === false);
  if (overrides.length >= 2) {
    const overrideSummary = summarizeOverridePatterns(overrides);
    if (overrideSummary) {
      await upsertMemory({
        userId,
        layer: "SHORT_TERM",
        type: "OVERRIDE_PATTERN",
        title: overrideSummary.title,
        summary: overrideSummary.summary,
        dataPoints: overrides.length,
        sources: { checkIns: overrides.map((o: { id: string }) => o.id), feedback: [], diary: [] },
        periodStart: weekStart,
        periodEnd: weekEnd,
      });
      result.memoriesCreated++;
      result.patterns.push(overrideSummary.title);
    }
  }

  // 3. Summarize feedback language patterns (SHORT_TERM)
  const feedbackWithComments = feedbacks.filter(
    (f: { id: string; comment: string | null }) => !!f.comment && f.comment.trim().length > 0
  );
  const comments = feedbackWithComments.map((f: { comment: string | null }) => f.comment!);
  if (comments.length >= 2) {
    const languageSummary = await summarizeLanguagePatterns(
      comments,
      feedbackWithComments.map((f: { id: string }) => f.id)
    );
    if (languageSummary) {
      await upsertMemory({
        userId,
        layer: "SHORT_TERM",
        type: "LANGUAGE_PATTERN",
        title: languageSummary.title,
        summary: languageSummary.summary,
        dataPoints: comments.length,
        sources: { checkIns: [], feedback: languageSummary.sourceIds, diary: [] },
        periodStart: weekStart,
        periodEnd: weekEnd,
      });
      result.memoriesCreated++;
      result.patterns.push(languageSummary.title);
    }
  }

  // 4. Summarize fatigue patterns (SHORT_TERM)
  if (checkIns.length >= 3 || diaryEntries.length >= 3) {
    const fatigueSummary = summarizeFatiguePatterns(checkIns, diaryEntries);
    if (fatigueSummary) {
      await upsertMemory({
        userId,
        layer: "SHORT_TERM",
        type: "FATIGUE_RESPONSE",
        title: fatigueSummary.title,
        summary: fatigueSummary.summary,
        dataPoints: checkIns.length + diaryEntries.length,
        sources,
        periodStart: weekStart,
        periodEnd: weekEnd,
      });
      result.memoriesCreated++;
      result.patterns.push(fatigueSummary.title);
    }
  }

  // Log the summarization
  await db.aIMemoryAudit.create({
    data: {
      userId,
      action: "WEEKLY_SUMMARY",
      details: `Week ${weekStart.toISOString().split("T")[0]}: ${result.memoriesCreated} memories, patterns: ${result.patterns.join(", ")}`,
    },
  });

  return result;
}

// ============================================
// MONTHLY TRAIT INFERENCE
// ============================================

export interface MonthlyTraitResult {
  traitsInferred: number;
  traitsUpdated: number;
  traits: string[];
}

/**
 * Infer long-term traits from accumulated short/mid-term memories
 * Called monthly or when enough data accumulates
 */
export async function inferMonthlyTraits(
  userId: string,
  monthStart: Date,
  monthEnd: Date
): Promise<MonthlyTraitResult> {
  const result: MonthlyTraitResult = {
    traitsInferred: 0,
    traitsUpdated: 0,
    traits: [],
  };

  // Get all SHORT_TERM and MID_TERM memories from the month
  const recentMemories = await prisma.aIMemory.findMany({
    where: {
      userId,
      memoryLayer: { in: ["SHORT_TERM", "MID_TERM"] },
      periodEnd: { gte: monthStart, lte: monthEnd },
      supersededBy: null,
    },
    orderBy: { createdAt: "desc" },
  });

  if (recentMemories.length < 4) {
    return result; // Not enough weekly summaries
  }

  // Group memories by type
  const byType: Record<string, typeof recentMemories> = {};
  for (const m of recentMemories) {
    if (!byType[m.memoryType]) byType[m.memoryType] = [];
    byType[m.memoryType].push(m);
  }

  // Infer traits from consistent patterns
  for (const [type, memories] of Object.entries(byType)) {
    if (memories.length < 3) continue;

    const trait = inferTraitFromMemories(type as MemoryType, memories);
    if (trait) {
      // Check for contradictions with existing long-term traits
      const existingTrait = await prisma.aIMemory.findFirst({
        where: {
          userId,
          memoryType: type,
          memoryLayer: "LONG_TERM",
          supersededBy: null,
        },
      });

      const contradiction = existingTrait
        ? detectContradiction(existingTrait.summary, trait.summary)
        : null;

      // Aggregate source IDs from all contributing memories
      const allSources: MemorySource = { checkIns: [], feedback: [], diary: [] };
      for (const m of memories) {
        const src = m.sourceIdsJson ? JSON.parse(m.sourceIdsJson) as MemorySource : null;
        if (src) {
          allSources.checkIns.push(...src.checkIns);
          allSources.feedback.push(...src.feedback);
          allSources.diary.push(...src.diary);
        }
      }

      // Calculate confidence with contradiction handling
      const { confidence } = calculateConfidence({
        dataPoints: memories.reduce((sum: number, m: { dataPoints: number }) => sum + m.dataPoints, 0),
        hasRecentData: true,
        contradictionCount: contradiction ? 1 : 0,
        weeksSinceUpdate: 0,
        layer: "LONG_TERM",
      });

      // Only create trait if confidence is high enough
      if (confidence >= 50) {
        await upsertMemory({
          userId,
          layer: "LONG_TERM",
          type: type as MemoryType,
          title: trait.title,
          summary: contradiction
            ? `${trait.summary} (Note: This contradicts earlier observations. Confidence reduced.)`
            : trait.summary,
          dataPoints: memories.reduce((sum: number, m: { dataPoints: number }) => sum + m.dataPoints, 0),
          sources: allSources,
          periodStart: monthStart,
          periodEnd: monthEnd,
          confidenceOverride: confidence,
        });

        if (existingTrait) {
          result.traitsUpdated++;
        } else {
          result.traitsInferred++;
        }
        result.traits.push(trait.title);
      }
    }
  }

  // Log the trait inference
  await db.aIMemoryAudit.create({
    data: {
      userId,
      action: "MONTHLY_TRAITS",
      details: `Month ${monthStart.toISOString().split("T")[0]}: ${result.traitsInferred} new, ${result.traitsUpdated} updated. Traits: ${result.traits.join(", ")}`,
    },
  });

  return result;
}

// ============================================
// HELPER FUNCTIONS
// ============================================

interface SummaryResult {
  title: string;
  summary: string;
  sourceIds?: string[];
}

function summarizeReadinessPatterns(checkIns: Array<{
  sleepDuration: number;
  sleepQuality: number;
  physicalFatigue: number;
  mentalReadiness: number;
  motivation: number;
  stressLevel: number;
}>): SummaryResult | null {
  if (checkIns.length < 3) return null;

  const avg = (arr: number[]) => arr.reduce((a, b) => a + b, 0) / arr.length;

  const avgSleep = avg(checkIns.map(c => c.sleepDuration));
  const avgFatigue = avg(checkIns.map(c => c.physicalFatigue));
  const avgMotivation = avg(checkIns.map(c => c.motivation));
  const avgStress = avg(checkIns.map(c => c.stressLevel));

  const patterns: string[] = [];

  if (avgSleep < 6.5) {
    patterns.push(`sleep averaging ${avgSleep.toFixed(1)}h (below optimal)`);
  }
  if (avgFatigue >= 3.5) {
    patterns.push(`elevated fatigue (${avgFatigue.toFixed(1)}/5)`);
  }
  if (avgMotivation <= 2.5) {
    patterns.push(`low motivation (${avgMotivation.toFixed(1)}/5)`);
  }
  if (avgStress >= 3.5) {
    patterns.push(`high stress (${avgStress.toFixed(1)}/5)`);
  }

  if (patterns.length === 0) {
    if (avgMotivation >= 4 && avgFatigue <= 2) {
      return {
        title: "Strong readiness week",
        summary: `This week showed good readiness: motivation ${avgMotivation.toFixed(1)}/5, fatigue ${avgFatigue.toFixed(1)}/5, sleep ${avgSleep.toFixed(1)}h.`,
      };
    }
    return null;
  }

  return {
    title: `Readiness patterns: ${patterns.length} concern${patterns.length > 1 ? "s" : ""}`,
    summary: `This week: ${patterns.join("; ")}.`,
  };
}

function summarizeOverridePatterns(overrides: Array<{
  id: string;
  aiDecision: string | null;
  userOverrideReason: string | null;
}>): SummaryResult | null {
  if (overrides.length < 2) return null;

  const byDecision: Record<string, number> = {};
  for (const o of overrides) {
    if (o.aiDecision) {
      byDecision[o.aiDecision] = (byDecision[o.aiDecision] || 0) + 1;
    }
  }

  const mostOverridden = Object.entries(byDecision).sort((a, b) => b[1] - a[1])[0];
  if (!mostOverridden) return null;

  return {
    title: `Tends to override ${mostOverridden[0]} recommendations`,
    summary: `Overrode AI ${overrides.length} times this week, most commonly when ${mostOverridden[0]} was suggested (${mostOverridden[1]} times).`,
  };
}

async function summarizeLanguagePatterns(
  comments: string[],
  feedbackIds: string[]
): Promise<(SummaryResult & { sourceIds: string[] }) | null> {
  if (comments.length < 2) return null;

  // Extract semantic tags from all comments
  const tagCounts: Map<SemanticTag, number> = new Map();
  for (const comment of comments) {
    const tags = await extractSemanticTags(comment);
    for (const t of tags) {
      tagCounts.set(t.tag, (tagCounts.get(t.tag) || 0) + 1);
    }
  }

  if (tagCounts.size === 0) return null;

  // Find dominant patterns (appearing 2+ times)
  const dominant = Array.from(tagCounts.entries())
    .filter(([, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1]);

  if (dominant.length === 0) return null;

  const topPatterns = dominant.slice(0, 3).map(([tag]) => tag.replace(/_/g, " "));

  return {
    title: `Language patterns: ${topPatterns[0]}`,
    summary: `Recurring themes in feedback: ${topPatterns.join(", ")}. These patterns help understand subjective experience.`,
    sourceIds: feedbackIds,
  };
}

function summarizeFatiguePatterns(
  checkIns: Array<{ physicalFatigue: number; muscleSoreness: string }>,
  diaryEntries: Array<{ soreness: number | null; energy: number | null }>
): SummaryResult | null {
  const fatigueValues = checkIns.map(c => c.physicalFatigue);
  const sorenessValues = diaryEntries.filter(d => d.soreness !== null).map(d => d.soreness!);

  if (fatigueValues.length < 3 && sorenessValues.length < 3) return null;

  const avg = (arr: number[]) => arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;

  const avgFatigue = avg(fatigueValues);
  const avgSoreness = avg(sorenessValues);
  const severeSorenessCount = checkIns.filter(c => c.muscleSoreness === "SEVERE").length;

  if (avgFatigue >= 3.5 || severeSorenessCount >= 2) {
    return {
      title: "Elevated fatigue this week",
      summary: `Average fatigue ${avgFatigue.toFixed(1)}/5, soreness ${avgSoreness.toFixed(1)}/5. ${severeSorenessCount} days with severe soreness.`,
    };
  }

  if (avgFatigue <= 2 && avgSoreness <= 2) {
    return {
      title: "Good recovery this week",
      summary: `Low fatigue (${avgFatigue.toFixed(1)}/5) and soreness (${avgSoreness.toFixed(1)}/5) indicate good recovery.`,
    };
  }

  return null;
}

function inferTraitFromMemories(
  type: MemoryType,
  memories: Array<{ summary: string; dataPoints: number }>
): SummaryResult | null {
  // Look for consistent patterns across multiple weeks
  const summaries = memories.map(m => m.summary.toLowerCase());

  switch (type) {
    case "OVERRIDE_PATTERN": {
      const restOverrides = summaries.filter(s => s.includes("rest")).length;
      if (restOverrides >= 3) {
        return {
          title: "Tends to push through fatigue",
          summary: "Athlete frequently overrides rest recommendations. Consider being more cautious with recovery suggestions.",
        };
      }
      break;
    }

    case "FATIGUE_RESPONSE": {
      const elevatedCount = summaries.filter(s => s.includes("elevated")).length;
      const goodRecoveryCount = summaries.filter(s => s.includes("good recovery")).length;
      if (elevatedCount >= 3) {
        return {
          title: "Overreaches easily",
          summary: "Athlete shows elevated fatigue frequently. May need more conservative load progression.",
        };
      }
      if (goodRecoveryCount >= 3) {
        return {
          title: "Recovers well",
          summary: "Athlete consistently shows good recovery. Can handle moderate load increases.",
        };
      }
      break;
    }

    case "LANGUAGE_PATTERN": {
      const heavyLegsCount = summaries.filter(s => s.includes("heavy legs")).length;
      const mentalFatigueCount = summaries.filter(s => s.includes("mental")).length;
      if (heavyLegsCount >= 3) {
        return {
          title: "Muscular fatigue sensitive",
          summary: "Athlete frequently reports heavy legs. May benefit from more recovery between hard sessions.",
        };
      }
      if (mentalFatigueCount >= 3) {
        return {
          title: "Mental fatigue sensitive",
          summary: "Athlete frequently reports mental fatigue. Consider variety and mental recovery strategies.",
        };
      }
      break;
    }

    case "PSYCHOLOGICAL": {
      const lowMotivationCount = summaries.filter(s => s.includes("low motivation")).length;
      const highStressCount = summaries.filter(s => s.includes("high stress")).length;
      if (lowMotivationCount >= 3) {
        return {
          title: "Motivation fluctuates",
          summary: "Athlete shows recurring motivation dips. May benefit from variety and goal-setting.",
        };
      }
      if (highStressCount >= 3) {
        return {
          title: "Stress-sensitive",
          summary: "Athlete frequently reports high stress. Training load should account for life stress.",
        };
      }
      break;
    }
  }

  return null;
}

function detectContradiction(existingSummary: string, newSummary: string): boolean {
  const existing = existingSummary.toLowerCase();
  const newS = newSummary.toLowerCase();

  // Simple contradiction detection based on opposing keywords
  const contradictions = [
    ["overreaches easily", "recovers well"],
    ["push through fatigue", "respects recovery"],
    ["low motivation", "high motivation"],
    ["stress-sensitive", "handles stress well"],
  ];

  for (const [a, b] of contradictions) {
    if ((existing.includes(a) && newS.includes(b)) || (existing.includes(b) && newS.includes(a))) {
      return true;
    }
  }

  return false;
}

// ============================================
// MEMORY UPSERT
// ============================================

interface UpsertMemoryInput {
  userId: string;
  layer: MemoryLayer;
  type: MemoryType;
  title: string;
  summary: string;
  dataPoints: number;
  sources: MemorySource;
  periodStart: Date;
  periodEnd: Date;
  confidenceOverride?: number;
}

async function upsertMemory(input: UpsertMemoryInput): Promise<string> {
  const {
    userId,
    layer,
    type,
    title,
    summary,
    dataPoints,
    sources,
    periodStart,
    periodEnd,
    confidenceOverride,
  } = input;

  // Check for existing memory of same type and layer
  const existing = await prisma.aIMemory.findFirst({
    where: {
      userId,
      memoryType: type,
      memoryLayer: layer,
      supersededBy: null,
    },
    orderBy: { createdAt: "desc" },
  });

  const expiresAt = calculateExpiresAt(layer);

  // Calculate confidence
  const { confidence } = confidenceOverride !== undefined
    ? { confidence: confidenceOverride }
    : calculateConfidence({
        dataPoints,
        hasRecentData: true,
        contradictionCount: 0,
        weeksSinceUpdate: 0,
        layer,
      });

  // Create new memory
  const newMemory = await prisma.aIMemory.create({
    data: {
      userId,
      memoryLayer: layer,
      memoryType: type,
      title,
      summary,
      confidence,
      dataPoints,
      sourceIdsJson: JSON.stringify(sources),
      periodStart,
      periodEnd,
      expiresAt,
      version: existing ? existing.version + 1 : 1,
    },
  });

  // Mark old memory as superseded
  if (existing) {
    await prisma.aIMemory.update({
      where: { id: existing.id },
      data: { supersededBy: newMemory.id },
    });
  }

  return newMemory.id;
}

// ============================================
// QUERY FUNCTIONS
// ============================================

/**
 * Get all active memories for a user, organized by layer
 */
export async function getAIMemoryForUser(userId: string): Promise<{
  shortTerm: MemoryRecord[];
  midTerm: MemoryRecord[];
  longTerm: MemoryRecord[];
  totalConfidence: number;
}> {
  // Clean up expired memories first
  await cleanupExpiredMemories(userId);

  const memories = await prisma.aIMemory.findMany({
    where: {
      userId,
      supersededBy: null,
    },
    orderBy: { createdAt: "desc" },
  });

  const shortTerm: MemoryRecord[] = [];
  const midTerm: MemoryRecord[] = [];
  const longTerm: MemoryRecord[] = [];

  for (const m of memories) {
    const record: MemoryRecord = {
      id: m.id,
      layer: m.memoryLayer as MemoryLayer,
      type: m.memoryType as MemoryType,
      title: m.title,
      summary: m.summary,
      confidence: m.confidence,
      dataPoints: m.dataPoints,
      sources: m.sourceIdsJson ? JSON.parse(m.sourceIdsJson) : { checkIns: [], feedback: [], diary: [] },
      periodStart: m.periodStart,
      periodEnd: m.periodEnd,
      expiresAt: m.expiresAt,
      createdAt: m.createdAt,
    };

    switch (m.memoryLayer) {
      case "SHORT_TERM":
        shortTerm.push(record);
        break;
      case "MID_TERM":
        midTerm.push(record);
        break;
      case "LONG_TERM":
        longTerm.push(record);
        break;
    }
  }

  // Calculate total confidence (weighted average)
  const allMemories = [...shortTerm, ...midTerm, ...longTerm];
  const totalConfidence = allMemories.length > 0
    ? Math.round(allMemories.reduce((sum, m) => sum + m.confidence, 0) / allMemories.length)
    : 0;

  return { shortTerm, midTerm, longTerm, totalConfidence };
}

/**
 * Explain why AI knows something (source tracing)
 */
export async function explainWhyAIKnowsThis(
  userId: string,
  memoryId: string
): Promise<MemoryExplanation | null> {
  const memory = await prisma.aIMemory.findFirst({
    where: { id: memoryId, userId },
  });

  if (!memory) return null;

  const sources: MemoryExplanation["sources"] = [];
  const memSources: MemorySource = memory.sourceIdsJson
    ? JSON.parse(memory.sourceIdsJson)
    : { checkIns: [], feedback: [], diary: [] };

  // Fetch source details (anonymized snippets, not raw text)
  if (memSources.checkIns.length > 0) {
    const checkIns = await prisma.dailyCheckIn.findMany({
      where: { id: { in: memSources.checkIns.slice(0, 5) } },
      select: { id: true, date: true, aiDecision: true, sleepDuration: true, physicalFatigue: true },
    });
    for (const c of checkIns) {
      const safeSnippet = `Check-in: sleep ${c.sleepDuration}h, fatigue ${c.physicalFatigue}/5${c.aiDecision ? `, AI suggested ${c.aiDecision}` : ""}`;
      sources.push({
        type: "checkIn",
        id: c.id,
        date: c.date,
        safeSnippet,
        snippet: safeSnippet,
      });
    }
  }

  if (memSources.feedback.length > 0) {
    const feedbacks = await prisma.postWorkoutFeedback.findMany({
      where: { id: { in: memSources.feedback.slice(0, 5) } },
      select: { id: true, createdAt: true, perceivedDifficulty: true, enjoyment: true },
    });
    for (const f of feedbacks) {
      const safeSnippet = `Feedback: ${f.perceivedDifficulty}, enjoyment ${f.enjoyment}/5`;
      sources.push({
        type: "feedback",
        id: f.id,
        date: f.createdAt,
        safeSnippet,
        snippet: safeSnippet,
      });
    }
  }

  if (memSources.diary.length > 0) {
    const diaries = await prisma.diaryEntry.findMany({
      where: {
        id: { in: memSources.diary.slice(0, 10) },
        visibilityLevel: { in: ["FULL_AI_ACCESS", "METRICS_ONLY"] },
      },
      select: {
        id: true,
        date: true,
        visibilityLevel: true,
        mood: true,
        energy: true,
        sleepQual: true,
        soreness: true,
        stress: true,
        motivation: true,
      },
    });
    for (const d of diaries) {
      const safeSnippet = safeSnippetFromDiary({
        visibilityLevel: d.visibilityLevel,
        mood: d.mood,
        energy: d.energy,
        sleepQual: d.sleepQual,
        soreness: d.soreness,
        stress: d.stress,
        motivation: d.motivation,
      });
      if (!safeSnippet) continue;
      sources.push({
        type: "diary",
        id: d.id,
        date: d.date,
        safeSnippet,
        snippet: safeSnippet,
      });
    }
  }

  // Calculate confidence explanation
  const weeksSinceUpdate = Math.floor(
    (Date.now() - memory.updatedAt.getTime()) / (7 * 24 * 60 * 60 * 1000)
  );
  const { explanation: confidenceExplanation } = calculateConfidence({
    dataPoints: memory.dataPoints,
    hasRecentData: weeksSinceUpdate === 0,
    contradictionCount: memory.summary.includes("contradicts") ? 1 : 0,
    weeksSinceUpdate,
    layer: memory.memoryLayer as MemoryLayer,
  });

  return {
    memoryId: memory.id,
    title: memory.title,
    summary: memory.summary,
    confidence: memory.confidence,
    confidenceExplanation,
    sources,
    canDelete: true,
    canEdit: memory.memoryLayer !== "LONG_TERM", // Long-term traits require more data to change
  };
}

// ============================================
// DELETION / CORRECTION
// ============================================

/**
 * Delete a specific memory
 */
export async function deleteMemory(userId: string, memoryId: string): Promise<boolean> {
  const memory = await prisma.aIMemory.findFirst({
    where: { id: memoryId, userId },
  });

  if (!memory) return false;

  await prisma.aIMemory.delete({ where: { id: memoryId } });

  await prisma.aIMemoryAudit.create({
    data: {
      userId,
      action: "DELETED",
      memoryType: memory.memoryType,
      details: `Deleted: ${memory.title}`,
    },
  });

  return true;
}

/**
 * Correct a memory (update title/summary, resets confidence)
 */
export async function correctMemory(
  userId: string,
  memoryId: string,
  correction: { title?: string; summary?: string }
): Promise<boolean> {
  const memory = await prisma.aIMemory.findFirst({
    where: { id: memoryId, userId },
  });

  if (!memory) return false;

  // Corrections reduce confidence (user is overriding AI)
  const newConfidence = Math.max(30, memory.confidence - 20);

  await prisma.aIMemory.update({
    where: { id: memoryId },
    data: {
      title: correction.title || memory.title,
      summary: correction.summary || memory.summary,
      confidence: newConfidence,
      version: memory.version + 1,
    },
  });

  await prisma.aIMemoryAudit.create({
    data: {
      userId,
      action: "CORRECTED",
      memoryType: memory.memoryType,
      details: `Corrected: ${memory.title} → ${correction.title || memory.title}`,
    },
  });

  return true;
}

/**
 * Promote a SHORT_TERM memory to MID_TERM (if pattern persists)
 */
export async function promoteMemory(userId: string, memoryId: string): Promise<boolean> {
  const memory = await prisma.aIMemory.findFirst({
    where: { id: memoryId, userId, memoryLayer: "SHORT_TERM" },
  });

  if (!memory) return false;

  await prisma.aIMemory.update({
    where: { id: memoryId },
    data: {
      memoryLayer: "MID_TERM",
      expiresAt: calculateExpiresAt("MID_TERM"),
      version: memory.version + 1,
    },
  });

  await prisma.aIMemoryAudit.create({
    data: {
      userId,
      action: "PROMOTED",
      memoryType: memory.memoryType,
      details: `Promoted to MID_TERM: ${memory.title}`,
    },
  });

  return true;
}
