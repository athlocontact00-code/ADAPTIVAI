import { db } from "@/lib/db";
import { isWorkoutLocked, type PlanRigiditySetting } from "@/lib/services/plan-rigidity.service";
import { addDays, formatLocalDateInput } from "@/lib/utils";

export const AI_CONTEXT_VERSION = "2026-02-02.v1" as const;
export type AIContextVersion = typeof AI_CONTEXT_VERSION;

export type AIContextDiaryVisibility = "FULL_AI_ACCESS" | "METRICS_ONLY" | "HIDDEN";

export type AIContext = {
  contextVersion: AIContextVersion;
  generatedAt: string;
  userProfile: {
    userId: string;
    name: string | null;
    tonePreference: string | null;
    explainLevel: string | null;
    identityMode: string | null;
    ageYears: number | null;
    weightKg: number | null;
    heightCm: number | null;
    sportPrimary: string | null;
    experienceLevel: string | null;
    planRigidity: string | null;
    equipmentNotes: string | null;
    terrainNotes: string | null;
    availabilityNotes: string | null;
    swimPoolLengthM: number | null;
    club: string | null;
    location: string | null;
    timezone: string | null;
    birthYear: number | null;
    availability: Record<string, unknown> | null;
    preferences: Record<string, unknown> | null;
    guardrails: Record<string, unknown> | null;
  };
  zones: {
    hr: {
      restingHR: number | null;
      maxHR: number | null;
      z1: { min: number | null; max: number | null };
      z2: { min: number | null; max: number | null };
      z3: { min: number | null; max: number | null };
      z4: { min: number | null; max: number | null };
      z5: { min: number | null; max: number | null };
    };
    power: { ftp: number | null };
  };
  pbs: Array<{
    id: string;
    sport: string;
    discipline: string;
    valueNumber: number;
    valueUnit: string;
    date: string;
    source: string;
  }>;
  goals: {
    weeklyHoursGoal: number | null;
    seasonGoal: string | null;
    upcomingRaces: Array<{ id: string; name: string; date: string; priority: string; goalTime: string | null }>;
  };
  planSummary: {
    today: string;
    activeSeason: { id: string; name: string; startDate: string; endDate: string } | null;
    activeBlock: { id: string; type: string; focus: string | null; startDate: string; endDate: string } | null;
    keySessionsNext7d: Array<{
      id: string;
      date: string;
      title: string;
      type: string;
      tss: number | null;
      durationMin: number | null;
      isPlanned: boolean;
    }>;
  };
  todayCheckin: {
    status: "pending" | "completed" | "required";
    privacyMode: AIContextDiaryVisibility;
    planLocked: boolean;
    data: {
      readinessScore: number;
      topFactor: string;
      recommendation: string;
      sleepQuality: number;
      fatigue: number;
      motivation: number;
      soreness: number;
      stress: number;
      hasConflict: boolean;
      conflictReason: string | null;
    } | null;
  };
  recentSignals: {
    checkIns7d: {
      window: { start: string; endExclusive: string };
      items: Array<{
        date: string;
        readinessScore: number | null;
        sleepDuration: number | null;
        sleepQuality: number | null;
        physicalFatigue: number | null;
        mentalReadiness: number | null;
        motivation: number | null;
        stressLevel: number | null;
        aiDecision: string | null;
        aiConfidence: number | null;
        notesPresent: boolean;
      }>;
    };
    feedbackPatterns14d: {
      window: { start: string; endExclusive: string };
      totalFeedback: number;
      avgEnjoyment: number | null;
      avgMentalState: number | null;
      perceivedDifficultyCounts: Record<string, number>;
      vsPlannedCounts: Record<string, number>;
      painOrDiscomfortCount: number;
      commentCount: number;
    };
    diarySignals7d: {
      window: { start: string; endExclusive: string };
      includedCount: number;
      excludedHiddenCount: number;
      items: Array<{
        date: string;
        visibility: AIContextDiaryVisibility;
        mood: number | null;
        energy: number | null;
        sleepHrs: number | null;
        sleepQual: number | null;
        stress: number | null;
        soreness: number | null;
        motivation: number | null;
        notesPresent: boolean;
      }>;
    };
    metrics14d: {
      window: { start: string; endExclusive: string };
      latest: {
        date: string;
        readinessScore: number | null;
        complianceScore: number | null;
        burnoutRisk: number | null;
        ctl: number | null;
        atl: number | null;
        tsb: number | null;
      } | null;
    };
  };
  recentTraining: {
    completedWorkouts14d: {
      window: { start: string; endExclusive: string };
      count: number;
      totalDurationMin: number;
      totalTss: number;
      byTypeCounts: Record<string, number>;
      items: Array<{
        date: string;
        title: string;
        type: string;
        durationMin: number | null;
        tss: number | null;
        planned: boolean;
        aiGenerated: boolean;
      }>;
    };
  };
  privacySummary: {
    diary: {
      policy: "NO_RAW_DIARY_TEXT";
      fullAiAccess: "METRICS_AND_NOTES_PRESENT_ONLY";
      metricsOnly: "METRICS_ONLY";
      hidden: "EXCLUDED";
    };
    checkIns: {
      policy: "NO_RAW_CHECKIN_NOTES";
    };
    feedback: {
      policy: "NO_RAW_FEEDBACK_COMMENT";
    };
    verification: {
      verifier: "assertAIContextNoRawDiaryNotes";
    };
  };
};

function startOfLocalDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function endExclusiveOfLocalDay(d: Date): Date {
  const x = startOfLocalDay(d);
  x.setDate(x.getDate() + 1);
  return x;
}

function avg(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function ageYearsFromBirthDate(birthDate: Date): number {
  const now = new Date();
  let years = now.getFullYear() - birthDate.getFullYear();
  const m = now.getMonth() - birthDate.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < birthDate.getDate())) years -= 1;
  if (!Number.isFinite(years)) return 0;
  return Math.max(0, Math.min(120, years));
}

function inc(map: Record<string, number>, key: string | null | undefined): void {
  const k = key ? String(key) : "UNKNOWN";
  map[k] = (map[k] ?? 0) + 1;
}

function normalizeDiaryVisibility(level: string | null | undefined): AIContextDiaryVisibility {
  if (level === "FULL_AI_ACCESS" || level === "METRICS_ONLY" || level === "HIDDEN") return level;
  return "HIDDEN";
}

const TODAY_INTENSIVE_KEYWORDS = [
  "interval",
  "intervals",
  "tempo",
  "race",
  "brick",
  "threshold",
  "vo2max",
  "hard",
];

const CONTEXT_HARD_TSS_THRESHOLD = 80;

function isContextWorkoutIntense(workout: {
  type?: string | null;
  title?: string | null;
  tss?: number | null;
}): boolean {
  if (workout.tss && workout.tss > CONTEXT_HARD_TSS_THRESHOLD) return true;
  if (workout.type && TODAY_INTENSIVE_KEYWORDS.some((keyword) => workout.type!.toLowerCase().includes(keyword))) {
    return true;
  }
  if (workout.title && TODAY_INTENSIVE_KEYWORDS.some((keyword) => workout.title!.toLowerCase().includes(keyword))) {
    return true;
  }
  return false;
}

async function buildTodayCheckinContext(
  userId: string,
  today: Date,
  planRigiditySetting: PlanRigiditySetting | null = null
): Promise<AIContext["todayCheckin"]> {
  const todayStart = startOfLocalDay(today);
  const tomorrowEnd = endExclusiveOfLocalDay(today);

  const checkIn = await db.dailyCheckIn.findUnique({
    where: { userId_date: { userId, date: todayStart } },
  });

  const todayWorkout = await db.workout.findFirst({
    where: {
      userId,
      date: { gte: todayStart, lt: tomorrowEnd },
      completed: false,
    },
    select: { id: true, type: true, title: true, tss: true },
  });

  let status: "pending" | "completed" | "required" = "pending";
  const checkinAny = checkIn as Record<string, unknown> | null;
  const hasPremiumData = checkinAny && checkinAny.sleepQuality100 !== null && checkinAny.sleepQuality100 !== undefined;
  const privacyMode = normalizeDiaryVisibility(
    checkIn?.notesVisibility ?? "FULL_AI_ACCESS"
  );

  const isIntenseWorkout =
    todayWorkout &&
    isContextWorkoutIntense({
      type: todayWorkout.type,
      title: todayWorkout.title,
      tss: todayWorkout.tss ?? null,
    });

  if (hasPremiumData) {
    status = "completed";
  } else if (todayWorkout && isIntenseWorkout) {
    status = "required";
  }

  const rigidity = planRigiditySetting ?? "LOCKED_1_DAY";
  let planLocked = false;
  const workoutWithDate = todayWorkout as { date?: Date | string } | null;
  if (workoutWithDate?.date) {
    const workoutDate = new Date(workoutWithDate.date);
    planLocked = isWorkoutLocked({ workoutDate, planRigidity: rigidity });
  }

  if (!hasPremiumData || privacyMode === "HIDDEN") {
    return {
      status,
      privacyMode,
      planLocked,
      data: null,
    };
  }

  return {
    status: "completed",
    privacyMode,
    planLocked,
    data: {
      readinessScore: (checkinAny.readinessScore as number) ?? 0,
      topFactor: (checkinAny.topFactor as string) ?? "Unknown",
      recommendation: (checkinAny.recommendation as string) ?? "",
      sleepQuality: (checkinAny.sleepQuality100 as number) ?? 0,
      fatigue: (checkinAny.fatigue100 as number) ?? 0,
      motivation: (checkinAny.motivation100 as number) ?? 0,
      soreness: (checkinAny.soreness100 as number) ?? 0,
      stress: (checkinAny.stress100 as number) ?? 0,
      hasConflict: (checkinAny.hasConflict as boolean) ?? false,
      conflictReason: (checkinAny.conflictReason as string | null) ?? null,
    },
  };
}

