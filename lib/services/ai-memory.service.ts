/**
 * AI Memory Aggregation Service
 * 
 * Builds long-term memory from diary entries with appropriate visibility levels.
 * Only learns from FULL_AI_ACCESS and METRICS_ONLY entries.
 * Stores aggregated insights, never raw text.
 */

import { db } from "@/lib/db";

// Types
export type VisibilityLevel = "FULL_AI_ACCESS" | "METRICS_ONLY" | "HIDDEN";
export type MemoryType = "PSYCHOLOGICAL" | "FATIGUE_RESPONSE" | "PREFERENCE" | "COMMUNICATION";

export interface PsychologicalProfile {
  motivationBaseline: number; // Average motivation (1-5)
  motivationVariance: number; // How much it fluctuates
  stressTolerance: number; // Average stress handling (1-5)
  stressRecoveryDays: number; // Days to recover from high stress
  moodStability: number; // How stable mood is (0-1)
  optimalMoodForTraining: number; // Best mood level for good sessions
}

export interface FatigueResponseProfile {
  recoveryRate: string; // FAST | NORMAL | SLOW
  fatigueThreshold: number; // Soreness level that impacts performance
  sleepSensitivity: number; // How much sleep affects performance (0-1)
  optimalSleepHours: number;
  energyPatterns: string; // MORNING_PERSON | EVENING_PERSON | CONSISTENT
}

export interface PreferenceProfile {
  preferredSessionTypes: string[];
  avoidedSessionTypes: string[];
  intensityPreference: string; // LOW | MODERATE | HIGH
  volumePreference: string; // LOW | MODERATE | HIGH
  varietyPreference: number; // 0-1 (0 = likes routine, 1 = likes variety)
}

export interface CommunicationProfile {
  explanationDepth: string; // BRIEF | MODERATE | DETAILED
  feedbackFrequency: string; // MINIMAL | REGULAR | FREQUENT
  motivationStyle: string; // DATA_DRIVEN | ENCOURAGING | CHALLENGING
  preferredTone: string; // CLINICAL | FRIENDLY | COACH_LIKE
}

export interface AIMemorySummary {
  psychological: PsychologicalProfile | null;
  fatigueResponse: FatigueResponseProfile | null;
  preference: PreferenceProfile | null;
  communication: CommunicationProfile | null;
  lastUpdated: Date | null;
  totalDataPoints: number;
  visibilityScore: number; // 0-100, how much data AI has access to
}

/**
 * Get diary entries that AI can learn from
 */
export async function getLearnableEntries(
  userId: string,
  startDate: Date,
  endDate: Date
): Promise<{
  fullAccess: Array<{
    date: Date;
    mood: number | null;
    stress: number | null;
    sleepQuality: number | null;
    motivation: number | null;
    energy: number | null;
    soreness: number | null;
    notes: string | null;
  }>;
  metricsOnly: Array<{
    date: Date;
    mood: number | null;
    stress: number | null;
    sleepQuality: number | null;
    motivation: number | null;
    energy: number | null;
    soreness: number | null;
  }>;
}> {
  const entries = await db.diaryEntry.findMany({
    where: {
      userId,
      date: { gte: startDate, lte: endDate },
      visibilityLevel: { in: ["FULL_AI_ACCESS", "METRICS_ONLY"] },
    },
    orderBy: { date: "asc" },
  });

  const fullAccess = entries
    .filter((e) => e.visibilityLevel === "FULL_AI_ACCESS")
    .map((e) => ({
      date: e.date,
      mood: e.mood,
      stress: e.stress,
      sleepQuality: e.sleepQual,
      motivation: e.motivation,
      energy: e.energy,
      soreness: e.soreness,
      notes: e.notes,
    }));

  const metricsOnly = entries
    .filter((e) => e.visibilityLevel === "METRICS_ONLY")
    .map((e) => ({
      date: e.date,
      mood: e.mood,
      stress: e.stress,
      sleepQuality: e.sleepQual,
      motivation: e.motivation,
      energy: e.energy,
      soreness: e.soreness,
    }));

  return { fullAccess, metricsOnly };
}

/**
 * Calculate psychological profile from diary data
 */
