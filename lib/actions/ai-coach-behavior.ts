"use server";

/**
 * AI Coach Behavior Server Actions (Spec v1.0 §6, §8)
 * 
 * Exposes coach behavior functions as server actions for:
 * - Generating explanations with proper tone
 * - Creating weekly/monthly summaries
 * - Applying guardrails
 */

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  generateExplanation,
  generateWeeklySummary,
  generateMonthlySummary,
  generateCoachSystemPrompt,
  generateCoachUserPrompt,
  applyConfidenceGuardrail,
  ensureBecauseReasoning,
  includeSimulatorWarningIfRelevant,
  respectPlanRigidity,
  type ToneMode,
  type PlanRigidity,
  type CoachContext,
  type ExplanationContext,
  type WeeklySummaryData,
  type MonthlySummaryData,
  type SimulatorWarning,
} from "@/lib/services/ai-coach-behavior.service";
import { getAIMemoryForUser } from "@/lib/services/memory-engine.service";
import { getOverrideStats } from "@/lib/actions/daily-checkin";
import { buildAIContextForUser } from "@/lib/services/ai-context.builder";

// Type assertion for Prisma queries with new schema fields
const prisma = db as any;

// ============================================
// CONTEXT BUILDING
// ============================================

/**
 * Build coach context from user data
 */
export async function buildCoachContext(): Promise<CoachContext | null> {
  try {
    const session = await auth();
    if (!session?.user?.id) return null;

    const userId = session.user.id;

    const aiContext = await buildAIContextForUser(userId);

    // Get user preferences
    const toneMode = (aiContext.userProfile.tonePreference as ToneMode) || "SUPPORTIVE";
    const planRigidity = (aiContext.userProfile.planRigidity as PlanRigidity) || "LOCKED_1_DAY";

    // Get memory confidence
    const memories = await getAIMemoryForUser(userId);

    // Get override stats
    const overrideStats = await getOverrideStats(30);

    // Get recent quotes from feedback
    const recentQuotesFromContext: string[] = [];

    const recentQuotesFallback = await db.postWorkoutFeedback.findMany({
      where: {
        userId,
        visibleToAI: true,
        comment: { not: null },
      },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: { comment: true },
    });

    // Get simulator warnings
    const simulatorWarnings: SimulatorWarning[] = await getActiveSimulatorWarnings(userId);

    return {
      toneMode,
      planRigidity,
      athleteName: aiContext.userProfile.name || undefined,
      recentQuotes: (recentQuotesFromContext.length > 0
        ? recentQuotesFromContext
        : recentQuotesFallback.filter((f) => f.comment).map((f) => f.comment!)).slice(0, 3),
      memoryConfidence: memories.totalConfidence,
      simulatorWarnings,
      overrideRate: overrideStats.overrideRate,
    };
  } catch (error) {
    console.error("Error building coach context:", error);
    return null;
  }
}

async function getActiveSimulatorWarnings(userId: string): Promise<SimulatorWarning[]> {
  try {
    const warnings = await prisma.aIWarning.findMany({
      where: {
        userId,
        dismissed: false,
        OR: [
          { expiresAt: null },
          { expiresAt: { gt: new Date() } },
        ],
      },
      orderBy: { createdAt: "desc" },
      take: 5,
    });

    return warnings.map((w: any) => ({
      type: w.warningType,
      severity: w.severity,
      message: w.message,
      confidence: w.confidence,
    }));
  } catch {
    return [];
  }
}

// ============================================
// EXPLANATION GENERATION
// ============================================

/**
 * Generate an AI explanation for a decision
 */
export async function generateAIExplanation(
  decision: string,
  primaryReason: string,
  secondaryReasons: string[],
  confidence: number,
  athleteQuote?: string
): Promise<{ success: boolean; explanation?: string; error?: string }> {
  try {
    const context = await buildCoachContext();
    if (!context) {
      return { success: false, error: "Could not build coach context" };
    }

    const explanationContext: ExplanationContext = {
      decision,
      primaryReason,
      secondaryReasons,
      confidence,
      athleteQuote,
      simulatorRisk: context.simulatorWarnings.find(
        w => w.severity === "HIGH" || w.severity === "CRITICAL"
      ),
    };

    let explanation = generateExplanation(explanationContext, context);

    // Apply guardrails
    explanation = applyConfidenceGuardrail(explanation, confidence);
    explanation = ensureBecauseReasoning(explanation, primaryReason);
    explanation = includeSimulatorWarningIfRelevant(
      explanation,
      context.simulatorWarnings,
      context.toneMode
    );

    return { success: true, explanation };
  } catch (error) {
    console.error("Error generating explanation:", error);
    return { success: false, error: "Failed to generate explanation" };
  }
}

// ============================================
// WEEKLY SUMMARY
// ============================================

/**
 * Generate weekly summary for the current user
 */
