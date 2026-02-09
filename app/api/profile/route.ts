import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getEntitlements } from "@/lib/billing/entitlements";
import type {
  AvailabilityData,
  PreferencesData,
  GuardrailsData,
} from "@/lib/types/profile";
import {
  BIRTH_YEAR_MIN,
  BIRTH_YEAR_MAX,
  RAMP_RATE_MIN,
  RAMP_RATE_MAX,
} from "@/lib/types/profile";

function parseAvailability(
  v: unknown
): AvailabilityData | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  const days = o.daysAvailable;
  const daysArr = Array.isArray(days)
    ? days.filter((d) => typeof d === "number" && d >= 0 && d <= 6)
    : undefined;
  const max = o.maxMinutesPerDay;
  const maxNum =
    max === null
      ? null
      : typeof max === "number" && max >= 15 && max <= 480
        ? max
        : undefined;
  const preferred =
    o.preferredTime === "morning" ||
    o.preferredTime === "evening" ||
    o.preferredTime === "any"
      ? o.preferredTime
      : undefined;
  const rest =
    typeof o.restDaysPreference === "number" &&
    o.restDaysPreference >= 0 &&
    o.restDaysPreference <= 2
      ? o.restDaysPreference
      : undefined;
  const atLeast =
    typeof o.atLeastOneRestDayPerWeek === "boolean"
      ? o.atLeastOneRestDayPerWeek
      : undefined;
  if (
    !daysArr?.length &&
    maxNum === undefined &&
    !preferred &&
    rest == null &&
    atLeast == null
  )
    return null;
  return {
    ...(daysArr?.length && { daysAvailable: daysArr as (0 | 1 | 2 | 3 | 4 | 5 | 6)[] }),
    ...(maxNum !== undefined && { maxMinutesPerDay: maxNum }),
    ...(preferred && { preferredTime: preferred }),
    ...(rest != null && { restDaysPreference: rest }),
    ...(atLeast != null && { atLeastOneRestDayPerWeek: atLeast }),
  };
}

function parsePreferences(v: unknown): PreferencesData | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  const style =
    o.trainingStyle === "volume_first" ||
    o.trainingStyle === "balanced" ||
    o.trainingStyle === "intensity_first"
      ? o.trainingStyle
      : undefined;
  const hard =
    o.hardSessionsPerWeek === 1 ||
    o.hardSessionsPerWeek === 2 ||
    o.hardSessionsPerWeek === 3
      ? o.hardSessionsPerWeek
      : undefined;
  const surface = o.surfacePreference;
  const surfaceArr = Array.isArray(surface)
    ? (surface.filter((s) =>
        ["road", "trail", "treadmill"].includes(String(s))
      ) as ("road" | "trail" | "treadmill")[])
    : undefined;
  const swim =
    o.swimPreference === "pool" ||
    o.swimPreference === "open_water" ||
    o.swimPreference === "both"
      ? o.swimPreference
      : undefined;
  const notes =
    typeof o.notes === "string" && o.notes.trim()
      ? o.notes.trim()
      : undefined;
  if (
    !style &&
    hard == null &&
    !surfaceArr?.length &&
    !swim &&
    !notes
  )
    return null;
  return {
    ...(style && { trainingStyle: style }),
    ...(hard != null && { hardSessionsPerWeek: hard }),
    ...(surfaceArr?.length && { surfacePreference: surfaceArr }),
    ...(swim && { swimPreference: swim }),
    ...(notes && { notes }),
  };
}