export function calculatePsychologicalProfile(
  entries: Array<{
    mood: number | null;
    stress: number | null;
    motivation: number | null;
  }>
): PsychologicalProfile | null {
  const validEntries = entries.filter(
    (e) => e.mood !== null && e.stress !== null && e.motivation !== null
  );

  if (validEntries.length < 7) return null; // Need at least a week of data

  const moods = validEntries.map((e) => e.mood!);
  const stresses = validEntries.map((e) => e.stress!);
  const motivations = validEntries.map((e) => e.motivation!);

  const avg = (arr: number[]) => arr.reduce((a, b) => a + b, 0) / arr.length;
  const variance = (arr: number[]) => {
    const mean = avg(arr);
    return arr.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / arr.length;
  };

  // Calculate stress recovery (days after high stress to return to baseline)
  let stressRecoveryDays = 2;
  const avgStress = avg(stresses);
  for (let i = 0; i < stresses.length - 1; i++) {
    if (stresses[i] >= 4) {
      let recoveryDays = 0;
      for (let j = i + 1; j < stresses.length && stresses[j] > avgStress; j++) {
        recoveryDays++;
      }
      stressRecoveryDays = Math.max(stressRecoveryDays, recoveryDays);
    }
  }

  return {
    motivationBaseline: Math.round(avg(motivations) * 10) / 10,
    motivationVariance: Math.round(variance(motivations) * 100) / 100,
    stressTolerance: Math.round((5 - avg(stresses) + 1) * 10) / 10, // Inverse: low stress = high tolerance
    stressRecoveryDays,
    moodStability: Math.round((1 - variance(moods) / 4) * 100) / 100, // Normalize to 0-1
    optimalMoodForTraining: Math.round(avg(moods.filter((m) => m >= 3)) * 10) / 10 || 4,
  };
}

/**
 * Calculate fatigue response profile
 */
export function calculateFatigueResponseProfile(
  entries: Array<{
    energy: number | null;
    soreness: number | null;
    sleepQuality: number | null;
  }>,
  sleepHours: number[]
): FatigueResponseProfile | null {
  const validEntries = entries.filter(
    (e) => e.energy !== null && e.soreness !== null
  );

  if (validEntries.length < 7) return null;

  const energies = validEntries.map((e) => e.energy!);
  const sorenesses = validEntries.map((e) => e.soreness!);
  const sleepQualities = entries.filter((e) => e.sleepQuality !== null).map((e) => e.sleepQuality!);

  const avg = (arr: number[]) => arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;

  // Calculate recovery rate based on energy bounce-back
  let recoveryRate: "FAST" | "NORMAL" | "SLOW" = "NORMAL";
  let lowEnergyRecoveryDays = 0;
  let lowEnergyCount = 0;
  
  for (let i = 0; i < energies.length - 1; i++) {
    if (energies[i] <= 2) {
      lowEnergyCount++;
      let days = 0;
      for (let j = i + 1; j < energies.length && energies[j] < 4; j++) {
        days++;
      }
      lowEnergyRecoveryDays += days;
    }
  }

  if (lowEnergyCount > 0) {
    const avgRecovery = lowEnergyRecoveryDays / lowEnergyCount;
    if (avgRecovery <= 1) recoveryRate = "FAST";
    else if (avgRecovery >= 3) recoveryRate = "SLOW";
  }

  // Sleep sensitivity: correlation between sleep quality and next-day energy
  let sleepSensitivity = 0.5;
  if (sleepQualities.length > 0 && energies.length > 1) {
    let correlationSum = 0;
    let count = 0;
    for (let i = 0; i < Math.min(sleepQualities.length, energies.length - 1); i++) {
      correlationSum += (sleepQualities[i] - 3) * (energies[i + 1] - 3);
      count++;
    }
    sleepSensitivity = count > 0 ? Math.min(1, Math.max(0, 0.5 + correlationSum / (count * 4))) : 0.5;
  }

  // Energy patterns
  let energyPatterns: "MORNING_PERSON" | "EVENING_PERSON" | "CONSISTENT" = "CONSISTENT";
  const energyVariance = energies.reduce((sum, e) => sum + Math.pow(e - avg(energies), 2), 0) / energies.length;
  if (energyVariance < 0.5) {
    energyPatterns = "CONSISTENT";
  }

  return {
    recoveryRate,
    fatigueThreshold: Math.round(avg(sorenesses.filter((s) => s >= 3)) * 10) / 10 || 3,
    sleepSensitivity: Math.round(sleepSensitivity * 100) / 100,
    optimalSleepHours: sleepHours.length > 0 ? Math.round(avg(sleepHours) * 10) / 10 : 7.5,
    energyPatterns,
  };
}

/**
 * Calculate preference profile from feedback and diary patterns
 */
