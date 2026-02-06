"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import type { StructuredWorkoutPlan, Block, Section, SectionType } from "@/lib/plans/types";
import { stringifyStructuredWorkoutPlan } from "@/lib/plans/compat";
import { exportStructuredToText } from "@/lib/plans/format";
import { isWorkoutLocked, type PlanRigiditySetting } from "@/lib/services/plan-rigidity.service";
import { createPlanChangeProposal, type ProposalPatch } from "@/lib/actions/plan-rigidity";

type BenchmarksRow = {
  swimCssSecPer100: number | null;
  swim400TimeSec: number | null;
  swim100TimeSec: number | null;
  swim200TimeSec?: number | null;
  swim1500TimeSec?: number | null;
  run5kTimeSec: number | null;
  run10kTimeSec: number | null;
  runThresholdSecPerKm: number | null;
  runHmTimeSec?: number | null;
  runMarathonTimeSec?: number | null;
  bikeBest20minWatts?: number | null;
};

type CoachWorkoutDb = {
  workout: {
    findFirst: (args: {
      where: { id: string; userId: string };
      select: { id: true; userId: true; title: true; type: true; date: true; durationMin: true };
    }) => Promise<null | { id: string; userId: string; title: string; type: string; date: Date; durationMin: number | null }>;
    update: (args: {
      where: { id: string };
      data: {
        descriptionMd?: string | null;
        prescriptionJson?: string | null;
        aiGenerated?: boolean;
        aiReason?: string | null;
        aiConfidence?: number | null;
        source?: string | null;
      };
    }) => Promise<unknown>;
  };
  profile: {
    findUnique: (args: {
      where: { userId: string };
      select: { ftp: true; swimPoolLengthM: true; planRigidity: true };
    }) => Promise<null | { ftp: number | null; swimPoolLengthM: number | null; planRigidity: unknown }>;
  };
  dailyCheckIn: {
    findFirst: (args: {
      where: { userId: string; date: { gte: Date; lt: Date } };
      select: { readinessScore: true; fatigue100: true; soreness100: true };
    }) => Promise<null | { readinessScore: number | null; fatigue100: number | null; soreness100: number | null }>;
  };
  performanceBenchmarks: {
    findUnique: (args: { where: { userId: string } }) => Promise<null | BenchmarksRow>;
  };
};

const coachDb = db as unknown as CoachWorkoutDb;

export type CoachGeneratedWorkoutPlan = {
  plannedPlan: StructuredWorkoutPlan;
  adjustedPlan: StructuredWorkoutPlan | null;
  reason: string; // 1–2 sentences
  summary: string; // 2–3 lines
  safetyNote: string; // 1 line
  targetsUsed?: Record<string, string>; // e.g. swim_pace, run_pace, bike_power
};

export async function generateCoachWorkoutPlan(params: {
  workoutId: string;
}): Promise<{ ok: true; result: CoachGeneratedWorkoutPlan } | { ok: false; error: string }> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "Unauthorized" };

  const userId = session.user.id;
  const workoutId = params.workoutId;
  if (!workoutId || workoutId.trim().length < 5) return { ok: false, error: "Invalid workoutId" };

  const workout = await coachDb.workout.findFirst({
    where: { id: workoutId, userId },
    select: { id: true, userId: true, title: true, type: true, date: true, durationMin: true },
  });
  if (!workout) return { ok: false, error: "Workout not found" };

  const [profile, benchmarks, checkIn] = await Promise.all([
    safeFindProfile(userId),
    safeFindBenchmarks(userId),
    (async () => {
      const start = new Date(workout.date);
      start.setHours(0, 0, 0, 0);
      const end = new Date(start);
      end.setDate(end.getDate() + 1);
      return safeFindCheckIn(userId, start, end);
    })(),
  ]);

  const durationMin = typeof workout.durationMin === "number" && workout.durationMin > 0 ? workout.durationMin : 60;
  const normalizedType = normalizeWorkoutType(workout.type);

  const planned = buildPlannedPlan({
    workoutType: normalizedType,
    title: workout.title,
    durationMin,
    poolLenM: profile?.swimPoolLengthM ?? null,
    ftp: profile?.ftp ?? null,
    benchmarks: benchmarks ?? null,
  });

  const trigger = shouldAdjustFromCheckIn(checkIn);
  const adjusted = trigger
    ? buildAdjustedPlan({
        workoutType: normalizedType,
        durationMin,
        poolLenM: profile?.swimPoolLengthM ?? null,
        ftp: profile?.ftp ?? null,
        benchmarks: benchmarks ?? null,
      })
    : null;

  const benchUnlockLine = planned.usedTargets
    ? null
    : "Add benchmarks to unlock pace targets";

  const reason = trigger
    ? buildAdjustmentReason(checkIn)
    : planned.usedTargets
      ? "Used your benchmarks to set concrete pace/power targets. Adjust slightly by feel if conditions (weather/terrain) differ."
      : "Benchmarks are missing, so I used Zones + RPE targets. Add benchmarks to unlock pace/power targets.";

  const summaryLines: string[] = [];
  summaryLines.push(`Planned: ${planned.label}.`);
  summaryLines.push(trigger ? "Adjusted version available (reduced intensity + simplified main set)." : "No adjustment needed from today’s check‑in.");
  if (benchUnlockLine) summaryLines.push(benchUnlockLine);

  const safetyNote =
    "Stop if you feel sharp pain, dizziness, or unusual fatigue; keep form smooth and stay hydrated.";

  return {
    ok: true,
    result: {
      plannedPlan: planned.plan,
      adjustedPlan: adjusted?.plan ?? null,
      reason,
      summary: summaryLines.slice(0, 3).join("\n"),
      safetyNote,
      targetsUsed: planned.targetsUsed ?? undefined,
    },
  };
}

