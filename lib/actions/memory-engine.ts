"use server";

/**
 * AI Memory Engine Server Actions (Spec v1.0 §4)
 * 
 * Exposes memory engine functions as server actions for:
 * - Querying memories by layer
 * - Explaining why AI knows something
 * - Deleting/correcting memories
 * - Triggering summarization jobs
 */

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import {
  getAIMemoryForUser,
  explainWhyAIKnowsThis,
  deleteMemory,
  correctMemory,
  promoteMemory,
  generateWeeklySummary,
  inferMonthlyTraits,
  cleanupExpiredMemories,
  calculateConfidence,
  type MemoryRecord,
  type MemoryExplanation,
  type MemoryLayer,
  type MemoryType,
  type WeeklySummaryResult,
  type MonthlyTraitResult,
} from "@/lib/services/memory-engine.service";

// ============================================
// TYPES
// ============================================

export interface MemoryQueryResult {
  success: boolean;
  error?: string;
  data?: {
    shortTerm: MemoryRecord[];
    midTerm: MemoryRecord[];
    longTerm: MemoryRecord[];
    totalConfidence: number;
  };
}

export interface MemoryExplanationResult {
  success: boolean;
  error?: string;
  data?: MemoryExplanation;
}

export interface MemoryMutationResult {
  success: boolean;
  error?: string;
}

export interface SummarizationResult {
  success: boolean;
  error?: string;
  data?: WeeklySummaryResult | MonthlyTraitResult;
}

// ============================================
// QUERY ACTIONS
// ============================================

/**
 * Get all active memories for the current user, organized by layer
 */
export async function getUserMemories(): Promise<MemoryQueryResult> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Not authenticated" };
    }

    const data = await getAIMemoryForUser(session.user.id);
    return { success: true, data };
  } catch (error) {
    console.error("Error getting user memories:", error);
    return { success: false, error: "Failed to get memories" };
  }
}

/**
 * Explain why AI knows something (source tracing)
 * Returns anonymized source references, never raw text
 */
export async function explainMemory(memoryId: string): Promise<MemoryExplanationResult> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Not authenticated" };
    }

    const data = await explainWhyAIKnowsThis(session.user.id, memoryId);
    if (!data) {
      return { success: false, error: "Memory not found" };
    }

    return { success: true, data };
  } catch (error) {
    console.error("Error explaining memory:", error);
    return { success: false, error: "Failed to explain memory" };
  }
}

/**
 * Get memories filtered by layer
 */
export async function getMemoriesByLayer(layer: MemoryLayer): Promise<{
  success: boolean;
  error?: string;
  memories?: MemoryRecord[];
}> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Not authenticated" };
    }

    const data = await getAIMemoryForUser(session.user.id);
    
    let memories: MemoryRecord[];
    switch (layer) {
      case "SHORT_TERM":
        memories = data.shortTerm;
        break;
      case "MID_TERM":
        memories = data.midTerm;
        break;
      case "LONG_TERM":
        memories = data.longTerm;
        break;
      default:
        memories = [];
    }

    return { success: true, memories };
  } catch (error) {
    console.error("Error getting memories by layer:", error);
    return { success: false, error: "Failed to get memories" };
  }
}

/**
 * Get memories filtered by type
 */
export async function getMemoriesByType(type: MemoryType): Promise<{
  success: boolean;
  error?: string;
  memories?: MemoryRecord[];
}> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Not authenticated" };
    }

    const data = await getAIMemoryForUser(session.user.id);
    const allMemories = [...data.shortTerm, ...data.midTerm, ...data.longTerm];
    const memories = allMemories.filter(m => m.type === type);

    return { success: true, memories };
  } catch (error) {
    console.error("Error getting memories by type:", error);
    return { success: false, error: "Failed to get memories" };
  }
}

// ============================================
// MUTATION ACTIONS
// ============================================

/**
 * Delete a specific memory
 * Athlete can delete any memory they don't want AI to use
 */
export async function deleteUserMemory(memoryId: string): Promise<MemoryMutationResult> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Not authenticated" };
    }

    const deleted = await deleteMemory(session.user.id, memoryId);
    if (!deleted) {
      return { success: false, error: "Memory not found or already deleted" };
    }

    revalidatePath("/settings");
    return { success: true };
  } catch (error) {
    console.error("Error deleting memory:", error);
    return { success: false, error: "Failed to delete memory" };
  }
}

/**
 * Correct a memory (update title/summary)
 * Athlete can correct AI's interpretation
 */
export async function correctUserMemory(
  memoryId: string,
  correction: { title?: string; summary?: string }
): Promise<MemoryMutationResult> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Not authenticated" };
    }

    if (!correction.title && !correction.summary) {
      return { success: false, error: "No correction provided" };
    }

    const corrected = await correctMemory(session.user.id, memoryId, correction);
    if (!corrected) {
      return { success: false, error: "Memory not found" };
    }

    revalidatePath("/settings");
    return { success: true };
  } catch (error) {
    console.error("Error correcting memory:", error);
    return { success: false, error: "Failed to correct memory" };
  }
}