export function calculatePreferenceProfile(
  workoutFeedback: Array<{
    workoutType: string;
    enjoyment: number;
    perceivedDifficulty: string;
  }>
): PreferenceProfile | null {
  if (workoutFeedback.length < 5) return null;

  // Group by workout type
  const typeStats: Record<string, { enjoyment: number[]; difficulty: string[] }> = {};
  
  for (const fb of workoutFeedback) {
    if (!typeStats[fb.workoutType]) {
      typeStats[fb.workoutType] = { enjoyment: [], difficulty: [] };
    }
    typeStats[fb.workoutType].enjoyment.push(fb.enjoyment);
    typeStats[fb.workoutType].difficulty.push(fb.perceivedDifficulty);
  }

  const avg = (arr: number[]) => arr.reduce((a, b) => a + b, 0) / arr.length;

  const preferred: string[] = [];
  const avoided: string[] = [];

  for (const [type, stats] of Object.entries(typeStats)) {
    const avgEnjoyment = avg(stats.enjoyment);
    if (avgEnjoyment >= 4) preferred.push(type);
    else if (avgEnjoyment <= 2) avoided.push(type);
  }

  // Intensity preference based on difficulty feedback
  const allDifficulties = workoutFeedback.map((f) => f.perceivedDifficulty);
  const hardCount = allDifficulties.filter((d) => d === "HARD" || d === "BRUTAL").length;
  const easyCount = allDifficulties.filter((d) => d === "EASY").length;
  
  let intensityPreference: "LOW" | "MODERATE" | "HIGH" = "MODERATE";
  if (hardCount > workoutFeedback.length * 0.4) intensityPreference = "LOW";
  else if (easyCount > workoutFeedback.length * 0.4) intensityPreference = "HIGH";

  // Variety preference based on unique workout types
  const uniqueTypes = new Set(workoutFeedback.map((f) => f.workoutType)).size;
  const varietyPreference = Math.min(1, uniqueTypes / 5);

  return {
    preferredSessionTypes: preferred,
    avoidedSessionTypes: avoided,
    intensityPreference,
    volumePreference: "MODERATE", // Would need duration data to calculate
    varietyPreference: Math.round(varietyPreference * 100) / 100,
  };
}

/**
 * Aggregate and store AI memory
 */
export async function aggregateAndStoreMemory(
  userId: string,
  memoryType: MemoryType,
  title: string,
  summary: string,
  profileData: Record<string, unknown>,
  dataPoints: number,
  periodStart: Date,
  periodEnd: Date
): Promise<string> {
  // Check for existing memory of this type
  const existing = await db.aIMemory.findFirst({
    where: {
      userId,
      memoryType,
      supersededBy: null, // Only active memories
    },
    orderBy: { createdAt: "desc" },
  });

  // Create new memory
  const newMemory = await db.aIMemory.create({
    data: {
      userId,
      memoryType,
      title,
      summary,
      profileDataJson: JSON.stringify(profileData),
      dataPoints,
      confidence: Math.min(100, Math.round(dataPoints * 3)), // More data = more confidence
      periodStart,
      periodEnd,
      version: existing ? existing.version + 1 : 1,
    },
  });

  // Mark old memory as superseded
  if (existing) {
    await db.aIMemory.update({
      where: { id: existing.id },
      data: { supersededBy: newMemory.id },
    });
  }

  // Create audit log
  await db.aIMemoryAudit.create({
    data: {
      userId,
      action: existing ? "UPDATED" : "CREATED",
      memoryType,
      details: `${title} - ${dataPoints} data points`,
    },
  });

  return newMemory.id;
}

/**
 * Get AI memory summary for a user
 */
export async function getAIMemorySummary(userId: string): Promise<AIMemorySummary> {
  const memories = await db.aIMemory.findMany({
    where: {
      userId,
      supersededBy: null, // Only active memories
    },
  });

  // Count total diary entries and visible ones
  const totalEntries = await db.diaryEntry.count({ where: { userId } });
  const visibleEntries = await db.diaryEntry.count({
    where: {
      userId,
      visibilityLevel: { in: ["FULL_AI_ACCESS", "METRICS_ONLY"] },
    },
  });

  const visibilityScore = totalEntries > 0 ? Math.round((visibleEntries / totalEntries) * 100) : 0;

  let psychological: PsychologicalProfile | null = null;
  let fatigueResponse: FatigueResponseProfile | null = null;
  let preference: PreferenceProfile | null = null;
  let communication: CommunicationProfile | null = null;
  let lastUpdated: Date | null = null;
  let totalDataPoints = 0;

  for (const memory of memories) {
    totalDataPoints += memory.dataPoints;
    if (!lastUpdated || memory.updatedAt > lastUpdated) {
      lastUpdated = memory.updatedAt;
    }

    const profileData = memory.profileDataJson ? JSON.parse(memory.profileDataJson) : null;

    switch (memory.memoryType) {
      case "PSYCHOLOGICAL":
        psychological = profileData as PsychologicalProfile;
        break;
      case "FATIGUE_RESPONSE":
        fatigueResponse = profileData as FatigueResponseProfile;
        break;
      case "PREFERENCE":
        preference = profileData as PreferenceProfile;
        break;
      case "COMMUNICATION":
        communication = profileData as CommunicationProfile;
        break;
    }
  }

  return {
    psychological,
    fatigueResponse,
    preference,
    communication,
    lastUpdated,
    totalDataPoints,
    visibilityScore,
  };
}