export async function applyCoachWorkoutPlan(params: {
  workoutId: string;
  plan: StructuredWorkoutPlan;
  source: "planned" | "adjusted";
  reason?: string | null;
}): Promise<
  | { ok: true; applied: "UPDATED" | "PROPOSED"; proposalId?: string }
  | { ok: false; error: string }
> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "Unauthorized" };

  const userId = session.user.id;
  const workoutId = params.workoutId;
  if (!workoutId || workoutId.trim().length < 5) return { ok: false, error: "Invalid workoutId" };

  const workout = await coachDb.workout.findFirst({
    where: { id: workoutId, userId },
    select: { id: true, userId: true, title: true, type: true, date: true, durationMin: true },
  });
  if (!workout) return { ok: false, error: "Workout not found" };

  const profile = await safeFindProfile(userId);

  const planRigidity = parsePlanRigiditySetting(profile?.planRigidity ?? null);
  const locked = isWorkoutLocked({ workoutDate: workout.date, now: new Date(), planRigidity });

  const prescriptionJson = stringifyStructuredWorkoutPlan(params.plan);
  const descriptionMdRaw = exportStructuredToText(params.plan);
  const descriptionMd = descriptionMdRaw.trim().length > 0 ? descriptionMdRaw : null;

  const aiReason = typeof params.reason === "string" && params.reason.trim().length > 0 ? params.reason.trim() : null;

  if (locked) {
    const dateLabel = new Date(workout.date).toISOString().slice(0, 10);
    const patch: ProposalPatch = {
      workout: {
        id: workoutId,
        update: {
          prescriptionJson,
          descriptionMd,
          aiGenerated: true,
          aiReason,
          aiConfidence: 85,
          source: "coach",
        },
      },
    };

    const summary = `${params.source === "adjusted" ? "Adjusted" : "Planned"} coach plan for ${dateLabel}: ${workout.title}`;

    const proposal = await createPlanChangeProposal({
      workoutId,
      summary,
      patch,
      confidence: 85,
      sourceType: "COACH",
    });

    if (!proposal.success || !proposal.proposalId) {
      return { ok: false, error: proposal.error || "Failed to create proposal" };
    }

    return { ok: true, applied: "PROPOSED", proposalId: proposal.proposalId };
  }

  await coachDb.workout.update({
    where: { id: workoutId },
    data: {
      prescriptionJson,
      descriptionMd,
      aiGenerated: true,
      aiReason,
      aiConfidence: 85,
      source: "coach",
    },
  });

  revalidatePath("/calendar");
  revalidatePath("/dashboard");

  return { ok: true, applied: "UPDATED" };
}

function normalizeWorkoutType(type: string): "run" | "bike" | "swim" | "strength" | "rest" | "other" {
  const t = String(type || "").toLowerCase();
  if (t.includes("swim") || t.includes("pływ") || t.includes("plyw")) return "swim";
  if (t.includes("bike") || t.includes("cycle") || t.includes("rower")) return "bike";
  if (t.includes("run") || t.includes("bieg")) return "run";
  if (t.includes("strength") || t.includes("gym") || t.includes("sił") || t.includes("sil")) return "strength";
  if (t.includes("rest") || t.includes("off") || t.includes("odp")) return "rest";
  return "other";
}

function parsePlanRigiditySetting(v: unknown): PlanRigiditySetting {
  const s = String(v ?? "");
  if (s === "LOCKED_TODAY" || s === "LOCKED_1_DAY" || s === "LOCKED_2_DAYS" || s === "LOCKED_3_DAYS" || s === "FLEXIBLE_WEEK") {
    return s;
  }
  return "LOCKED_1_DAY";
}

async function safeFindProfile(userId: string): Promise<null | { ftp: number | null; swimPoolLengthM: number | null; planRigidity: unknown }> {
  try {
    return await coachDb.profile.findUnique({
      where: { userId },
      select: { ftp: true, swimPoolLengthM: true, planRigidity: true },
    });
  } catch {
    return null;
  }
}