export async function generateWeeklySummaryForUser(
  weekStart?: Date,
  weekEnd?: Date
): Promise<{ success: boolean; summary?: string; error?: string }> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Not authenticated" };
    }

    const userId = session.user.id;
    const context = await buildCoachContext();
    if (!context) {
      return { success: false, error: "Could not build coach context" };
    }

    // Default to last 7 days
    const end = weekEnd || new Date();
    const start = weekStart || new Date(end.getTime() - 7 * 24 * 60 * 60 * 1000);

    // Gather data
    const [workouts, checkIns, feedback] = await Promise.all([
      db.workout.findMany({
        where: {
          userId,
          date: { gte: start, lte: end },
        },
      }),
      prisma.dailyCheckIn.findMany({
        where: {
          userId,
          date: { gte: start, lte: end },
        },
      }),
      db.postWorkoutFeedback.findMany({
        where: {
          userId,
          createdAt: { gte: start, lte: end },
          visibleToAI: true,
        },
      }),
    ]);

    // Calculate metrics
    const plannedWorkouts = workouts.filter((w: any) => w.planned);
    const completedWorkouts = workouts.filter((w: any) => w.completed);
    const plannedHours = plannedWorkouts.reduce((sum: number, w: any) => sum + (w.durationMin || 0), 0) / 60;
    const completedHours = completedWorkouts.reduce((sum: number, w: any) => sum + (w.durationMin || 0), 0) / 60;
    const compliancePercent = plannedHours > 0 ? Math.round((completedHours / plannedHours) * 100) : 0;

    // Readiness average
    const readinessScores = checkIns.map((c: any) => {
      const sleep = Math.min(c.sleepDuration / 8, 1) * 30;
      const fatigue = ((6 - c.physicalFatigue) / 5) * 30;
      const mental = ((c.mentalReadiness + c.motivation) / 10) * 40;
      return sleep + fatigue + mental;
    });
    const avgReadiness = readinessScores.length > 0
      ? Math.round(readinessScores.reduce((a: number, b: number) => a + b, 0) / readinessScores.length)
      : 50;

    // Enjoyment average
    const avgEnjoyment = feedback.length > 0
      ? Math.round(feedback.reduce((sum: number, f: any) => sum + f.enjoyment, 0) / feedback.length * 10) / 10
      : 3;

    // Hard sessions
    const hardSessionCount = feedback.filter(
      (f: any) => f.perceivedDifficulty === "HARD" || f.perceivedDifficulty === "BRUTAL"
    ).length;

    // Rest days
    const restDayCount = workouts.filter((w: any) => w.type === "rest" || w.durationMin === 0).length;

    // Get a quote
    const quoteEntry = feedback.find((f: any) => f.comment);
    const athleteQuote = quoteEntry?.comment || undefined;

    // Generate insight
    const keyInsight = generateKeyInsight(compliancePercent, avgReadiness, hardSessionCount, avgEnjoyment);

    // Generate next week focus
    const nextWeekFocus = generateNextWeekFocus(compliancePercent, avgReadiness, hardSessionCount);

    const data: WeeklySummaryData = {
      weekStart: start,
      weekEnd: end,
      plannedHours,
      completedHours,
      compliancePercent,
      avgReadiness,
      avgEnjoyment,
      hardSessionCount,
      restDayCount,
      keyInsight,
      athleteQuote,
      nextWeekFocus,
    };

    const summary = generateWeeklySummary(data, context.toneMode);

    return { success: true, summary };
  } catch (error) {
    console.error("Error generating weekly summary:", error);
    return { success: false, error: "Failed to generate weekly summary" };
  }
}

function generateKeyInsight(
  compliance: number,
  readiness: number,
  hardSessions: number,
  enjoyment: number
): string {
  if (compliance >= 90 && readiness >= 70) {
    return "Strong execution with good recovery — you're in a great training state.";
  }
  if (compliance >= 80 && readiness < 50) {
    return "You pushed through despite low readiness. Watch for accumulated fatigue.";
  }
  if (compliance < 70 && readiness >= 70) {
    return "Lower volume but good recovery — sometimes less is more.";
  }
  if (hardSessions >= 3 && enjoyment < 2.5) {
    return "Lots of hard sessions with low enjoyment — consider mixing in more fun workouts.";
  }
  if (enjoyment >= 4) {
    return "High enjoyment this week — that's the foundation of sustainable training.";
  }
  return "A balanced week with room for fine-tuning.";
}

function generateNextWeekFocus(compliance: number, readiness: number, hardSessions: number): string {
  if (readiness < 50) {
    return "Prioritize recovery. Consider starting with an easy day.";
  }
  if (hardSessions >= 4) {
    return "Balance the intensity. Add a recovery day mid-week.";
  }
  if (compliance < 60) {
    return "Focus on consistency. Even short sessions count.";
  }
  return "Maintain the momentum. Stay consistent and listen to your body.";
}

// ============================================
// MONTHLY SUMMARY
// ============================================

/**
 * Generate monthly summary for the current user
 */