/**
 * Promote a SHORT_TERM memory to MID_TERM
 * Used when athlete confirms a pattern is accurate
 */
export async function promoteUserMemory(memoryId: string): Promise<MemoryMutationResult> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Not authenticated" };
    }

    const promoted = await promoteMemory(session.user.id, memoryId);
    if (!promoted) {
      return { success: false, error: "Memory not found or not promotable" };
    }

    revalidatePath("/settings");
    return { success: true };
  } catch (error) {
    console.error("Error promoting memory:", error);
    return { success: false, error: "Failed to promote memory" };
  }
}

// ============================================
// SUMMARIZATION ACTIONS
// ============================================

/**
 * Trigger weekly summarization for the current user
 * Normally called by a scheduled job, but can be triggered manually
 */
export async function triggerWeeklySummarization(
  weekStart?: Date,
  weekEnd?: Date
): Promise<SummarizationResult> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Not authenticated" };
    }

    // Default to last 7 days if not specified
    const end = weekEnd || new Date();
    const start = weekStart || new Date(end.getTime() - 7 * 24 * 60 * 60 * 1000);

    const data = await generateWeeklySummary({
      userId: session.user.id,
      weekStart: start,
      weekEnd: end,
    });

    revalidatePath("/settings");
    return { success: true, data };
  } catch (error) {
    console.error("Error triggering weekly summarization:", error);
    return { success: false, error: "Failed to generate weekly summary" };
  }
}

/**
 * Trigger monthly trait inference for the current user
 * Normally called by a scheduled job, but can be triggered manually
 */
export async function triggerMonthlyTraitInference(
  monthStart?: Date,
  monthEnd?: Date
): Promise<SummarizationResult> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Not authenticated" };
    }

    // Default to last 30 days if not specified
    const end = monthEnd || new Date();
    const start = monthStart || new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);

    const data = await inferMonthlyTraits(session.user.id, start, end);

    revalidatePath("/settings");
    return { success: true, data };
  } catch (error) {
    console.error("Error triggering monthly trait inference:", error);
    return { success: false, error: "Failed to infer monthly traits" };
  }
}

/**
 * Clean up expired memories
 */
export async function cleanupMemories(): Promise<{
  success: boolean;
  error?: string;
  deletedCount?: number;
}> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Not authenticated" };
    }

    const deletedCount = await cleanupExpiredMemories(session.user.id);

    revalidatePath("/settings");
    return { success: true, deletedCount };
  } catch (error) {
    console.error("Error cleaning up memories:", error);
    return { success: false, error: "Failed to clean up memories" };
  }
}

// ============================================
// UTILITY ACTIONS
// ============================================

/**
 * Get confidence calculation for a hypothetical memory
 * Useful for UI to show how confidence is calculated
 */
export function getConfidenceCalculation(params: {
  dataPoints: number;
  hasRecentData: boolean;
  contradictionCount: number;
  weeksSinceUpdate: number;
  layer: MemoryLayer;
}): { confidence: number; explanation: string } {
  return calculateConfidence(params);
}

/**
 * Get memory context for AI Coach prompts
 * Returns a formatted string summarizing all active memories
 */
export async function getMemoryContextForAI(): Promise<string> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return "No user session available.";
    }

    const data = await getAIMemoryForUser(session.user.id);
    const allMemories = [...data.longTerm, ...data.midTerm, ...data.shortTerm];

    if (allMemories.length === 0) {
      return "No AI memory available yet. Rely on objective training data.";
    }

    let context = `## AI Memory (${allMemories.length} active memories, ${data.totalConfidence}% avg confidence)\n\n`;

    // Long-term traits first (most important)
    if (data.longTerm.length > 0) {
      context += `### Long-Term Traits\n`;
      for (const m of data.longTerm) {
        context += `- **${m.title}** (${m.confidence}% confidence): ${m.summary}\n`;
      }
      context += "\n";
    }

    // Mid-term patterns
    if (data.midTerm.length > 0) {
      context += `### Recent Patterns (30 days)\n`;
      for (const m of data.midTerm) {
        context += `- ${m.title}: ${m.summary}\n`;
      }
      context += "\n";
    }

    // Short-term observations
    if (data.shortTerm.length > 0) {
      context += `### This Week\n`;
      for (const m of data.shortTerm) {
        context += `- ${m.title}: ${m.summary}\n`;
      }
      context += "\n";
    }

    return context;
  } catch (error) {
    console.error("Error getting memory context:", error);
    return "Unable to retrieve AI memory.";
  }
}

// Re-export types for consumers
export type {
  MemoryRecord,
  MemoryExplanation,
  MemoryLayer,
  MemoryType,
  WeeklySummaryResult,
  MonthlyTraitResult,
};