function parseGuardrails(v: unknown): GuardrailsData | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  const maxInt =
    typeof o.maxIntensityWhenFatigueHigh === "boolean"
      ? o.maxIntensityWhenFatigueHigh
      : undefined;
  const noTwo =
    typeof o.neverTwoHardRunDaysInRow === "boolean"
      ? o.neverTwoHardRunDaysInRow
      : undefined;
  const ramp =
    typeof o.limitWeeklyRampRatePercent === "number" &&
    o.limitWeeklyRampRatePercent >= RAMP_RATE_MIN &&
    o.limitWeeklyRampRatePercent <= RAMP_RATE_MAX
      ? o.limitWeeklyRampRatePercent
      : undefined;
  if (maxInt == null && noTwo == null && ramp == null) return null;
  return {
    ...(maxInt != null && { maxIntensityWhenFatigueHigh: maxInt }),
    ...(noTwo != null && { neverTwoHardRunDaysInRow: noTwo }),
    ...(ramp != null && { limitWeeklyRampRatePercent: ramp }),
  };
}

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await db.user.findUnique({
      where: { id: session.user.id },
      include: { profile: true },
    });

    const ent = await getEntitlements(session.user.id);
    const planName = ent.plan === "PRO" ? "Pro" : ent.plan === "TRIAL" ? "Trial" : "Free";
    const planStatus = ent.status ?? (ent.plan === "TRIAL" ? "trial" : "none");

    const userWithoutExtras = user ? (({ profile: _profile, ...rest }) => rest)(user) : null;
    return NextResponse.json({
      user: userWithoutExtras,
      profile: user?.profile,
      plan: {
        name: planName,
        status: planStatus,
        trialEndsAt: ent.trialEndsAt?.toISOString() ?? null,
        trialDaysRemaining: ent.trialDaysRemaining,
        currentPeriodEnd: ent.currentPeriodEnd?.toISOString() ?? null,
        cancelAtPeriodEnd: ent.cancelAtPeriodEnd,
      },
    });
  } catch (error) {
    console.error("Get profile error:", error);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();

    // Birth year validation
    let birthYear: number | null = null;
    if (body.birthYear != null && body.birthYear !== "") {
      const val = parseInt(String(body.birthYear), 10);
      if (
        !Number.isNaN(val) &&
        val >= BIRTH_YEAR_MIN &&
        val <= BIRTH_YEAR_MAX
      ) {
        birthYear = val;
      }
    }

    await db.user.update({
      where: { id: session.user.id },
      data: { name: body.name ?? undefined },
    });

    const availability = parseAvailability(body.availability);
    const preferences = parsePreferences(body.preferences);
    const guardrails = parseGuardrails(body.guardrails);

    await db.profile.upsert({
      where: { userId: session.user.id },
      create: {
        userId: session.user.id,
        sportPrimary: body.sportPrimary ?? null,
        experienceLevel: body.experienceLevel ?? null,
        weeklyHoursGoal: body.weeklyHoursGoal ? parseFloat(body.weeklyHoursGoal) : null,
        restingHR: body.restingHR ? parseInt(body.restingHR) : null,
        maxHR: body.maxHR ? parseInt(body.maxHR) : null,
        ftp: body.ftp ? parseInt(body.ftp) : null,
        weight: body.weight ? parseFloat(body.weight) : null,
        height: body.height ? parseFloat(body.height) : null,
        equipmentNotes: body.equipmentNotes ? String(body.equipmentNotes) : null,
        terrainNotes: body.terrainNotes ? String(body.terrainNotes) : null,
        availabilityNotes: body.availabilityNotes
          ? String(body.availabilityNotes)
          : null,
        swimPoolLengthM: body.swimPoolLengthM ? parseInt(body.swimPoolLengthM) : null,
        club: body.club ? String(body.club).trim() || null : null,
        location: body.location ? String(body.location).trim() || null : null,
        timezone: body.timezone ? String(body.timezone).trim() || null : null,
        birthYear,
        availability: availability ? (availability as Prisma.InputJsonValue) : Prisma.DbNull,
        preferences: preferences ? (preferences as Prisma.InputJsonValue) : Prisma.DbNull,
        guardrails: guardrails ? (guardrails as Prisma.InputJsonValue) : Prisma.DbNull,
        zone1Min: body.zone1Min ? parseInt(body.zone1Min) : null,
        zone1Max: body.zone1Max ? parseInt(body.zone1Max) : null,
        zone2Min: body.zone2Min ? parseInt(body.zone2Min) : null,
        zone2Max: body.zone2Max ? parseInt(body.zone2Max) : null,
        zone3Min: body.zone3Min ? parseInt(body.zone3Min) : null,
        zone3Max: body.zone3Max ? parseInt(body.zone3Max) : null,
        zone4Min: body.zone4Min ? parseInt(body.zone4Min) : null,
        zone4Max: body.zone4Max ? parseInt(body.zone4Max) : null,
        zone5Min: body.zone5Min ? parseInt(body.zone5Min) : null,
        zone5Max: body.zone5Max ? parseInt(body.zone5Max) : null,
      },
      update: {
        sportPrimary: body.sportPrimary ?? null,
        experienceLevel: body.experienceLevel ?? null,
        weeklyHoursGoal: body.weeklyHoursGoal ? parseFloat(body.weeklyHoursGoal) : null,
        restingHR: body.restingHR ? parseInt(body.restingHR) : null,
        maxHR: body.maxHR ? parseInt(body.maxHR) : null,
        ftp: body.ftp ? parseInt(body.ftp) : null,
        weight: body.weight ? parseFloat(body.weight) : null,
        height: body.height ? parseFloat(body.height) : null,
        equipmentNotes: body.equipmentNotes ? String(body.equipmentNotes) : null,
        terrainNotes: body.terrainNotes ? String(body.terrainNotes) : null,
        availabilityNotes: body.availabilityNotes
          ? String(body.availabilityNotes)
          : null,
        swimPoolLengthM: body.swimPoolLengthM ? parseInt(body.swimPoolLengthM) : null,
        club: body.club ? String(body.club).trim() || null : null,
        location: body.location ? String(body.location).trim() || null : null,
        timezone: body.timezone ? String(body.timezone).trim() || null : null,
        birthYear,
        availability: availability ? (availability as Prisma.InputJsonValue) : Prisma.DbNull,
        preferences: preferences ? (preferences as Prisma.InputJsonValue) : Prisma.DbNull,
        guardrails: guardrails ? (guardrails as Prisma.InputJsonValue) : Prisma.DbNull,
        zone1Min: body.zone1Min ? parseInt(body.zone1Min) : null,
        zone1Max: body.zone1Max ? parseInt(body.zone1Max) : null,
        zone2Min: body.zone2Min ? parseInt(body.zone2Min) : null,
        zone2Max: body.zone2Max ? parseInt(body.zone2Max) : null,
        zone3Min: body.zone3Min ? parseInt(body.zone3Min) : null,
        zone3Max: body.zone3Max ? parseInt(body.zone3Max) : null,
        zone4Min: body.zone4Min ? parseInt(body.zone4Min) : null,
        zone4Max: body.zone4Max ? parseInt(body.zone4Max) : null,
        zone5Min: body.zone5Min ? parseInt(body.zone5Min) : null,
        zone5Max: body.zone5Max ? parseInt(body.zone5Max) : null,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Update profile error:", error);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
