/**
 * AthleteContext — unified context for AI Coach.
 * Single source of truth: profile, HR zones, benchmarks, AI settings, derived targets.
 */

import { db } from "@/lib/db";
import {
  getRunPaceZones,
  getSwimPaceZones,
  getBikePowerZones,
  type RunBenchmarks,
  type SwimBenchmarks,
  type BikeBenchmarks,
  type PaceZoneLabel,
} from "@/lib/plans/pace-zones";

export type AthleteContextIdentity = {
  club: string | null;
  location: string | null;
  timezone: string | null;
  birthYear: number | null;
};

export type AthleteContextProfile = {
  name: string | null;
  email: string | null;
  weight: number | null;
  height: number | null;
  primarySport: string | null;
  experienceLevel: string | null;
  weeklyHoursGoal: number | null;
  poolLength: number | null;
  restingHR: number | null;
  maxHR: number | null;
};

export type AthleteContextHRZone = {
  min: number | null;
  max: number | null;
};

export type AthleteContextPerformanceBenchmarks = {
  swim: {
    cssPaceSecPer100: number | null;
    time100Sec: number | null;
    time200Sec: number | null;
    time400Sec: number | null;
    time1500Sec: number | null;
  };
  run: {
    time5kSec: number | null;
    time10kSec: number | null;
    thresholdPaceSecPerKm: number | null;
    halfMarathonSec: number | null;
    marathonSec: number | null;
  };
  bike: {
    ftp: number | null;
    best20minWatts: number | null;
  };
};

export type AthleteContextAISettings = {
  planRigidity: string | null;
  coachingStyle: string | null;
  explainabilityLevel: string | null;
};

export type AthleteContextAvailability = {
  notes: string | null;
  daysAvailable?: number[];
  maxMinutesPerDay?: number;
  preferredTime?: string;
  restDaysPreference?: number;
  atLeastOneRestDayPerWeek?: boolean;
};

export type AthleteContextPreferences = {
  trainingStyle?: string;
  hardSessionsPerWeek?: number;
  surfacePreference?: string[];
  swimPreference?: string;
  notes?: string;
};

export type AthleteContextGuardrails = {
  maxIntensityWhenFatigueHigh?: boolean;
  neverTwoHardRunDaysInRow?: boolean;
  limitWeeklyRampRatePercent?: number;
};

export type AthleteContextTerrain = {
  notes: string | null;
};

export type AthleteContextEquipment = {
  notes: string | null;
};

export type AthleteContext = {
  profile: AthleteContextProfile;
  identity: AthleteContextIdentity | null;
  heartRateZones: {
    zone1: AthleteContextHRZone;
    zone2: AthleteContextHRZone;
    zone3: AthleteContextHRZone;
    zone4: AthleteContextHRZone;
    zone5: AthleteContextHRZone;
  };
  performanceBenchmarks: AthleteContextPerformanceBenchmarks;
  aiSettings: AthleteContextAISettings;
  availability: AthleteContextAvailability | null;
  preferences: AthleteContextPreferences | null;
  guardrails: AthleteContextGuardrails | null;
  terrain: AthleteContextTerrain | null;
  equipment: AthleteContextEquipment | null;
};

export type RunTrainingPaces = PaceZoneLabel;

export type SwimPaces = PaceZoneLabel;

export type BikeTargets = PaceZoneLabel;

/**
 * Fetches full AthleteContext for AI from DB.
 */
