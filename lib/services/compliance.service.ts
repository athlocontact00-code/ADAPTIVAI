/**
 * Compliance Service
 * Tracks workout completion rates, streaks, and training consistency.
 */

import { getDateKey } from "@/lib/utils";

export type ComplianceStatus = "STRONG" | "SLIPPING" | "FRAGILE";

export interface ComplianceReason {
  reason: string;
  impact: number;
}

export interface ComplianceResult {
  score: number; // 0-100
  status: ComplianceStatus;
  reasons: ComplianceReason[];
  plannedWorkouts: number;
  completedWorkouts: number;
  completionRate: number; // percentage
  currentStreak: number; // days
  missedKeySessionsCount: number;
}

export interface WorkoutData {
  date: Date;
  planned: boolean;
  completed: boolean;
  type: string;
  tss?: number | null;
  aiGenerated?: boolean;
}

/**
 * Compute compliance metrics from workout history
 */
export function computeCompliance(
  workouts: WorkoutData[],
  lookbackDays: number = 14
): ComplianceResult {
  const now = new Date();
  now.setHours(23, 59, 59, 999);
  
  const cutoffDate = new Date(now);
  cutoffDate.setDate(cutoffDate.getDate() - lookbackDays);
  cutoffDate.setHours(0, 0, 0, 0);

  // Filter to lookback period
  const recentWorkouts = workouts.filter((w) => {
    const wDate = new Date(w.date);
    return wDate >= cutoffDate && wDate <= now;
  });

  // Count planned vs completed
  const plannedWorkouts = recentWorkouts.filter((w) => w.planned || w.completed).length;
  const completedWorkouts = recentWorkouts.filter((w) => w.completed).length;
  const completionRate = plannedWorkouts > 0 ? (completedWorkouts / plannedWorkouts) * 100 : 100;

  // Calculate current streak
  const currentStreak = calculateStreak(workouts);

  // Check for missed key sessions (high TSS or intervals)
  const missedKeySessionsCount = recentWorkouts.filter(
    (w) => w.planned && !w.completed && ((w.tss && w.tss > 60) || w.type === "intervals")
  ).length;

  // Calculate compliance score
  const reasons: ComplianceReason[] = [];
  let score = 50; // Base score

  // Completion rate impact (major factor)
  if (completionRate >= 90) {
    score += 30;
    reasons.push({ reason: "Excellent completion rate", impact: 30 });
  } else if (completionRate >= 75) {
    score += 20;
    reasons.push({ reason: "Good completion rate", impact: 20 });
  } else if (completionRate >= 50) {
    score += 5;
    reasons.push({ reason: "Moderate completion rate", impact: 5 });
  } else if (completionRate < 50) {
    score -= 15;
    reasons.push({ reason: "Low completion rate", impact: -15 });
  }

  // Streak impact
  if (currentStreak >= 7) {
    score += 15;
    reasons.push({ reason: `Strong ${currentStreak}-day streak`, impact: 15 });
  } else if (currentStreak >= 3) {
    score += 8;
    reasons.push({ reason: `${currentStreak}-day streak building`, impact: 8 });
  } else if (currentStreak === 0) {
    score -= 5;
    reasons.push({ reason: "No recent training streak", impact: -5 });
  }

  // Missed key sessions impact
  if (missedKeySessionsCount === 0) {
    score += 5;
    reasons.push({ reason: "All key sessions completed", impact: 5 });
  } else if (missedKeySessionsCount >= 2) {
    score -= 10;
    reasons.push({ reason: `Missed ${missedKeySessionsCount} key sessions`, impact: -10 });
  } else {
    score -= 5;
    reasons.push({ reason: "Missed 1 key session", impact: -5 });
  }

  // Clamp score
  score = Math.max(0, Math.min(100, score));

  // Determine status
  let status: ComplianceStatus;
  if (score >= 70) {
    status = "STRONG";
  } else if (score >= 45) {
    status = "SLIPPING";
  } else {
    status = "FRAGILE";
  }

  // Sort reasons by absolute impact
  reasons.sort((a, b) => Math.abs(b.impact) - Math.abs(a.impact));

  return {
    score,
    status,
    reasons: reasons.slice(0, 3),
    plannedWorkouts,
    completedWorkouts,
    completionRate: Math.round(completionRate),
    currentStreak,
    missedKeySessionsCount,
  };
}

/**
 * Calculate current training streak (consecutive days with completed workouts)
 */
function calculateStreak(workouts: WorkoutData[]): number {
  const completedDates = new Set<string>();
  
  workouts
    .filter((w) => w.completed)
    .forEach((w) => {
      const d = new Date(w.date);
      completedDates.add(getDateKey(d));
    });

  if (completedDates.size === 0) return 0;

  let streak = 0;
  const today = new Date();
  today.setHours(12, 0, 0, 0);

  // Start from today and go backwards
  const checkDate = new Date(today);
  
  // If no workout today, start from yesterday
  if (!completedDates.has(getDateKey(checkDate))) {
    checkDate.setDate(checkDate.getDate() - 1);
  }

  while (completedDates.has(getDateKey(checkDate))) {
    streak++;
    checkDate.setDate(checkDate.getDate() - 1);
  }

  return streak;
}

/**
 * Format compliance reasons as JSON for storage
 */
export function formatComplianceReasonsJson(reasons: ComplianceReason[]): string {
  const obj: Record<string, number> = {};
  for (const r of reasons.slice(0, 3)) {
    obj[r.reason] = r.impact;
  }
  return JSON.stringify(obj);
}

/**
 * Get compliance status color
 */
export function getComplianceColor(status: ComplianceStatus): string {
  switch (status) {
    case "STRONG":
      return "green";
    case "SLIPPING":
      return "yellow";
    case "FRAGILE":
      return "red";
  }
}

/**
 * Get coaching nudge based on compliance
 */
export function getComplianceNudge(
  result: ComplianceResult,
  identityMode: string
): string | null {
  // Only generate nudge if there's something notable
  if (result.status === "STRONG" && result.currentStreak >= 5) {
    if (identityMode === "competitive") {
      return "Consistency on point. Keep the momentum—today's easy effort fuels tomorrow's gains.";
    } else if (identityMode === "longevity") {
      return "Your consistency is building lasting fitness. Stay patient, stay consistent.";
    } else if (identityMode === "busy_pro") {
      return "Great rhythm maintained. Short sessions, big results over time.";
    }
    return "You're consistent—keep it easy today to protect tomorrow's quality.";
  }

  if (result.status === "SLIPPING") {
    if (result.missedKeySessionsCount >= 2) {
      return "You've skipped a few sessions—let's simplify the week to rebuild momentum.";
    }
    return "A couple missed workouts is okay. Let's focus on getting back on track today.";
  }

  if (result.status === "FRAGILE") {
    if (identityMode === "comeback") {
      return "Life happens. Let's reset with something light and enjoyable today.";
    }
    return "Training took a backseat lately. Let's start fresh with one small win today.";
  }

  return null;
}