/**
 * Reset all AI memories for a user
 */
export async function resetAIMemory(userId: string, memoryType?: MemoryType): Promise<void> {
  const where = memoryType
    ? { userId, memoryType }
    : { userId };

  await db.aIMemory.deleteMany({ where });

  await db.aIMemoryAudit.create({
    data: {
      userId,
      action: "RESET",
      memoryType: memoryType || "ALL",
      details: memoryType ? `Reset ${memoryType} memory` : "Reset all AI memories",
    },
  });
}

/**
 * Export AI memory data for user
 */
export async function exportAIMemoryData(userId: string): Promise<{
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
}> {
  const memories = await db.aIMemory.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });

  const auditLog = await db.aIMemoryAudit.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  // Log export action
  await db.aIMemoryAudit.create({
    data: {
      userId,
      action: "EXPORTED",
      details: `Exported ${memories.length} memories`,
    },
  });

  return {
    memories: memories.map((m) => ({
      type: m.memoryType,
      title: m.title,
      summary: m.summary,
      confidence: m.confidence,
      dataPoints: m.dataPoints,
      periodStart: m.periodStart,
      periodEnd: m.periodEnd,
      profileData: m.profileDataJson ? JSON.parse(m.profileDataJson) : null,
    })),
    auditLog: auditLog.map((a) => ({
      action: a.action,
      memoryType: a.memoryType,
      details: a.details,
      createdAt: a.createdAt,
    })),
  };
}

/**
 * Get AI memory context for prompts (respects visibility)
 */
export async function getAIMemoryContextForPrompt(userId: string): Promise<string> {
  const summary = await getAIMemorySummary(userId);

  if (summary.totalDataPoints === 0) {
    return "No AI memory available yet. Rely on objective training data.";
  }

  let context = `## AI Memory Profile (${summary.totalDataPoints} data points, ${summary.visibilityScore}% visibility)\n\n`;

  if (summary.psychological) {
    const p = summary.psychological;
    context += `### Psychological Profile\n`;
    context += `- Motivation baseline: ${p.motivationBaseline}/5\n`;
    context += `- Stress tolerance: ${p.stressTolerance}/5\n`;
    context += `- Mood stability: ${Math.round(p.moodStability * 100)}%\n`;
    context += `- Stress recovery: ~${p.stressRecoveryDays} days\n\n`;
  }

  if (summary.fatigueResponse) {
    const f = summary.fatigueResponse;
    context += `### Fatigue Response\n`;
    context += `- Recovery rate: ${f.recoveryRate}\n`;
    context += `- Sleep sensitivity: ${Math.round(f.sleepSensitivity * 100)}%\n`;
    context += `- Optimal sleep: ${f.optimalSleepHours}h\n`;
    context += `- Energy pattern: ${f.energyPatterns}\n\n`;
  }

  if (summary.preference) {
    const pr = summary.preference;
    context += `### Training Preferences\n`;
    if (pr.preferredSessionTypes.length > 0) {
      context += `- Enjoys: ${pr.preferredSessionTypes.join(", ")}\n`;
    }
    if (pr.avoidedSessionTypes.length > 0) {
      context += `- Struggles with: ${pr.avoidedSessionTypes.join(", ")}\n`;
    }
    context += `- Intensity preference: ${pr.intensityPreference}\n`;
    context += `- Variety preference: ${Math.round(pr.varietyPreference * 100)}%\n\n`;
  }

  if (summary.visibilityScore < 50) {
    context += `\n**Note:** Limited diary visibility (${summary.visibilityScore}%). Rely more on objective metrics and ask clarifying questions.\n`;
  }

  return context;
}