export async function getAthleteContextForAI(userId: string): Promise<AthleteContext | null> {
  const [user, profile, benchmarks] = await Promise.all([
    db.user.findUnique({
      where: { id: userId },
      select: { email: true, name: true },
    }),
    db.profile.findUnique({
      where: { userId },
      select: {
        weight: true,
        height: true,
        restingHR: true,
        maxHR: true,
        ftp: true,
        sportPrimary: true,
        experienceLevel: true,
        weeklyHoursGoal: true,
        swimPoolLengthM: true,
        planRigidity: true,
        equipmentNotes: true,
        terrainNotes: true,
        availabilityNotes: true,
        club: true,
        location: true,
        timezone: true,
        birthYear: true,
        availability: true,
        preferences: true,
        guardrails: true,
      },
    }),
    db.performanceBenchmarks.findUnique({
      where: { userId },
    }),
  ]);

  const profileWithZones = await db.profile.findUnique({
    where: { userId },
    select: {
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
    },
  });

  const userWithPrefs = await db.user.findUnique({
    where: { id: userId },
    select: { tonePreference: true, explainLevel: true },
  });

  if (!profile) return null;

  const availRaw = profile.availability as Record<string, unknown> | null;
  const availStructured: AthleteContextAvailability | null = availRaw
    ? {
        notes: profile.availabilityNotes ?? null,
        daysAvailable: Array.isArray(availRaw.daysAvailable)
          ? (availRaw.daysAvailable as number[])
          : undefined,
        maxMinutesPerDay:
          typeof availRaw.maxMinutesPerDay === "number"
            ? availRaw.maxMinutesPerDay
            : undefined,
        preferredTime:
          typeof availRaw.preferredTime === "string"
            ? availRaw.preferredTime
            : undefined,
        restDaysPreference:
          typeof availRaw.restDaysPreference === "number"
            ? availRaw.restDaysPreference
            : undefined,
        atLeastOneRestDayPerWeek:
          typeof availRaw.atLeastOneRestDayPerWeek === "boolean"
            ? availRaw.atLeastOneRestDayPerWeek
            : undefined,
      }
    : profile.availabilityNotes
      ? { notes: profile.availabilityNotes }
      : null;

  const prefsRaw = profile.preferences as Record<string, unknown> | null;
  const prefsStructured: AthleteContextPreferences | null = prefsRaw
    ? {
        trainingStyle:
          typeof prefsRaw.trainingStyle === "string"
            ? prefsRaw.trainingStyle
            : undefined,
        hardSessionsPerWeek:
          typeof prefsRaw.hardSessionsPerWeek === "number"
            ? prefsRaw.hardSessionsPerWeek
            : undefined,
        surfacePreference: Array.isArray(prefsRaw.surfacePreference)
          ? (prefsRaw.surfacePreference as string[])
          : undefined,
        swimPreference:
          typeof prefsRaw.swimPreference === "string"
            ? prefsRaw.swimPreference
            : undefined,
        notes:
          typeof prefsRaw.notes === "string" ? prefsRaw.notes : undefined,
      }
    : null;

  const guardRaw = profile.guardrails as Record<string, unknown> | null;
  const guardStructured: AthleteContextGuardrails | null = guardRaw
    ? {
        maxIntensityWhenFatigueHigh:
          typeof guardRaw.maxIntensityWhenFatigueHigh === "boolean"
            ? guardRaw.maxIntensityWhenFatigueHigh
            : undefined,
        neverTwoHardRunDaysInRow:
          typeof guardRaw.neverTwoHardRunDaysInRow === "boolean"
            ? guardRaw.neverTwoHardRunDaysInRow
            : undefined,
        limitWeeklyRampRatePercent:
          typeof guardRaw.limitWeeklyRampRatePercent === "number"
            ? guardRaw.limitWeeklyRampRatePercent
            : undefined,
      }
    : null;

  const identity: AthleteContextIdentity | null =
    profile.club ||
    profile.location ||
    profile.timezone ||
    profile.birthYear != null
      ? {
          club: profile.club ?? null,
          location: profile.location ?? null,
          timezone: profile.timezone ?? null,
          birthYear: profile.birthYear ?? null,
        }
      : null;

  const ctx: AthleteContext = {
    profile: {
      name: user?.name ?? null,
      email: user?.email ?? null,
      weight: profile.weight ?? null,
      height: profile.height ?? null,
      primarySport: profile.sportPrimary ?? null,
      experienceLevel: profile.experienceLevel ?? null,
      weeklyHoursGoal: profile.weeklyHoursGoal ?? null,
      poolLength: profile.swimPoolLengthM ?? null,
      restingHR: profile.restingHR ?? null,
      maxHR: profile.maxHR ?? null,
    },
    identity,
    heartRateZones: {
      zone1: {
        min: profileWithZones?.zone1Min ?? null,
        max: profileWithZones?.zone1Max ?? null,
      },
      zone2: {
        min: profileWithZones?.zone2Min ?? null,
        max: profileWithZones?.zone2Max ?? null,
      },
      zone3: {
        min: profileWithZones?.zone3Min ?? null,
        max: profileWithZones?.zone3Max ?? null,
      },
      zone4: {
        min: profileWithZones?.zone4Min ?? null,
        max: profileWithZones?.zone4Max ?? null,
      },
      zone5: {
        min: profileWithZones?.zone5Min ?? null,
        max: profileWithZones?.zone5Max ?? null,
      },
    },
    performanceBenchmarks: {
      swim: {
        cssPaceSecPer100: benchmarks?.swimCssSecPer100 ?? null,
        time100Sec: benchmarks?.swim100TimeSec ?? null,
        time200Sec: benchmarks?.swim200TimeSec ?? null,
        time400Sec: benchmarks?.swim400TimeSec ?? null,
        time1500Sec: benchmarks?.swim1500TimeSec ?? null,
      },
      run: {
        time5kSec: benchmarks?.run5kTimeSec ?? null,
        time10kSec: benchmarks?.run10kTimeSec ?? null,
        thresholdPaceSecPerKm: benchmarks?.runThresholdSecPerKm ?? null,
        halfMarathonSec: benchmarks?.runHmTimeSec ?? null,
        marathonSec: benchmarks?.runMarathonTimeSec ?? null,
      },
      bike: {
        ftp: null,
        best20minWatts: benchmarks?.bikeBest20minWatts ?? null,
      },
    },
    aiSettings: {
      planRigidity: profile.planRigidity ?? null,
      coachingStyle: (userWithPrefs?.tonePreference as string) ?? null,
      explainabilityLevel: (userWithPrefs?.explainLevel as string) ?? null,
    },
    availability: availStructured,
    preferences: prefsStructured,
    guardrails: guardStructured,
    terrain: profile.terrainNotes ? { notes: profile.terrainNotes } : null,
    equipment: profile.equipmentNotes ? { notes: profile.equipmentNotes } : null,
  };

  // Bike FTP: prefer profile.ftp, fallback to 95% of best20min
  const bikeFtp =
    profile.ftp ??
    (benchmarks?.bikeBest20minWatts != null
      ? Math.round(benchmarks.bikeBest20minWatts * 0.95)
      : null);
  ctx.performanceBenchmarks.bike.ftp = bikeFtp;

  return ctx;
}

