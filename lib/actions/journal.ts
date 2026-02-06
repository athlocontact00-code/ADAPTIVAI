"use server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { addDays } from "@/lib/utils";
import {
  detectAllPatterns,
  analyzeCorrelations,
  compareLast14Days,
  JournalEntry,
  MetricEntry,
  VisibilityLevel,
} from "@/lib/services/journal.service";

// ============================================
// JOURNAL ENTRY ACTIONS
// ============================================

export async function getJournalEntries(days = 14) {
  const session = await auth();
  if (!session?.user?.id) return [];

  const startDate = addDays(new Date(), -days);

  return db.diaryEntry.findMany({
    where: {
      userId: session.user.id,
      date: { gte: startDate },
    },
    orderBy: { date: "desc" },
  });
}

export async function getJournalEntry(date: Date) {
  const session = await auth();
  if (!session?.user?.id) return null;

  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);

  return db.diaryEntry.findFirst({
    where: {
      userId: session.user.id,
      date: { gte: startOfDay, lte: endOfDay },
    },
  });
}

export async function saveJournalEntry(
  date: Date,
  data: {
    mood?: number;
    energy?: number;
    sleepHrs?: number;
    sleepQual?: number;
    stress?: number;
    soreness?: number;
    motivation?: number;
    notes?: string;
    visibilityLevel?: VisibilityLevel;
  }
): Promise<{ success: boolean; entry?: any; error?: string }> {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: "Unauthorized" };

  const userId = session.user.id;

  try {
    const entryDate = new Date(date);
    entryDate.setHours(12, 0, 0, 0);

    const entry = await db.diaryEntry.upsert({
      where: { userId_date: { userId, date: entryDate } },
      create: {
        userId,
        date: entryDate,
        mood: data.mood,
        energy: data.energy,
        sleepHrs: data.sleepHrs,
        sleepQual: data.sleepQual,
        stress: data.stress,
        soreness: data.soreness,
        motivation: data.motivation,
        notes: data.notes,
        visibilityLevel: data.visibilityLevel ?? "FULL_AI_ACCESS",
      } as any,
      update: {
        mood: data.mood,
        energy: data.energy,
        sleepHrs: data.sleepHrs,
        sleepQual: data.sleepQual,
        stress: data.stress,
        soreness: data.soreness,
        motivation: data.motivation,
        notes: data.notes,
        visibilityLevel: data.visibilityLevel,
      } as any,
    });

    return { success: true, entry };
  } catch (error) {
    console.error("Error saving journal entry:", error);
    return { success: false, error: "Failed to save entry" };
  }
}

export async function updateAIAccessLevel(
  entryId: string,
  visibilityLevel: VisibilityLevel
): Promise<{ success: boolean; error?: string }> {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: "Unauthorized" };

  try {
    await db.diaryEntry.update({
      where: { id: entryId, userId: session.user.id },
      data: { visibilityLevel } as any,
    });

    return { success: true };
  } catch (error) {
    return { success: false, error: "Failed to update access level" };
  }
}

export async function markEntryUsedByAI(entryId: string): Promise<void> {
  const session = await auth();
  if (!session?.user?.id) return;

  await db.diaryEntry.update({
    where: { id: entryId, userId: session.user.id },
    data: {
      aiUsedForTraining: true,
      aiUsedAt: new Date(),
    } as any,
  });
}

// ============================================
// PATTERN DETECTION ACTIONS
// ============================================

export async function detectJournalPatterns() {
  const session = await auth();
  if (!session?.user?.id) return { insights: [], newInsights: [] };

  const userId = session.user.id;

  // Get recent journal entries
  const entries = await db.diaryEntry.findMany({
    where: {
      userId,
      date: { gte: addDays(new Date(), -14) },
    },
    orderBy: { date: "desc" },
  });

  // Convert to service format
  const journalEntries: JournalEntry[] = entries.map((e) => ({
    id: e.id,
    date: e.date,
    mood: e.mood,
    energy: e.energy,
    sleepHrs: e.sleepHrs,
    sleepQual: e.sleepQual,
    stress: e.stress,
    soreness: e.soreness,
    motivation: (e as any).motivation,
    notes: e.notes,
    visibilityLevel: (e as any).visibilityLevel as VisibilityLevel,
  }));

  // Detect patterns
  const detectedInsights = detectAllPatterns(journalEntries);

  // Get existing insights to avoid duplicates
  const existingInsights = await (db as any).journalInsight.findMany({
    where: {
      userId,
      dismissed: false,
      createdAt: { gte: addDays(new Date(), -7) },
    },
  });

  const existingTypes = new Set(existingInsights.map((i: { type: string }) => i.type));

  // Create new insights
  const newInsights = [];
  for (const insight of detectedInsights) {
    if (!existingTypes.has(insight.type)) {
      const created = await (db as any).journalInsight.create({
        data: {
          userId,
          type: insight.type,
          severity: insight.severity,
          title: insight.title,
          message: insight.message,
          suggestion: insight.suggestion,
          startDate: insight.startDate,
          endDate: insight.endDate,
          dataPointsJson: JSON.stringify(insight.dataPoints),
        },
      });
      newInsights.push(created);
    }
  }

  // Get all active insights
  const allInsights = await (db as any).journalInsight.findMany({
    where: {
      userId,
      dismissed: false,
    },
    orderBy: { createdAt: "desc" },
    take: 5,
  });

  return { insights: allInsights, newInsights };
}