async function safeFindBenchmarks(userId: string): Promise<BenchmarksRow | null> {
  try {
    const anyDb = coachDb as unknown as { performanceBenchmarks?: { findUnique?: (args: { where: { userId: string } }) => Promise<BenchmarksRow | null> } };
    if (!anyDb.performanceBenchmarks?.findUnique) return null;
    return await anyDb.performanceBenchmarks.findUnique({ where: { userId } });
  } catch {
    return null;
  }
}

async function safeFindCheckIn(userId: string, start: Date, end: Date): Promise<null | { readinessScore: number | null; fatigue100: number | null; soreness100: number | null }> {
  try {
    return await coachDb.dailyCheckIn.findFirst({
      where: { userId, date: { gte: start, lt: end } },
      select: { readinessScore: true, fatigue100: true, soreness100: true },
    });
  } catch {
    // If premium columns are missing (schema drift), fall back to legacy signals.
    try {
      const legacy = await (coachDb as unknown as {
        dailyCheckIn: {
          findFirst: (args: unknown) => Promise<null | { readinessScore: number | null; physicalFatigue: number | null; muscleSoreness: unknown }>;
        };
      }).dailyCheckIn.findFirst({
        where: { userId, date: { gte: start, lt: end } },
        select: { readinessScore: true, physicalFatigue: true, muscleSoreness: true },
      });

      if (!legacy) return null;

      const pf = typeof legacy.physicalFatigue === "number" ? legacy.physicalFatigue : null; // 1-5
      const fatigue100 = pf != null ? Math.round(((Math.max(1, Math.min(5, pf)) - 1) / 4) * 100) : null;
      const soreness100 = muscleSorenessTo100(legacy.muscleSoreness);

      return {
        readinessScore: typeof legacy.readinessScore === "number" ? legacy.readinessScore : null,
        fatigue100,
        soreness100,
      };
    } catch {
      return null;
    }
  }
}

function muscleSorenessTo100(v: unknown): number | null {
  const s = String(v ?? "");
  if (s === "NONE") return 0;
  if (s === "MILD") return 30;
  if (s === "MODERATE") return 60;
  if (s === "SEVERE") return 85;
  return null;
}

function shouldAdjustFromCheckIn(checkIn: null | { readinessScore: number | null; fatigue100: number | null; soreness100: number | null }): boolean {
  if (!checkIn) return false;
  const readiness = typeof checkIn.readinessScore === "number" ? checkIn.readinessScore : null;
  const fatigue = typeof checkIn.fatigue100 === "number" ? checkIn.fatigue100 : null;
  const soreness = typeof checkIn.soreness100 === "number" ? checkIn.soreness100 : null;

  if (readiness != null && readiness < 60) return true;
  if (fatigue != null && fatigue > 75) return true;
  if (soreness != null && soreness > 70) return true;
  return false;
}

function buildAdjustmentReason(checkIn: null | { readinessScore: number | null; fatigue100: number | null; soreness100: number | null }): string {
  if (!checkIn) return "Today's check-in suggests reduced readiness, so I adjusted intensity to keep you consistent.";
  const bits: string[] = [];
  if (typeof checkIn.readinessScore === "number" && checkIn.readinessScore < 60) bits.push(`readiness ${checkIn.readinessScore}/100`);
  if (typeof checkIn.fatigue100 === "number" && checkIn.fatigue100 > 75) bits.push(`fatigue ${checkIn.fatigue100}/100`);
  if (typeof checkIn.soreness100 === "number" && checkIn.soreness100 > 70) bits.push(`soreness ${checkIn.soreness100}/100`);
  const why = bits.length > 0 ? bits.join(", ") : "low readiness signals";
  return `Based on today’s check‑in (${why}), I reduced intensity and simplified the main set.`;
}

