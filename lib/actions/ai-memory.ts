"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  getAIMemorySummary,
  resetAIMemory,
  exportAIMemoryData,
  getAIMemoryContextForPrompt,
  type VisibilityLevel,
  type MemoryType,
  type AIMemorySummary,
} from "@/lib/services/ai-memory.service";

// Types
export interface DiaryEntryVisibility {
  id: string;
  date: Date;
  visibilityLevel: VisibilityLevel;
  aiUsedForTraining: boolean;
  aiUsedAt: Date | null;
}

export interface UpdateVisibilityResult {
  success: boolean;
  error?: string;
}

export interface MemorySummaryResult {
  success: boolean;
  data?: AIMemorySummary;
  error?: string;
}

export interface MemoryExportResult {
  success: boolean;
  data?: {
    memories: Array<{
      type: string;
      title: string;
      summary: string;
      confidence: number;
      dataPoints: number;
      periodStart: Date;
      periodEnd: Date;
      profileData: Record<string, unknown> | null;
    }>;
    auditLog: Array<{
      action: string;
      memoryType: string | null;
      details: string | null;
      createdAt: Date;
    }>;
  };
  error?: string;
}

/**
 * Update diary entry visibility level
 */
export async function updateDiaryVisibility(
  entryId: string,
  visibilityLevel: VisibilityLevel
): Promise<UpdateVisibilityResult> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Not authenticated" };
    }

    // Verify entry belongs to user
    const entry = await db.diaryEntry.findUnique({
      where: { id: entryId },
    });

    if (!entry || entry.userId !== session.user.id) {
      return { success: false, error: "Entry not found" };
    }

    await db.diaryEntry.update({
      where: { id: entryId },
      data: { visibilityLevel },
    });

    revalidatePath("/diary");
    revalidatePath("/settings");

    return { success: true };
  } catch (error) {
    console.error("Error updating visibility:", error);
    return { success: false, error: "Failed to update visibility" };
  }
}

/**
 * Get diary entries with visibility info
 */
export async function getDiaryEntriesWithVisibility(
  limit: number = 30
): Promise<DiaryEntryVisibility[]> {
  try {
    const session = await auth();
    if (!session?.user?.id) return [];

    const entries = await db.diaryEntry.findMany({
      where: { userId: session.user.id },
      orderBy: { date: "desc" },
      take: limit,
      select: {
        id: true,
        date: true,
        visibilityLevel: true,
        aiUsedForTraining: true,
        aiUsedAt: true,
      },
    });

    return entries.map((e) => ({
      id: e.id,
      date: e.date,
      visibilityLevel: e.visibilityLevel as VisibilityLevel,
      aiUsedForTraining: e.aiUsedForTraining,
      aiUsedAt: e.aiUsedAt,
    }));
  } catch (error) {
    console.error("Error fetching diary visibility:", error);
    return [];
  }
}

/**
 * Get AI memory summary for current user
 */
export async function getMemorySummary(): Promise<MemorySummaryResult> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Not authenticated" };
    }

    const summary = await getAIMemorySummary(session.user.id);
    return { success: true, data: summary };
  } catch (error) {
    console.error("Error getting memory summary:", error);
    return { success: false, error: "Failed to get memory summary" };
  }
}

/**
 * Reset AI memory (all or specific type)
 */
export async function resetMemory(memoryType?: MemoryType): Promise<UpdateVisibilityResult> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Not authenticated" };
    }

    await resetAIMemory(session.user.id, memoryType);

    revalidatePath("/settings");

    return { success: true };
  } catch (error) {
    console.error("Error resetting memory:", error);
    return { success: false, error: "Failed to reset memory" };
  }
}

/**
 * Export AI memory data
 */
export async function exportMemoryData(): Promise<MemoryExportResult> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Not authenticated" };
    }

    const data = await exportAIMemoryData(session.user.id);
    return { success: true, data };
  } catch (error) {
    console.error("Error exporting memory:", error);
    return { success: false, error: "Failed to export memory data" };
  }
}

/**
 * Get AI memory context for prompts (for AI Coach integration)
 */
export async function getMemoryContext(): Promise<string> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return "No user session available.";
    }

    return await getAIMemoryContextForPrompt(session.user.id);
  } catch (error) {
    console.error("Error getting memory context:", error);
    return "Unable to retrieve AI memory.";
  }
}

/**
 * Bulk update visibility for multiple entries
 */
export async function bulkUpdateVisibility(
  entryIds: string[],
  visibilityLevel: VisibilityLevel
): Promise<UpdateVisibilityResult> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Not authenticated" };
    }

    // Verify all entries belong to user
    const entries = await db.diaryEntry.findMany({
      where: {
        id: { in: entryIds },
        userId: session.user.id,
      },
    });

    if (entries.length !== entryIds.length) {
      return { success: false, error: "Some entries not found" };
    }

    await db.diaryEntry.updateMany({
      where: {
        id: { in: entryIds },
        userId: session.user.id,
      },
      data: { visibilityLevel },
    });

    revalidatePath("/diary");
    revalidatePath("/settings");

    return { success: true };
  } catch (error) {
    console.error("Error bulk updating visibility:", error);
    return { success: false, error: "Failed to update visibility" };
  }
}

/**
 * Get visibility statistics for user
 */
export async function getVisibilityStats(): Promise<{
  total: number;
  fullAccess: number;
  metricsOnly: number;
  hidden: number;
  aiUsedCount: number;
}> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { total: 0, fullAccess: 0, metricsOnly: 0, hidden: 0, aiUsedCount: 0 };
    }

    const [total, fullAccess, metricsOnly, hidden, aiUsedCount] = await Promise.all([
      db.diaryEntry.count({ where: { userId: session.user.id } }),
      db.diaryEntry.count({ where: { userId: session.user.id, visibilityLevel: "FULL_AI_ACCESS" } }),
      db.diaryEntry.count({ where: { userId: session.user.id, visibilityLevel: "METRICS_ONLY" } }),
      db.diaryEntry.count({ where: { userId: session.user.id, visibilityLevel: "HIDDEN" } }),
      db.diaryEntry.count({ where: { userId: session.user.id, aiUsedForTraining: true } }),
    ]);

    return { total, fullAccess, metricsOnly, hidden, aiUsedCount };
  } catch (error) {
    console.error("Error getting visibility stats:", error);
    return { total: 0, fullAccess: 0, metricsOnly: 0, hidden: 0, aiUsedCount: 0 };
  }
}