export async function dismissInsight(insightId: string): Promise<{ success: boolean }> {
  const session = await auth();
  if (!session?.user?.id) return { success: false };

  await (db as any).journalInsight.update({
    where: { id: insightId, userId: session.user.id },
    data: { dismissed: true },
  });

  return { success: true };
}

export async function acknowledgeInsight(insightId: string): Promise<{ success: boolean }> {
  const session = await auth();
  if (!session?.user?.id) return { success: false };

  await (db as any).journalInsight.update({
    where: { id: insightId, userId: session.user.id },
    data: { acknowledged: true },
  });

  return { success: true };
}

// ============================================
// CORRELATION & COMPARISON ACTIONS
// ============================================

export async function getJournalCorrelations() {
  const session = await auth();
  if (!session?.user?.id) return [];

  const userId = session.user.id;

  // Get journal entries
  const entries = await db.diaryEntry.findMany({
    where: {
      userId,
      date: { gte: addDays(new Date(), -30) },
    },
    orderBy: { date: "desc" },
  });

  // Get metrics
  const metrics = await db.metricDaily.findMany({
    where: {
      userId,
      date: { gte: addDays(new Date(), -30) },
    },
    orderBy: { date: "desc" },
  });

  // Convert to service format
  const journalEntries: JournalEntry[] = entries.map((e) => ({
    id: e.id,
    date: e.date,
    mood: e.mood,
    energy: e.energy,
    sleepHrs: e.sleepHrs,
    sleepQual: e.sleepQual,
    stress: e.stress,
    soreness: e.soreness,
    motivation: (e as any).motivation,
    notes: e.notes,
    visibilityLevel: (e as any).visibilityLevel as VisibilityLevel,
  }));

  const metricEntries: MetricEntry[] = metrics.map((m) => ({
    date: m.date,
    tss: m.tss,
    ctl: m.ctl,
    atl: m.atl,
    tsb: m.tsb,
    readinessScore: (m as any).readinessScore,
  }));

  return analyzeCorrelations(journalEntries, metricEntries);
}

export async function get14DayComparison() {
  const session = await auth();
  if (!session?.user?.id) return [];

  const entries = await db.diaryEntry.findMany({
    where: {
      userId: session.user.id,
      date: { gte: addDays(new Date(), -14) },
    },
    orderBy: { date: "desc" },
  });

  const journalEntries: JournalEntry[] = entries.map((e) => ({
    id: e.id,
    date: e.date,
    mood: e.mood,
    energy: e.energy,
    sleepHrs: e.sleepHrs,
    sleepQual: e.sleepQual,
    stress: e.stress,
    soreness: e.soreness,
    motivation: (e as any).motivation,
    notes: e.notes,
    visibilityLevel: (e as any).visibilityLevel as VisibilityLevel,
  }));

  return compareLast14Days(journalEntries);
}

// ============================================
// AI CONTEXT HELPERS
// ============================================

export async function getJournalContextForAI() {
  const session = await auth();
  if (!session?.user?.id) return null;

  const userId = session.user.id;

  // Get recent entries that AI can access
  const entries = await db.diaryEntry.findMany({
    where: {
      userId,
      date: { gte: addDays(new Date(), -7) },
      visibilityLevel: { in: ["FULL_AI_ACCESS", "METRICS_ONLY"] },
    } as any,
    orderBy: { date: "desc" },
  });

  // Mark entries as used by AI
  for (const entry of entries) {
    if (!(entry as any).aiUsedForTraining) {
      await db.diaryEntry.update({
        where: { id: entry.id },
        data: {
          aiUsedForTraining: true,
          aiUsedAt: new Date(),
        } as any,
      });
    }
  }

  // Build context based on access level
  const context = entries.map((e) => {
    if ((e as any).visibilityLevel === "METRICS_ONLY") {
      return {
        date: e.date,
        mood: e.mood,
        energy: e.energy,
        stress: e.stress,
        sleepQual: e.sleepQual,
        motivation: (e as any).motivation,
        // No notes
      };
    }
    return {
      date: e.date,
      mood: e.mood,
      energy: e.energy,
      stress: e.stress,
      sleepQual: e.sleepQual,
      motivation: (e as any).motivation,
      notes: e.notes,
    };
  });

  // Get active insights
  const insights = await (db as any).journalInsight.findMany({
    where: {
      userId,
      dismissed: false,
    },
    orderBy: { createdAt: "desc" },
    take: 3,
  });

  return {
    recentEntries: context,
    activeInsights: insights.map((i: { type: string; severity: string; message: string }) => ({
      type: i.type,
      severity: i.severity,
      message: i.message,
    })),
  };
}