export async function generateMonthlySummaryForUser(
  monthStart?: Date,
  monthEnd?: Date
): Promise<{ success: boolean; summary?: string; error?: string }> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Not authenticated" };
    }

    const userId = session.user.id;
    const context = await buildCoachContext();
    if (!context) {
      return { success: false, error: "Could not build coach context" };
    }

    // Default to last 30 days
    const end = monthEnd || new Date();
    const start = monthStart || new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Get metrics at start and end
    const [startMetrics, endMetrics, workouts, feedback] = await Promise.all([
      db.metricDaily.findFirst({
        where: { userId, date: { gte: start, lte: new Date(start.getTime() + 3 * 24 * 60 * 60 * 1000) } },
        orderBy: { date: "asc" },
      }),
      db.metricDaily.findFirst({
        where: { userId, date: { lte: end } },
        orderBy: { date: "desc" },
      }),
      db.workout.findMany({
        where: { userId, date: { gte: start, lte: end } },
      }),
      db.postWorkoutFeedback.findMany({
        where: { userId, createdAt: { gte: start, lte: end }, visibleToAI: true },
        select: { comment: true, enjoyment: true, perceivedDifficulty: true },
      }),
    ]);

    const ctlStart = startMetrics?.ctl || 50;
    const ctlEnd = endMetrics?.ctl || 50;
    const ctlChange = Math.round(ctlEnd - ctlStart);

    const completedWorkouts = workouts.filter((w: any) => w.completed);
    const plannedWorkouts = workouts.filter((w: any) => w.planned);
    const totalHours = completedWorkouts.reduce((sum: number, w: any) => sum + (w.durationMin || 0), 0) / 60;
    const plannedHours = plannedWorkouts.reduce((sum: number, w: any) => sum + (w.durationMin || 0), 0) / 60;
    const compliancePercent = plannedHours > 0 ? Math.round((totalHours / plannedHours) * 100) : 0;

    // Behavioral pattern from memory
    const memories = await getAIMemoryForUser(userId);
    const behavioralPattern = memories.longTerm.length > 0
      ? memories.longTerm[0].summary
      : "Still learning your patterns — keep logging!";

    // Highlight (best session or milestone)
    const bestSession = feedback.reduce((best: any, f: any) => 
      f.enjoyment > (best?.enjoyment || 0) ? f : best, null);
    const highlight = bestSession?.comment || "Consistent training throughout the month.";

    // Concern
    const hardCount = feedback.filter((f: any) => 
      f.perceivedDifficulty === "HARD" || f.perceivedDifficulty === "BRUTAL"
    ).length;
    const concern = hardCount > feedback.length * 0.5
      ? `${Math.round(hardCount / feedback.length * 100)}% of sessions felt hard — watch for burnout.`
      : undefined;

    // Quotes
    const athleteQuotes = feedback
      .filter((f: any) => f.comment)
      .map((f: any) => f.comment!)
      .slice(0, 3);

    const data: MonthlySummaryData = {
      monthStart: start,
      monthEnd: end,
      ctlChange,
      ctlStart,
      ctlEnd,
      totalHours,
      compliancePercent,
      behavioralPattern,
      highlight,
      concern,
      athleteQuotes,
    };

    const summary = generateMonthlySummary(data, context.toneMode);

    return { success: true, summary };
  } catch (error) {
    console.error("Error generating monthly summary:", error);
    return { success: false, error: "Failed to generate monthly summary" };
  }
}

// ============================================
// PROMPT GENERATION
// ============================================

/**
 * Get system prompt for AI Coach
 */
export async function getCoachSystemPrompt(): Promise<string> {
  const context = await buildCoachContext();
  if (!context) {
    return "You are an AI endurance coach. Be helpful and explain your reasoning.";
  }
  return generateCoachSystemPrompt(context);
}

/**
 * Get user prompt for specific scenario
 */
export async function getCoachUserPrompt(
  scenario: "daily_checkin" | "post_workout" | "weekly_summary" | "plan_change",
  data: Record<string, unknown>
): Promise<string> {
  return generateCoachUserPrompt(scenario, data);
}

// ============================================
// PLAN CHANGE WITH RIGIDITY CHECK
// ============================================

/**
 * Propose a plan change, respecting rigidity
 */
export async function proposePlanChange(
  proposedChange: string,
  reason: string,
  confidence: number
): Promise<{
  success: boolean;
  message?: string;
  canApply?: boolean;
  error?: string;
}> {
  try {
    const context = await buildCoachContext();
    if (!context) {
      return { success: false, error: "Could not build coach context" };
    }

    const { message, canApply } = respectPlanRigidity(
      proposedChange,
      context.planRigidity,
      context.toneMode
    );

    // Apply guardrails
    let finalMessage = applyConfidenceGuardrail(message, confidence);
    finalMessage = ensureBecauseReasoning(finalMessage, reason);

    return { success: true, message: finalMessage, canApply };
  } catch (error) {
    console.error("Error proposing plan change:", error);
    return { success: false, error: "Failed to propose plan change" };
  }
}

// Re-export types
export type {
  ToneMode,
  PlanRigidity,
  CoachContext,
  ExplanationContext,
  WeeklySummaryData,
  MonthlySummaryData,
  SimulatorWarning,
};