function buildPlannedPlan(params: {
  workoutType: "run" | "bike" | "swim" | "strength" | "rest" | "other";
  title: string;
  durationMin: number;
  poolLenM: number | null;
  ftp: number | null;
  benchmarks: BenchmarksRow | null;
}): { plan: StructuredWorkoutPlan; usedTargets: boolean; label: string; targetsUsed?: Record<string, string> } {
  const w = params.durationMin;
  const warmMin = Math.max(8, Math.round(w * 0.15));
  const coolMin = Math.max(5, Math.round(w * 0.1));
  const mainMin = Math.max(10, w - warmMin - coolMin);

  if (params.workoutType === "run") {
    const kind = inferRunKind(params.title);

    const tenK = params.benchmarks?.run10kTimeSec ?? null;
    const fiveK = params.benchmarks?.run5kTimeSec ?? null;
    const threshold = params.benchmarks?.runThresholdSecPerKm ?? null;
    const hm = params.benchmarks?.runHmTimeSec ?? null;
    const marathon = params.benchmarks?.runMarathonTimeSec ?? null;

    const pace10k = typeof tenK === "number" && tenK > 0 ? tenK / 10 : null; // sec/km
    const pace5k = typeof fiveK === "number" && fiveK > 0 ? fiveK / 5 : null; // sec/km
    const paceHm = typeof hm === "number" && hm > 0 ? hm / 21.0975 : null; // sec/km
    const paceMarathon = typeof marathon === "number" && marathon > 0 ? marathon / 42.195 : null;

    const easyBase = pace10k ?? paceHm ?? paceMarathon;
    const easyLabel = easyBase != null ? paceRangeLabel(easyBase + 45, easyBase + 75, "/km") : null;
    const tempoBase = pace10k ?? paceHm ?? threshold;
    const tempoLabel =
      tempoBase != null
        ? paceRangeLabel(tempoBase + 15, tempoBase + 30, "/km")
        : threshold != null
          ? paceRangeLabel(threshold + 5, threshold + 20, "/km")
          : null;
    const intervalsLabel = pace5k != null ? paceRangeLabel(Math.max(0, pace5k - 10), pace5k, "/km") : null;

    const usedTargets = !!(easyLabel || tempoLabel || intervalsLabel);

    const warm: Block[] = [
      easyLabel
        ? { id: newId(), durationSec: warmMin * 60, intensityType: "pace", intensityLabel: easyLabel, notes: "easy jog + mobility" }
        : { id: newId(), durationSec: warmMin * 60, intensityType: "zone", intensityLabel: "Z2", notes: "easy jog (RPE 3/10)" },
    ];

    const main: Block[] = ((): Block[] => {
      if (kind === "intervals") {
        if (intervalsLabel) {
          const workSec = mainMin >= 28 ? 3 * 60 : mainMin >= 18 ? 2 * 60 : 60;
          const restSec = workSec;
          const reps = clampInt(Math.floor((mainMin * 60) / (workSec + restSec)), 4, 10);
          return [
            {
              id: newId(),
              reps,
              durationSec: workSec,
              intensityType: "pace",
              intensityLabel: intervalsLabel,
              restSec,
              notes: "strong but controlled; recover easy jog",
            },
          ];
        }
        return [
          {
            id: newId(),
            reps: 6,
            durationSec: 2 * 60,
            intensityType: "rpe",
            intensityRange: { unit: "rpe", min: 8 },
            restSec: 2 * 60,
            notes: "hard but smooth; keep form",
          },
        ];
      }

      if (kind === "tempo") {
        if (tempoLabel) {
          const reps = mainMin >= 35 ? 3 : 2;
          const workSec = reps === 3 ? 10 * 60 : 8 * 60;
          const restSec = 5 * 60;
          return [
            {
              id: newId(),
              reps,
              durationSec: workSec,
              intensityType: "pace",
              intensityLabel: tempoLabel,
              restSec,
              notes: "controlled tempo; breathing strong but steady",
            },
          ];
        }
        return [
          {
            id: newId(),
            durationSec: mainMin * 60,
            intensityType: "zone",
            intensityLabel: "Z3",
            notes: "steady tempo (RPE 6/10)",
          },
        ];
      }

      // easy
      if (easyLabel) {
        return [
          { id: newId(), durationSec: mainMin * 60, intensityType: "pace", intensityLabel: easyLabel, notes: "conversational; relaxed cadence" },
        ];
      }
      return [
        { id: newId(), durationSec: mainMin * 60, intensityType: "zone", intensityLabel: "Z2", notes: "conversational (RPE 3–4/10)" },
      ];
    })();

    const cool: Block[] = [
      easyLabel
        ? { id: newId(), durationSec: coolMin * 60, intensityType: "pace", intensityLabel: easyLabel, notes: "easy" }
        : { id: newId(), durationSec: coolMin * 60, intensityType: "zone", intensityLabel: "Z1", notes: "easy" },
    ];

    const objective =
      kind === "intervals" ? "Speed endurance • quality reps" : kind === "tempo" ? "Controlled tempo • smooth form" : "Aerobic base • relaxed cadence";

    const targetsUsed: Record<string, string> = {};
    if (easyLabel) targetsUsed.run_pace = easyLabel;
    if (tempoLabel) targetsUsed.run_tempo = tempoLabel;
    if (intervalsLabel) targetsUsed.run_intervals = intervalsLabel;

    return {
      plan: {
        version: 2,
        objective,
        sections: [
          mkSection("warmup", "Warm-up", warm),
          mkSection("main", "Main set", main),
          mkSection("cooldown", "Cool-down", cool),
        ],
      },
      usedTargets,
      label: kind === "intervals" ? "run intervals" : kind === "tempo" ? "tempo run" : "easy run",
      targetsUsed: Object.keys(targetsUsed).length > 0 ? targetsUsed : undefined,
    };
  }

  if (params.workoutType === "bike") {
    const kind = inferBikeKind(params.title);
    const ftp =
      typeof params.ftp === "number" && params.ftp > 0
        ? params.ftp
        : params.benchmarks?.bikeBest20minWatts != null && params.benchmarks.bikeBest20minWatts > 0
          ? Math.round(params.benchmarks.bikeBest20minWatts * 0.95)
          : null;
    const usedTargets = ftp != null;

    const z2 = ftp != null ? { unit: "w" as const, min: Math.round(ftp * 0.6), max: Math.round(ftp * 0.75) } : null;
    const tempo = ftp != null ? { unit: "w" as const, min: Math.round(ftp * 0.8), max: Math.round(ftp * 0.9) } : null;
    const thr = ftp != null ? { unit: "w" as const, min: Math.round(ftp * 0.95), max: Math.round(ftp * 1.05) } : null;
    const vo2 = ftp != null ? { unit: "w" as const, min: Math.round(ftp * 1.1), max: Math.round(ftp * 1.2) } : null;

    const warm: Block[] = [
      z2
        ? { id: newId(), durationSec: warmMin * 60, intensityType: "power", intensityRange: z2, notes: "easy spin • build cadence" }
        : { id: newId(), durationSec: warmMin * 60, intensityType: "zone", intensityLabel: "Z2", notes: "easy spin (RPE 3/10)" },
    ];

    const main: Block[] = ((): Block[] => {
      if (kind === "vo2") {
        if (vo2 && z2) {
          const reps = mainMin >= 40 ? 5 : 4;
          const workSec = 3 * 60;
          const restSec = 3 * 60;
          const intervalTimeMin = Math.round((reps * (workSec + restSec)) / 60);
          const leftoverMin = Math.max(0, mainMin - intervalTimeMin);
          const blocks: Block[] = [
            { id: newId(), reps, durationSec: workSec, intensityType: "power", intensityRange: vo2, restSec, notes: "VO2 • high but smooth power" },
          ];
          if (leftoverMin > 6) {
            blocks.push({ id: newId(), durationSec: leftoverMin * 60, intensityType: "power", intensityRange: z2, notes: "easy endurance" });
          }
          return blocks;
        }
        return [{ id: newId(), durationSec: mainMin * 60, intensityType: "rpe", intensityRange: { unit: "rpe", min: 8 }, notes: "hard but controlled" }];
      }

      if (kind === "threshold") {
        if (thr && z2) {
          const reps = mainMin >= 50 ? 3 : 2;
          const workSec = reps === 3 ? 10 * 60 : 12 * 60;
          const restSec = 5 * 60;
          return [{ id: newId(), reps, durationSec: workSec, intensityType: "power", intensityRange: thr, restSec, notes: "threshold • steady pressure" }];
        }
        return [{ id: newId(), durationSec: mainMin * 60, intensityType: "zone", intensityLabel: "Z4", notes: "threshold feel (RPE 7/10)" }];
      }

      if (kind === "tempo") {
        if (tempo && z2) {
          const reps = mainMin >= 50 ? 2 : 1;
          const workSec = reps === 2 ? 15 * 60 : mainMin * 60;
          const restSec = reps === 2 ? 5 * 60 : undefined;
          return [
            {
              id: newId(),
              reps,
              durationSec: workSec,
              intensityType: "power",
              intensityRange: tempo,
              restSec,
              notes: "tempo • smooth power, no surges",
            },
          ];
        }
        return [{ id: newId(), durationSec: mainMin * 60, intensityType: "zone", intensityLabel: "Z3", notes: "tempo feel (RPE 6/10)" }];
      }

      // endurance
      if (z2) {
        return [{ id: newId(), durationSec: mainMin * 60, intensityType: "power", intensityRange: z2, notes: "endurance • relaxed cadence" }];
      }
      return [{ id: newId(), durationSec: mainMin * 60, intensityType: "zone", intensityLabel: "Z2", notes: "endurance (RPE 3–4/10)" }];
    })();

    const cool: Block[] = [
      z2
        ? { id: newId(), durationSec: coolMin * 60, intensityType: "power", intensityRange: z2, notes: "easy spin" }
        : { id: newId(), durationSec: coolMin * 60, intensityType: "zone", intensityLabel: "Z1", notes: "easy spin" },
    ];

    const objective =
      kind === "vo2"
        ? "VO2 stimulus • controlled surges"
        : kind === "threshold"
          ? "Threshold • steady pressure"
          : kind === "tempo"
            ? "Tempo • aerobic strength"
            : "Endurance • smooth cadence";

    const targetsUsed: Record<string, string> = {};
    if (z2) targetsUsed.bike_power = `${z2.min}–${z2.max} W (Z2)`;
    if (tempo) targetsUsed.bike_tempo = `${tempo.min}–${tempo.max} W`;
    if (thr) targetsUsed.bike_threshold = `${thr.min}–${thr.max} W`;

    return {
      plan: { version: 2, objective, sections: [mkSection("warmup", "Warm-up", warm), mkSection("main", "Main set", main), mkSection("cooldown", "Cool-down", cool)] },
      usedTargets,
      label: kind === "vo2" ? "VO2 ride" : kind === "threshold" ? "threshold ride" : kind === "tempo" ? "tempo ride" : "endurance ride",
      targetsUsed: Object.keys(targetsUsed).length > 0 ? targetsUsed : undefined,
    };
  }

  if (params.workoutType === "swim") {
    const kind = inferSwimKind(params.title);
    const css = params.benchmarks?.swimCssSecPer100 ?? null;
    const usedTargets = typeof css === "number" && css > 0;

    const easy = usedTargets ? paceRangeLabel(css + 15, css + 25, "/100m") : null;
    const moderate = usedTargets ? paceRangeLabel(css + 8, css + 15, "/100m") : null;
    const hard = usedTargets ? paceRangeLabel(Math.max(0, css - 8), css, "/100m") : null;

    const warm: Block[] = [
      { id: newId(), distanceM: 200, intensityType: easy ? "pace" : "rpe", intensityLabel: easy ?? undefined, intensityRange: !easy ? { unit: "rpe", min: 3 } : undefined, notes: "easy swim" },
      { id: newId(), reps: 4, distanceM: 50, intensityType: "rpe", intensityRange: { unit: "rpe", min: 4 }, restSec: 20, notes: "drills (kick / scull / catch)" },
    ];

    const main: Block[] = ((): Block[] => {
      if (kind === "technique") {
        return [
          { id: newId(), reps: 8, distanceM: 50, intensityType: "rpe", intensityRange: { unit: "rpe", min: 4 }, restSec: 20, notes: "technique focus" },
          { id: newId(), reps: 6, distanceM: 100, intensityType: easy ? "pace" : "rpe", intensityLabel: easy ?? undefined, intensityRange: !easy ? { unit: "rpe", min: 4 } : undefined, restSec: 20, notes: "smooth, long strokes" },
        ];
      }

      if (kind === "hard") {
        return [
          { id: newId(), reps: 12, distanceM: 50, intensityType: hard ? "pace" : "rpe", intensityLabel: hard ?? undefined, intensityRange: !hard ? { unit: "rpe", min: 8 } : undefined, restSec: 20, notes: "strong 50s • consistent splits" },
          { id: newId(), distanceM: 200, intensityType: easy ? "pace" : "rpe", intensityLabel: easy ?? undefined, intensityRange: !easy ? { unit: "rpe", min: 3 } : undefined, notes: "easy flush" },
        ];
      }

      // moderate
      return [
        { id: newId(), reps: 8, distanceM: 100, intensityType: moderate ? "pace" : "rpe", intensityLabel: moderate ?? undefined, intensityRange: !moderate ? { unit: "rpe", min: 6 } : undefined, restSec: 20, notes: "steady aerobic" },
      ];
    })();

    const cool: Block[] = [{ id: newId(), distanceM: 200, intensityType: easy ? "pace" : "rpe", intensityLabel: easy ?? undefined, intensityRange: !easy ? { unit: "rpe", min: 3 } : undefined, notes: "easy" }];

    const objective = kind === "hard" ? "Swim speed • maintain form" : kind === "technique" ? "Technique • efficiency" : "Aerobic swim • smooth rhythm";

    const targetsUsed: Record<string, string> = {};
    if (easy) targetsUsed.swim_pace = easy;
    if (moderate) targetsUsed.swim_moderate = moderate;
    if (hard) targetsUsed.swim_hard = hard;

    return {
      plan: { version: 2, objective, sections: [mkSection("warmup", "Warm-up", warm), mkSection("main", "Main set", main), mkSection("cooldown", "Cool-down", cool)] },
      usedTargets,
      label: kind === "hard" ? "swim intervals" : kind === "technique" ? "swim technique" : "steady swim",
      targetsUsed: Object.keys(targetsUsed).length > 0 ? targetsUsed : undefined,
    };
  }

  if (params.workoutType === "strength") {
    return {
      plan: {
        version: 2,
        objective: "Strength • movement quality",
        sections: [
          mkSection("warmup", "Warm-up", [{ id: newId(), durationSec: warmMin * 60, intensityType: "rpe", intensityRange: { unit: "rpe", min: 2 }, notes: "mobility + activation" }]),
          mkSection("strength", "Strength", [
            { id: newId(), reps: 4, durationSec: 6 * 60, intensityType: "rpe", intensityRange: { unit: "rpe", min: 7 }, restSec: 90, notes: "squat + hinge + push + pull (moderate load)" },
          ]),
          mkSection("cooldown", "Cool-down", [{ id: newId(), durationSec: coolMin * 60, intensityType: "rpe", intensityRange: { unit: "rpe", min: 2 }, notes: "breathing + stretch" }]),
        ],
      },
      usedTargets: true,
      label: "strength session",
    };
  }

  if (params.workoutType === "rest") {
    return {
      plan: {
        version: 2,
        objective: "Recovery • keep the habit",
        sections: [
          mkSection("main", "Optional", [
            { id: newId(), durationSec: 20 * 60, intensityType: "rpe", intensityRange: { unit: "rpe", min: 2 }, notes: "walk / easy mobility (optional)" },
          ]),
        ],
      },
      usedTargets: true,
      label: "rest day",
    };
  }

  return {
    plan: {
      version: 2,
      objective: "Steady session • by feel",
      sections: [
        mkSection("warmup", "Warm-up", [{ id: newId(), durationSec: warmMin * 60, intensityType: "rpe", intensityRange: { unit: "rpe", min: 3 }, notes: "easy build" }]),
        mkSection("main", "Main set", [{ id: newId(), durationSec: mainMin * 60, intensityType: "rpe", intensityRange: { unit: "rpe", min: 5 }, notes: "steady work" }]),
        mkSection("cooldown", "Cool-down", [{ id: newId(), durationSec: coolMin * 60, intensityType: "rpe", intensityRange: { unit: "rpe", min: 3 }, notes: "easy" }]),
      ],
    },
    usedTargets: false,
    label: "workout",
  };
}

