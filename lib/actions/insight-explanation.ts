"use server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { parseDateToLocalNoon } from "@/lib/utils";

export type InsightSourceType = "metric" | "diary" | "checkIn" | "workout";

export interface InsightExplanationSource {
  type: InsightSourceType;
  id: string;
  date: Date;
  snippet: string;
}

export interface InsightExplanationPayload {
  explanation: string;
  confidence: number;
  sources: InsightExplanationSource[];
}

function safeSnippetFromDiary(params: {
  visibilityLevel: string;
  mood: number | null;
  energy: number | null;
  sleepQual: number | null;
  soreness: number | null;
  stress: number | null;
  hasNotes: boolean;
}): string {
  const { mood, energy, sleepQual, soreness, stress, hasNotes } = params;
  const visibilityLevel =
    params.visibilityLevel === "FULL_AI_ACCESS" ||
    params.visibilityLevel === "METRICS_ONLY" ||
    params.visibilityLevel === "HIDDEN"
      ? (params.visibilityLevel as "FULL_AI_ACCESS" | "METRICS_ONLY" | "HIDDEN")
      : "HIDDEN";

  const parts: string[] = [];
  if (typeof mood === "number") parts.push(`mood=${mood}/5`);
  if (typeof energy === "number") parts.push(`energy=${energy}/5`);
  if (typeof sleepQual === "number") parts.push(`sleepQual=${sleepQual}/5`);
  if (typeof soreness === "number") parts.push(`soreness=${soreness}/5`);
  if (typeof stress === "number") parts.push(`stress=${stress}/5`);

  if (visibilityLevel === "FULL_AI_ACCESS") {
    return parts.length > 0
      ? `Diary metrics: ${parts.join(", ")}${hasNotes ? "; notes present" : ""}`
      : hasNotes
      ? "Diary entry: notes present"
      : "Diary entry"
  }

  if (visibilityLevel === "METRICS_ONLY") {
    return parts.length > 0 ? `Diary metrics: ${parts.join(", ")}` : "Diary entry (metrics only)";
  }

  return "";
}

export async function getDailyInsightExplanation(dateInput?: string): Promise<{
  success: boolean;
  error?: string;
  data?: InsightExplanationPayload;
}> {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: "Unauthorized" };

  const userId = session.user.id;
  const day = dateInput ? parseDateToLocalNoon(dateInput) : (() => {
    const d = new Date();
    d.setHours(12, 0, 0, 0);
    return d;
  })();

  const start = new Date(day);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);

  try {
    const insight = await db.dailyInsight.findFirst({
      where: { userId, date: day, dismissed: false },
      select: { insightText: true, insightType: true, driversJson: true },
    });

    if (!insight) return { success: false, error: "No insight found" };

    const sources: InsightExplanationSource[] = [];

    const metric = await db.metricDaily.findFirst({
      where: { userId, date: day },
      select: { id: true, date: true, readinessScore: true, readinessConfidence: true, complianceScore: true, burnoutRisk: true },
    });
    if (metric) {
      sources.push({
        type: "metric",
        id: metric.id,
        date: metric.date,
        snippet: `Metrics: readiness=${metric.readinessScore ?? "—"}, compliance=${metric.complianceScore ?? "—"}, burnout=${metric.burnoutRisk ?? "—"}`,
      });
    }

    const dailyCheckInDelegate = (db as unknown as {
      dailyCheckIn: {
        findFirst: (args: unknown) => Promise<
          | {
              id: string;
              date: Date;
              readinessScore: number | null;
              sleepDuration: number;
              sleepQuality: number;
              physicalFatigue: number;
              mentalReadiness: number;
              motivation: number;
            }
          | null
        >;
      };
    }).dailyCheckIn;

    const checkIn = await dailyCheckInDelegate.findFirst({
      where: { userId, date: { gte: start, lt: end } },
      select: { id: true, date: true, readinessScore: true, sleepDuration: true, sleepQuality: true, physicalFatigue: true, mentalReadiness: true, motivation: true },
    });
    if (checkIn) {
      sources.push({
        type: "checkIn",
        id: checkIn.id,
        date: checkIn.date,
        snippet: `Check-in: readiness=${checkIn.readinessScore ?? "—"}, sleep=${checkIn.sleepDuration}h (q=${checkIn.sleepQuality}/5), fatigue=${checkIn.physicalFatigue}/5, mental=${checkIn.mentalReadiness}/5, motivation=${checkIn.motivation}/5`,
      });
    }

    const diary = await db.diaryEntry.findFirst({
      where: { userId, date: day },
      select: {
        id: true,
        date: true,
        visibilityLevel: true,
        mood: true,
        energy: true,
        sleepQual: true,
        soreness: true,
        stress: true,
        notes: true,
      },
    });

    if (diary && diary.visibilityLevel !== "HIDDEN") {
      const snippet = safeSnippetFromDiary({
        visibilityLevel: diary.visibilityLevel,
        mood: diary.mood,
        energy: diary.energy,
        sleepQual: diary.sleepQual,
        soreness: diary.soreness,
        stress: diary.stress,
        hasNotes: !!diary.notes,
      });
      if (snippet) {
        sources.push({ type: "diary", id: diary.id, date: diary.date, snippet });
      }
    }

    const workout = await db.workout.findFirst({
      where: { userId, date: { gte: start, lt: end }, planned: true },
      select: { id: true, date: true, title: true, type: true },
    });
    if (workout) {
      sources.push({
        type: "workout",
        id: workout.id,
        date: workout.date,
        snippet: `Planned workout: ${workout.title} (${workout.type})`,
      });
    }

    let driverCount = 0;
    try {
      const parsed = insight.driversJson ? JSON.parse(insight.driversJson) : null;
      if (parsed && typeof parsed === "object") driverCount = Object.keys(parsed).length;
    } catch {
      driverCount = 0;
    }

    const confidence = Math.max(50, Math.min(90, 55 + driverCount * 10 + (metric?.readinessConfidence ? Math.round(metric.readinessConfidence / 10) : 0)));

    const explanation = `${insight.insightText} This insight was derived from today’s metrics and logged signals in the app.`;

    return {
      success: true,
      data: {
        explanation,
        confidence,
        sources,
      },
    };
  } catch (err) {
    console.error("[insight-explanation] failed:", err);
    return { success: false, error: "Failed to explain insight" };
  }
}