export async function buildAIContextForUser(userId: string): Promise<AIContext> {
  const generatedAt = new Date();
  generatedAt.setHours(12, 0, 0, 0);

  const todayStart = startOfLocalDay(generatedAt);
  const tomorrowEndExclusive = endExclusiveOfLocalDay(generatedAt);

  const start7 = startOfLocalDay(addDays(generatedAt, -6));
  const start14 = startOfLocalDay(addDays(generatedAt, -13));
  const next7EndExclusive = endExclusiveOfLocalDay(addDays(generatedAt, 7));

  const [user, profile, activeSeason, blocks, races, pbs, keySessions, completed14d, checkIns7d, feedback14d, diary7d, metrics14d] =
    await Promise.all([
      db.user.findUnique({
        where: { id: userId },
        select: { id: true, name: true, tonePreference: true, explainLevel: true, identityMode: true },
      }),
      db.profile.findUnique({
        where: { userId },
        select: {
          birthDate: true,
          weight: true,
          height: true,
          sportPrimary: true,
          experienceLevel: true,
          weeklyHoursGoal: true,
          restingHR: true,
          maxHR: true,
          ftp: true,
          zone1Min: true,
          zone1Max: true,
          zone2Min: true,
          zone2Max: true,
          zone3Min: true,
          zone3Max: true,
          zone4Min: true,
          zone4Max: true,
          zone5Min: true,
          zone5Max: true,
          planRigidity: true,
          equipmentNotes: true,
          terrainNotes: true,
          availabilityNotes: true,
          swimPoolLengthM: true,
          club: true,
          location: true,
          timezone: true,
          birthYear: true,
          availability: true,
          preferences: true,
          guardrails: true,
        },
      }),
      db.season.findFirst({
        where: {
          userId,
          startDate: { lte: generatedAt },
          endDate: { gte: generatedAt },
        },
        select: { id: true, name: true, startDate: true, endDate: true, primaryGoal: true },
      }),
      db.trainingBlock.findMany({
        where: {
          userId,
          season: {
            userId,
            startDate: { lte: generatedAt },
            endDate: { gte: generatedAt },
          },
        },
        orderBy: { startDate: "asc" },
        select: { id: true, type: true, startDate: true, endDate: true, focus: true },
      }),
      db.raceEvent.findMany({
        where: {
          userId,
          date: { gte: todayStart },
        },
        orderBy: { date: "asc" },
        take: 10,
        select: { id: true, name: true, date: true, priority: true, goalTime: true },
      }),
      db.personalBest.findMany({
        where: { userId },
        orderBy: { date: "desc" },
        take: 25,
        select: {
          id: true,
          sport: true,
          discipline: true,
          valueNumber: true,
          valueUnit: true,
          date: true,
          source: true,
        },
      }),
      db.workout.findMany({
        where: {
          userId,
          planned: true,
          completed: false,
          date: { gte: todayStart, lt: next7EndExclusive },
        },
        orderBy: [{ date: "asc" }, { createdAt: "asc" }],
        take: 50,
        select: { id: true, date: true, title: true, type: true, tss: true, durationMin: true, planned: true },
      }),
      db.workout.findMany({
        where: {
          userId,
          completed: true,
          date: { gte: start14, lt: tomorrowEndExclusive },
        },
        orderBy: [{ date: "desc" }, { createdAt: "desc" }],
        take: 30,
        select: {
          date: true,
          title: true,
          type: true,
          durationMin: true,
          tss: true,
          planned: true,
          aiGenerated: true,
        },
      }),
      db.dailyCheckIn.findMany({
        where: { userId, date: { gte: start7, lt: tomorrowEndExclusive } },
        orderBy: { date: "asc" },
        select: {
          date: true,
          sleepDuration: true,
          sleepQuality: true,
          physicalFatigue: true,
          mentalReadiness: true,
          motivation: true,
          stressLevel: true,
          readinessScore: true,
          aiDecision: true,
          aiConfidence: true,
          notes: true,
        },
      }),
      db.postWorkoutFeedback.findMany({
        where: { userId, visibleToAI: true, createdAt: { gte: start14 } },
        orderBy: { createdAt: "desc" },
        take: 200,
        select: {
          perceivedDifficulty: true,
          vsPlanned: true,
          enjoyment: true,
          mentalState: true,
          painOrDiscomfort: true,
          comment: true,
        },
      }),
      db.diaryEntry.findMany({
        where: { userId, date: { gte: start7, lt: tomorrowEndExclusive } },
        orderBy: { date: "asc" },
        select: {
          date: true,
          visibilityLevel: true,
          mood: true,
          energy: true,
          sleepHrs: true,
          sleepQual: true,
          stress: true,
          soreness: true,
          motivation: true,
          notes: true,
        },
      }),
      db.metricDaily.findMany({
        where: { userId, date: { gte: start14, lt: tomorrowEndExclusive } },
        orderBy: { date: "desc" },
        take: 1,
        select: {
          date: true,
          readinessScore: true,
          complianceScore: true,
          burnoutRisk: true,
          ctl: true,
          atl: true,
          tsb: true,
        },
      }),
    ]);

  const activeBlock = (() => {
    for (const b of blocks) {
      if (b.startDate <= generatedAt && b.endDate >= generatedAt) return b;
    }
    return null;
  })();

  const keySessionsNext7d = keySessions
    .map((w) => {
      const tss = w.tss ?? null;
      const durationMin = w.durationMin ?? null;
      const isKey = (typeof tss === "number" && tss >= 70) || (typeof durationMin === "number" && durationMin >= 75);

      return {
        id: w.id,
        date: formatLocalDateInput(w.date),
        title: w.title,
        type: w.type,
        tss,
        durationMin,
        isPlanned: Boolean(w.planned),
        isKey,
      };
    })
    .filter((w) => w.isKey)
    .slice(0, 7)
    .map(({ isKey: _isKey, ...rest }) => {
      void _isKey;
      return rest;
    });

  const checkInsItems = checkIns7d.map((c) => ({
    date: formatLocalDateInput(c.date),
    readinessScore: c.readinessScore ?? null,
    sleepDuration: c.sleepDuration,
    sleepQuality: c.sleepQuality,
    physicalFatigue: c.physicalFatigue,
    mentalReadiness: c.mentalReadiness,
    motivation: c.motivation,
    stressLevel: c.stressLevel,
    aiDecision: c.aiDecision ?? null,
    aiConfidence: c.aiConfidence ?? null,
    notesPresent: typeof c.notes === "string" && c.notes.trim().length > 0,
  }));

  const perceivedDifficultyCounts: Record<string, number> = {};
  const vsPlannedCounts: Record<string, number> = {};
  const enjoymentValues: number[] = [];
  const mentalValues: number[] = [];
  let painOrDiscomfortCount = 0;
  let commentCount = 0;

  for (const f of feedback14d) {
    inc(perceivedDifficultyCounts, f.perceivedDifficulty);
    inc(vsPlannedCounts, f.vsPlanned);
    if (typeof f.enjoyment === "number") enjoymentValues.push(f.enjoyment);
    if (typeof f.mentalState === "number") mentalValues.push(f.mentalState);
    if (typeof f.painOrDiscomfort === "string" && f.painOrDiscomfort.trim().length > 0) painOrDiscomfortCount += 1;
    if (typeof f.comment === "string" && f.comment.trim().length > 0) commentCount += 1;
  }

  const diaryItemsRaw = diary7d.map((d) => {
    const visibility = normalizeDiaryVisibility(d.visibilityLevel);
    return {
      date: formatLocalDateInput(d.date),
      visibility,
      mood: d.mood ?? null,
      energy: d.energy ?? null,
      sleepHrs: d.sleepHrs ?? null,
      sleepQual: d.sleepQual ?? null,
      stress: d.stress ?? null,
      soreness: d.soreness ?? null,
      motivation: d.motivation ?? null,
      notesPresent: typeof d.notes === "string" && d.notes.trim().length > 0,
    };
  });

  const diarySignalsItems = diaryItemsRaw.filter((d) => d.visibility !== "HIDDEN");
  const excludedHiddenCount = diaryItemsRaw.length - diarySignalsItems.length;

  const pbsOut = pbs.map((pb) => ({
    id: pb.id,
    sport: pb.sport,
    discipline: pb.discipline,
    valueNumber: pb.valueNumber,
    valueUnit: pb.valueUnit,
    date: formatLocalDateInput(pb.date),
    source: pb.source,
  }));

  const completedItems = completed14d
    .map((w) => ({
      date: formatLocalDateInput(w.date),
      title: w.title,
      type: w.type,
      durationMin: w.durationMin ?? null,
      tss: w.tss ?? null,
      planned: Boolean(w.planned),
      aiGenerated: Boolean(w.aiGenerated),
    }))
    .slice(0, 10);

  const byTypeCounts: Record<string, number> = {};
  let totalDurationMin = 0;
  let totalTss = 0;
  for (const w of completed14d) {
    inc(byTypeCounts, w.type);
    if (typeof w.durationMin === "number") totalDurationMin += w.durationMin;
    if (typeof w.tss === "number") totalTss += w.tss;
  }

  const context: AIContext = {
    contextVersion: AI_CONTEXT_VERSION,
    generatedAt: generatedAt.toISOString(),
    userProfile: {
      userId,
      name: user?.name ?? null,
      tonePreference: user?.tonePreference ?? null,
      explainLevel: (user as unknown as { explainLevel?: string | null } | null)?.explainLevel ?? null,
      identityMode: (user as unknown as { identityMode?: string | null } | null)?.identityMode ?? null,
      ageYears: profile?.birthDate ? ageYearsFromBirthDate(profile.birthDate) : null,
      weightKg: typeof profile?.weight === "number" ? profile.weight : null,
      heightCm: typeof profile?.height === "number" ? profile.height : null,
      sportPrimary: profile?.sportPrimary ?? null,
      experienceLevel: profile?.experienceLevel ?? null,
      planRigidity: profile?.planRigidity ?? null,
      equipmentNotes: profile?.equipmentNotes ?? null,
      terrainNotes: profile?.terrainNotes ?? null,
      availabilityNotes: profile?.availabilityNotes ?? null,
      swimPoolLengthM: profile?.swimPoolLengthM ?? null,
      club: (profile as { club?: string | null })?.club ?? null,
      location: (profile as { location?: string | null })?.location ?? null,
      timezone: (profile as { timezone?: string | null })?.timezone ?? null,
      birthYear: (profile as { birthYear?: number | null })?.birthYear ?? null,
      availability: (profile as { availability?: Record<string, unknown> | null })?.availability ?? null,
      preferences: (profile as { preferences?: Record<string, unknown> | null })?.preferences ?? null,
      guardrails: (profile as { guardrails?: Record<string, unknown> | null })?.guardrails ?? null,
    },
    zones: {
      hr: {
        restingHR: profile?.restingHR ?? null,
        maxHR: profile?.maxHR ?? null,
        z1: { min: profile?.zone1Min ?? null, max: profile?.zone1Max ?? null },
        z2: { min: profile?.zone2Min ?? null, max: profile?.zone2Max ?? null },
        z3: { min: profile?.zone3Min ?? null, max: profile?.zone3Max ?? null },
        z4: { min: profile?.zone4Min ?? null, max: profile?.zone4Max ?? null },
        z5: { min: profile?.zone5Min ?? null, max: profile?.zone5Max ?? null },
      },
      power: {
        ftp: profile?.ftp ?? null,
      },
    },
    pbs: pbsOut,
    goals: {
      weeklyHoursGoal: profile?.weeklyHoursGoal ?? null,
      seasonGoal: activeSeason?.primaryGoal ?? null,
      upcomingRaces: races.map((r) => ({
        id: r.id,
        name: r.name,
        date: formatLocalDateInput(r.date),
        priority: r.priority,
        goalTime: r.goalTime ?? null,
      })),
    },
    planSummary: {
      today: formatLocalDateInput(generatedAt),
      activeSeason: activeSeason
        ? {
            id: activeSeason.id,
            name: activeSeason.name,
            startDate: formatLocalDateInput(activeSeason.startDate),
            endDate: formatLocalDateInput(activeSeason.endDate),
          }
        : null,
      activeBlock: activeBlock
        ? {
            id: activeBlock.id,
            type: activeBlock.type,
            focus: activeBlock.focus ?? null,
            startDate: formatLocalDateInput(activeBlock.startDate),
            endDate: formatLocalDateInput(activeBlock.endDate),
          }
        : null,
      keySessionsNext7d,
    },
    todayCheckin: await buildTodayCheckinContext(
      userId,
      generatedAt,
      profile?.planRigidity as PlanRigiditySetting | null
    ),
    recentSignals: {
      checkIns7d: {
        window: {
          start: formatLocalDateInput(start7),
          endExclusive: formatLocalDateInput(tomorrowEndExclusive),
        },
        items: checkInsItems,
      },
      feedbackPatterns14d: {
        window: {
          start: formatLocalDateInput(start14),
          endExclusive: formatLocalDateInput(tomorrowEndExclusive),
        },
        totalFeedback: feedback14d.length,
        avgEnjoyment: avg(enjoymentValues),
        avgMentalState: avg(mentalValues),
        perceivedDifficultyCounts,
        vsPlannedCounts,
        painOrDiscomfortCount,
        commentCount,
      },
      diarySignals7d: {
        window: {
          start: formatLocalDateInput(start7),
          endExclusive: formatLocalDateInput(tomorrowEndExclusive),
        },
        includedCount: diarySignalsItems.length,
        excludedHiddenCount,
        items: diarySignalsItems.map((d) => {
          if (d.visibility === "METRICS_ONLY") {
            return {
              date: d.date,
              visibility: d.visibility,
              mood: d.mood,
              energy: d.energy,
              sleepHrs: d.sleepHrs,
              sleepQual: d.sleepQual,
              stress: d.stress,
              soreness: d.soreness,
              motivation: d.motivation,
              notesPresent: false,
            };
          }

          return d;
        }),
      },
      metrics14d: {
        window: {
          start: formatLocalDateInput(start14),
          endExclusive: formatLocalDateInput(tomorrowEndExclusive),
        },
        latest:
          metrics14d.length > 0
            ? {
                date: formatLocalDateInput(metrics14d[0].date),
                readinessScore: metrics14d[0].readinessScore ?? null,
                complianceScore: metrics14d[0].complianceScore ?? null,
                burnoutRisk: metrics14d[0].burnoutRisk ?? null,
                ctl: metrics14d[0].ctl ?? null,
                atl: metrics14d[0].atl ?? null,
                tsb: metrics14d[0].tsb ?? null,
              }
            : null,
      },
    },
    recentTraining: {
      completedWorkouts14d: {
        window: {
          start: formatLocalDateInput(start14),
          endExclusive: formatLocalDateInput(tomorrowEndExclusive),
        },
        count: completed14d.length,
        totalDurationMin,
        totalTss,
        byTypeCounts,
        items: completedItems,
      },
    },
    privacySummary: {
      diary: {
        policy: "NO_RAW_DIARY_TEXT",
        fullAiAccess: "METRICS_AND_NOTES_PRESENT_ONLY",
        metricsOnly: "METRICS_ONLY",
        hidden: "EXCLUDED",
      },
      checkIns: {
        policy: "NO_RAW_CHECKIN_NOTES",
      },
      feedback: {
        policy: "NO_RAW_FEEDBACK_COMMENT",
      },
      verification: {
        verifier: "assertAIContextNoRawDiaryNotes",
      },
    },
  };

  assertAIContextNoRawDiaryNotes(context);
  return context;
}

export function assertAIContextNoRawDiaryNotes(context: AIContext): void {
  const forbiddenKey = "notes";

  function walk(value: unknown, path: string[]): void {
    if (value == null) return;
    if (Array.isArray(value)) {
      value.forEach((v, i) => walk(v, [...path, String(i)]));
      return;
    }
    if (typeof value !== "object") return;

    const obj = value as Record<string, unknown>;
    for (const [k, v] of Object.entries(obj)) {
      if (k === forbiddenKey && typeof v === "string" && v.trim().length > 0) {
        throw new Error(`AI context leak detected: ${[...path, k].join(".")}`);
      }
      walk(v, [...path, k]);
    }
  }

  walk(context, []);
}