function buildAdjustedPlan(params: {
  workoutType: "run" | "bike" | "swim" | "strength" | "rest" | "other";
  durationMin: number;
  poolLenM: number | null;
  ftp: number | null;
  benchmarks: BenchmarksRow | null;
}): { plan: StructuredWorkoutPlan; usedTargets: boolean } {
  const w = params.durationMin;
  const warmMin = Math.max(8, Math.round(w * 0.15));
  const coolMin = Math.max(5, Math.round(w * 0.1));
  const mainMin = Math.max(10, Math.round((w - warmMin - coolMin) * 0.75));

  if (params.workoutType === "run") {
    const tenK = params.benchmarks?.run10kTimeSec ?? null;
    const pace10k = typeof tenK === "number" && tenK > 0 ? tenK / 10 : null;
    const easyLabel = pace10k != null ? paceRangeLabel(pace10k + 60, pace10k + 90, "/km") : null;

    const warm: Block[] = [
      easyLabel
        ? { id: newId(), durationSec: warmMin * 60, intensityType: "pace", intensityLabel: easyLabel, notes: "very easy jog" }
        : { id: newId(), durationSec: warmMin * 60, intensityType: "zone", intensityLabel: "Z1", notes: "very easy (RPE 2–3/10)" },
    ];
    const main: Block[] = [
      easyLabel
        ? { id: newId(), durationSec: mainMin * 60, intensityType: "pace", intensityLabel: easyLabel, notes: "keep it easy, walk breaks OK" }
        : { id: newId(), durationSec: mainMin * 60, intensityType: "zone", intensityLabel: "Z2", notes: "keep it easy (RPE 3/10)" },
    ];
    const cool: Block[] = [{ id: newId(), durationSec: coolMin * 60, intensityType: "zone", intensityLabel: "Z1", notes: "easy" }];

    return {
      plan: { version: 2, objective: "Easy aerobic • recover", sections: [mkSection("warmup", "Warm-up", warm), mkSection("main", "Main set", main), mkSection("cooldown", "Cool-down", cool)] },
      usedTargets: !!easyLabel,
    };
  }

  if (params.workoutType === "bike") {
    const ftp = typeof params.ftp === "number" && params.ftp > 0 ? params.ftp : null;
    const z2 = ftp != null ? { unit: "w" as const, min: Math.round(ftp * 0.55), max: Math.round(ftp * 0.7) } : null;
    const warm: Block[] = [
      z2
        ? { id: newId(), durationSec: warmMin * 60, intensityType: "power", intensityRange: z2, notes: "easy spin" }
        : { id: newId(), durationSec: warmMin * 60, intensityType: "zone", intensityLabel: "Z1", notes: "easy spin (RPE 2–3/10)" },
    ];
    const main: Block[] = [
      z2
        ? { id: newId(), durationSec: mainMin * 60, intensityType: "power", intensityRange: z2, notes: "endurance only • no surges" }
        : { id: newId(), durationSec: mainMin * 60, intensityType: "zone", intensityLabel: "Z2", notes: "endurance only (RPE 3/10)" },
    ];
    const cool: Block[] = [{ id: newId(), durationSec: coolMin * 60, intensityType: "zone", intensityLabel: "Z1", notes: "easy" }];

    return {
      plan: { version: 2, objective: "Recovery spin • stay consistent", sections: [mkSection("warmup", "Warm-up", warm), mkSection("main", "Main set", main), mkSection("cooldown", "Cool-down", cool)] },
      usedTargets: !!z2,
    };
  }

  if (params.workoutType === "swim") {
    const css = params.benchmarks?.swimCssSecPer100 ?? null;
    const usedTargets = typeof css === "number" && css > 0;
    const easy = usedTargets ? paceRangeLabel(css + 20, css + 30, "/100m") : null;

    const warm: Block[] = [
      { id: newId(), distanceM: 200, intensityType: easy ? "pace" : "rpe", intensityLabel: easy ?? undefined, intensityRange: !easy ? { unit: "rpe", min: 3 } : undefined, notes: "easy swim" },
      { id: newId(), reps: 6, distanceM: 50, intensityType: "rpe", intensityRange: { unit: "rpe", min: 4 }, restSec: 20, notes: "drills • smooth" },
    ];
    const main: Block[] = [
      { id: newId(), reps: 6, distanceM: 100, intensityType: easy ? "pace" : "rpe", intensityLabel: easy ?? undefined, intensityRange: !easy ? { unit: "rpe", min: 4 } : undefined, restSec: 20, notes: "easy aerobic" },
    ];
    const cool: Block[] = [{ id: newId(), distanceM: 200, intensityType: easy ? "pace" : "rpe", intensityLabel: easy ?? undefined, intensityRange: !easy ? { unit: "rpe", min: 3 } : undefined, notes: "easy" }];

    return {
      plan: { version: 2, objective: "Technique + easy aerobic • recover", sections: [mkSection("warmup", "Warm-up", warm), mkSection("main", "Main set", main), mkSection("cooldown", "Cool-down", cool)] },
      usedTargets: !!easy,
    };
  }

  // fallback: easy by feel
  return {
    plan: {
      version: 2,
      objective: "Keep it easy today • recover",
      sections: [
        mkSection("warmup", "Warm-up", [{ id: newId(), durationSec: warmMin * 60, intensityType: "rpe", intensityRange: { unit: "rpe", min: 3 }, notes: "easy build" }]),
        mkSection("main", "Main set", [{ id: newId(), durationSec: mainMin * 60, intensityType: "rpe", intensityRange: { unit: "rpe", min: 4 }, notes: "steady easy" }]),
        mkSection("cooldown", "Cool-down", [{ id: newId(), durationSec: coolMin * 60, intensityType: "rpe", intensityRange: { unit: "rpe", min: 3 }, notes: "easy" }]),
      ],
    },
    usedTargets: false,
  };
}