function contextToRunBenchmarks(ctx: AthleteContext): RunBenchmarks | null {
  const r = ctx.performanceBenchmarks.run;
  if (
    !r.time5kSec &&
    !r.time10kSec &&
    !r.thresholdPaceSecPerKm &&
    !r.halfMarathonSec &&
    !r.marathonSec
  )
    return null;
  return {
    run5kTimeSec: r.time5kSec,
    run10kTimeSec: r.time10kSec,
    runThresholdSecPerKm: r.thresholdPaceSecPerKm,
    runHmTimeSec: r.halfMarathonSec,
    runMarathonTimeSec: r.marathonSec,
  };
}

function contextToSwimBenchmarks(ctx: AthleteContext): SwimBenchmarks | null {
  const s = ctx.performanceBenchmarks.swim;
  if (!s.cssPaceSecPer100 || s.cssPaceSecPer100 <= 0) return null;
  return {
    swimCssSecPer100: s.cssPaceSecPer100,
    swim400TimeSec: s.time400Sec,
    swim100TimeSec: s.time100Sec,
  };
}

function contextToBikeBenchmarks(ctx: AthleteContext): BikeBenchmarks | null {
  const b = ctx.performanceBenchmarks.bike;
  const ftp = b.ftp ?? (b.best20minWatts != null ? Math.round(b.best20minWatts * 0.95) : null);
  if (!ftp || ftp <= 0) return null;
  return {
    ftp,
    bikeBest20minWatts: b.best20minWatts,
  };
}

/**
 * Derives run training paces (easy, steady, tempo, threshold, interval) from AthleteContext.
 */
export function deriveRunTrainingPaces(context: AthleteContext | null): RunTrainingPaces {
  if (!context) return {};
  return getRunPaceZones(contextToRunBenchmarks(context));
}

/**
 * Derives swim paces (easy, tempo, threshold, vo2) from AthleteContext (CSS).
 */
export function deriveSwimPaces(context: AthleteContext | null): SwimPaces {
  if (!context) return {};
  return getSwimPaceZones(contextToSwimBenchmarks(context));
}

/**
 * Derives bike power targets from AthleteContext (FTP).
 */
export function deriveBikeTargets(context: AthleteContext | null): BikeTargets {
  if (!context) return {};
  return getBikePowerZones(contextToBikeBenchmarks(context));
}