function inferRunKind(title: string): "easy" | "tempo" | "intervals" {
  const t = String(title || "").toLowerCase();
  if (/\b(interval|intervals|vo2|speed|reps|track)\b/.test(t)) return "intervals";
  if (/\b(tempo|threshold|prog|progression)\b/.test(t)) return "tempo";
  return "easy";
}

function inferBikeKind(title: string): "endurance" | "tempo" | "threshold" | "vo2" {
  const t = String(title || "").toLowerCase();
  if (/\b(vo2|interval|anaerobic|max)\b/.test(t)) return "vo2";
  if (/\b(threshold|ftp)\b/.test(t)) return "threshold";
  if (/\b(tempo|sweet spot)\b/.test(t)) return "tempo";
  return "endurance";
}

function inferSwimKind(title: string): "steady" | "technique" | "hard" {
  const t = String(title || "").toLowerCase();
  if (/\b(tech|drill|technique)\b/.test(t)) return "technique";
  if (/\b(interval|sprint|hard|fast)\b/.test(t)) return "hard";
  return "steady";
}

function paceRangeLabel(minSec: number, maxSec: number, suffix: string): string {
  const a = Math.max(0, Math.round(minSec));
  const b = Math.max(0, Math.round(maxSec));
  const lo = Math.min(a, b);
  const hi = Math.max(a, b);
  return `${fmtMmSs(lo)}–${fmtMmSs(hi)}${suffix}`;
}

function fmtMmSs(sec: number): string {
  const s = Math.max(0, Math.round(sec));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, "0")}`;
}

function mkSection(type: SectionType, title: string, blocks: Block[]): Section {
  return { id: newId(), type, title, blocks };
}

function clampInt(v: number, min: number, max: number): number {
  if (!Number.isFinite(v)) return min;
  return Math.max(min, Math.min(max, Math.floor(v)));
}

function newId(): string {
  const c = globalThis.crypto as unknown as undefined | { randomUUID?: () => string };
  return c?.randomUUID?.() ?? `id_${Math.random().toString(36).slice(2, 10)}`;
}

