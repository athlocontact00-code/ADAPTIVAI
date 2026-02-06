"use server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  createSeasonManualSchema,
  autoCreateWizardSchema,
  updateBlockSchema,
  createMilestoneSchema,
} from "@/lib/validations/season";
import {
  type SeasonHQ,
  type BlockHQ,
  type BlockType,
  type FocusDiscipline,
  type MilestoneHQ,
  type SeasonAlertHQ,
  type AutoCreateWizardInput,
  type BlockGuardrails,
} from "@/lib/types/season";
import {
  generateSeasonBlocks,
  computeSeasonAlerts,
  getTestMilestonesForSport,
} from "@/lib/services/season-hq.service";

function getWeekStart(d: Date): Date {
  const x = new Date(d);
  const day = x.getDay();
  const diff = x.getDate() - day + (day === 0 ? -6 : 1);
  x.setDate(diff);
  x.setHours(0, 0, 0, 0);
  return x;
}

export async function getSeasonHQ(): Promise<(SeasonHQ & { currentWeekStats?: CurrentWeekStats }) | null> {
  const session = await auth();
  if (!session?.user?.id) return null;

  const today = new Date();
  today.setHours(12, 0, 0, 0);

  const season = await db.season.findFirst({
    where: {
      userId: session.user.id,
      startDate: { lte: today },
      endDate: { gte: today },
    },
    include: {
      trainingBlocks: { orderBy: [{ blockOrder: "asc" }, { startDate: "asc" }] },
      raceEvents: { orderBy: { date: "asc" } },
      seasonAlerts: { where: { dismissedAt: null }, orderBy: { createdAt: "desc" } },
    },
  });

  if (!season) {
    // Fallback: most recent season
    const latest = await db.season.findFirst({
      where: { userId: session.user.id },
      include: {
        trainingBlocks: { orderBy: [{ blockOrder: "asc" }, { startDate: "asc" }] },
        raceEvents: { orderBy: { date: "asc" } },
        seasonAlerts: { where: { dismissedAt: null }, orderBy: { createdAt: "desc" } },
      },
      orderBy: { startDate: "desc" },
    });
    if (!latest) return null;
    const hq = mapSeasonToHQ(latest);
    const weekStats = await fetchCurrentWeekStats(session.user.id, getWeekStart(today));
    return { ...hq, currentWeekStats: weekStats };
  }

  const hq = mapSeasonToHQ(season);
  const weekStats = await fetchCurrentWeekStats(session.user.id, getWeekStart(today));
  return { ...hq, currentWeekStats: weekStats };
}

export interface CurrentWeekStats {
  weekStart: Date;
  weekEnd: Date;
  plannedHours: number;
  doneHours: number;
  plannedTSS: number;
  doneTSS: number;
  compliancePercent: number;
  rampRate: number | null;
  keySessionsCount: number;
}

async function fetchCurrentWeekStats(userId: string, weekStart: Date): Promise<CurrentWeekStats> {
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);
  weekEnd.setHours(23, 59, 59, 999);

  const workouts = await db.workout.findMany({
    where: { userId, date: { gte: weekStart, lte: weekEnd } },
  });

  const planned = workouts.filter((w) => w.planned);
  const completed = workouts.filter((w) => w.completed);
  const plannedHours = planned.reduce((s, w) => s + (w.durationMin || 0) / 60, 0);
  const doneHours = completed.reduce((s, w) => s + (w.durationMin || 0) / 60, 0);
  const plannedTSS = planned.reduce((s, w) => s + (w.tss || 0), 0);
  const doneTSS = completed.reduce((s, w) => s + (w.tss || 0), 0);
  const compliancePercent = planned.length > 0 ? Math.round((completed.filter((w) => w.planned).length / planned.length) * 100) : 0;
  const keySessionsCount = planned.filter((w) => {
    const t = (w.type || "").toLowerCase();
    return t.includes("interval") || t.includes("threshold") || t.includes("vo2") || t.includes("race");
  }).length;

  let rampRate: number | null = null;
  const prevWeekStart = new Date(weekStart);
  prevWeekStart.setDate(prevWeekStart.getDate() - 7);
  const prevWeekEnd = new Date(prevWeekStart);
  prevWeekEnd.setDate(prevWeekEnd.getDate() + 6);
  prevWeekEnd.setHours(23, 59, 59, 999);
  const prevWorkouts = await db.workout.findMany({
    where: { userId, date: { gte: prevWeekStart, lte: prevWeekEnd }, completed: true },
  });
  const prevTSS = prevWorkouts.reduce((s, w) => s + (w.tss || 0), 0);
  if (prevTSS > 0 && doneTSS > 0) {
    rampRate = Math.round(((doneTSS - prevTSS) / prevTSS) * 100);
  }

  return {
    weekStart,
    weekEnd,
    plannedHours,
    doneHours,
    plannedTSS,
    doneTSS,
    compliancePercent,
    rampRate,
    keySessionsCount,
  };
}

function safeParseJson<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function mapSeasonToHQ(s: {
  id: string;
  name: string;
  sport: string | null;
  startDate: Date;
  endDate: Date;
  goalRaceDate: Date | null;
  primaryGoal: string | null;
  planRigidity: string | null;
  constraints: string | null;
  disciplineFocus: string | null;
  trainingBlocks: unknown[];
  raceEvents: unknown[];
  seasonAlerts?: { id: string; type: string; severity: string; title: string; message: string; why: string | null; ctaLabel: string | null; ctaActionKey: string | null; dismissedAt: Date | null }[];
}): SeasonHQ {
  const constraints = safeParseJson(s.constraints ?? null, null);
  const disciplineFocus = safeParseJson(s.disciplineFocus ?? null, null);
  return {
    id: s.id,
    name: s.name,
    sport: s.sport || "Triathlon",
    startDate: s.startDate,
    endDate: s.endDate,
    goalRaceDate: s.goalRaceDate,
    primaryGoal: s.primaryGoal,
    planRigidity: s.planRigidity as SeasonHQ["planRigidity"],
    constraints,
    disciplineFocus,
    trainingBlocks: (s.trainingBlocks as Parameters<typeof mapBlockToHQ>[0][]).map(mapBlockToHQ),
    raceEvents: (s.raceEvents as Parameters<typeof mapMilestoneToHQ>[0][]).map(mapMilestoneToHQ),
    seasonAlerts: s.seasonAlerts?.map(mapAlertToHQ) ?? [],
  };
}

function mapBlockToHQ(b: {
  id: string;
  type: string;
  startDate: Date;
  endDate: Date;
  focus: string | null;
  targetHours: number | null;
  targetHoursMin: number | null;
  targetHoursMax: number | null;
  targetTSSMin: number | null;
  targetTSSMax: number | null;
  focusDiscipline: string | null;
  focusLabel: string | null;
  intensityCap: number | null;
  guardrails: string | null;
  blockOrder: number;
}): BlockHQ {
  const guardrails = safeParseJson(b.guardrails ?? null, null);
  return {
    id: b.id,
    type: b.type as BlockType,
    startDate: b.startDate,
    endDate: b.endDate,
    focus: b.focus,
    targetHours: b.targetHours,
    targetHoursMin: b.targetHoursMin,
    targetHoursMax: b.targetHoursMax,
    targetTSSMin: b.targetTSSMin,
    targetTSSMax: b.targetTSSMax,
    focusDiscipline: b.focusDiscipline as FocusDiscipline | null,
    focusLabel: b.focusLabel,
    intensityCap: b.intensityCap,
    guardrails,
    blockOrder: b.blockOrder ?? 0,
  };
}

function mapMilestoneToHQ(m: any): MilestoneHQ {
  return {
    id: m.id,
    name: m.name,
    date: m.date,
    distance: m.distance,
    priority: m.priority,
    kind: m.kind,
    goalTime: m.goalTime,
    notes: m.notes,
  };
}

function mapAlertToHQ(a: any): SeasonAlertHQ {
  return {
    id: a.id,
    type: a.type,
    severity: a.severity,
    title: a.title,
    message: a.message,
    why: a.why,
    ctaLabel: a.ctaLabel,
    ctaActionKey: a.ctaActionKey,
    dismissedAt: a.dismissedAt,
  };
}

export async function createSeasonManual(data: {
  name: string;
  sport?: string;
  startDate: string;
  endDate: string;
  goalRaceDate?: string;
  primaryGoal?: string;
}) {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: "Unauthorized" };

  const parsed = createSeasonManualSchema.safeParse(data);
  if (!parsed.success) {
    const msg = parsed.error.errors[0]?.message ?? "Validation failed";
    if (process.env.NODE_ENV === "development") {
      console.warn("[Season] createSeasonManual validation:", parsed.error.format());
    }
    return { success: false, error: msg };
  }

  try {
    const d = parsed.data;
    const season = await db.season.create({
      data: {
        userId: session.user.id,
        name: d.name,
        sport: d.sport || "Triathlon",
        startDate: new Date(d.startDate),
        endDate: new Date(d.endDate),
        goalRaceDate: d.goalRaceDate ? new Date(d.goalRaceDate) : null,
        primaryGoal: d.primaryGoal || null,
      },
    });
    return { success: true, data: season };
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.error("[Season] createSeasonManual error:", error);
    }
    return { success: false, error: "Failed to create season" };
  }
}

export async function autoCreateSeasonWizard(input: AutoCreateWizardInput) {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: "Unauthorized" };

  const parsed = autoCreateWizardSchema.safeParse(input);
  if (!parsed.success) {
    const msg = parsed.error.errors[0]?.message ?? "Validation failed";
    if (process.env.NODE_ENV === "development") {
      console.warn("[Season] autoCreateSeasonWizard validation:", parsed.error.format());
    }
    return { success: false, error: msg };
  }

  const inputData = parsed.data;
  try {
    const blocks = generateSeasonBlocks({
      startDate: new Date(inputData.startDate),
      goalRaceDate: new Date(inputData.goalRaceDate),
      maxWeeklyHours: inputData.maxWeeklyHours,
      intensityLimit: inputData.intensityLimit,
      disciplineFocus: inputData.disciplineFocus ?? undefined,
    });

    const season = await db.season.create({
      data: {
        userId: session.user.id,
        name: inputData.name || `${new Date(inputData.goalRaceDate).getFullYear()} ${inputData.sport} Season`,
        sport: inputData.sport || "Triathlon",
        startDate: new Date(inputData.startDate),
        endDate: new Date(inputData.goalRaceDate),
        goalRaceDate: new Date(inputData.goalRaceDate),
        primaryGoal: `A-Race: ${inputData.raceType} on ${new Date(inputData.goalRaceDate).toLocaleDateString("en-US")}`,
        planRigidity: inputData.planRigidity as "LOCKED" | "SEMI_LOCKED" | "FLEXIBLE",
        constraints: JSON.stringify({
          maxWeeklyHours: inputData.maxWeeklyHours,
          availability: inputData.availability,
          intensityLimit: inputData.intensityLimit,
          injuryNote: inputData.injuryToggle ? inputData.injuryNote : undefined,
        }),
        disciplineFocus: JSON.stringify(inputData.disciplineFocus ?? {}),
      },
    });

    for (let i = 0; i < blocks.length; i++) {
      const b = blocks[i];
      await db.trainingBlock.create({
        data: {
          seasonId: season.id,
          userId: session.user.id,
          type: b.type,
          startDate: b.startDate,
          endDate: b.endDate,
          focus: b.focus,
          targetHours: b.targetHours,
          targetHoursMin: b.targetHoursMin,
          targetHoursMax: b.targetHoursMax,
          targetTSSMin: b.targetTSSMin,
          targetTSSMax: b.targetTSSMax,
          focusDiscipline: b.focusDiscipline as any,
          focusLabel: b.focusLabel,
          blockOrder: i,
        },
      });
    }

    const testMilestones = getTestMilestonesForSport(
      inputData.sport,
      new Date(inputData.startDate),
      new Date(inputData.goalRaceDate)
    );
    for (const m of testMilestones) {
      await db.raceEvent.create({
        data: {
          seasonId: season.id,
          userId: session.user.id,
          name: m.name,
          date: m.date,
          priority: "C",
          kind: "TEST",
        },
      });
    }

    const alerts = computeSeasonAlerts(season.id, blocks, null, null);
    for (const a of alerts) {
      await db.seasonAlert.create({
        data: {
          seasonId: season.id,
          type: a.type,
          severity: a.severity,
          title: a.title,
          message: a.message,
          why: a.why,
          ctaLabel: a.ctaLabel,
          ctaActionKey: a.ctaActionKey,
        },
      });
    }

    return { success: true, data: season };
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.error("[Season] autoCreateSeasonWizard error:", error);
    }
    return { success: false, error: "Failed to create season" };
  }
}

export async function updateSeason(
  id: string,
  data: Partial<{ name: string; sport: string; startDate: string; endDate: string; goalRaceDate: string; primaryGoal: string }>
) {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: "Unauthorized" };

  try {
    const existing = await db.season.findFirst({ where: { id, userId: session.user.id } });
    if (!existing) return { success: false, error: "Season not found" };

    const payload: any = {};
    if (data.name != null) payload.name = data.name;
    if (data.sport != null) payload.sport = data.sport;
    if (data.startDate != null) payload.startDate = new Date(data.startDate);
    if (data.endDate != null) payload.endDate = new Date(data.endDate);
    if (data.goalRaceDate != null) payload.goalRaceDate = new Date(data.goalRaceDate);
    if (data.primaryGoal != null) payload.primaryGoal = data.primaryGoal;

    await db.season.update({
      where: { id },
      data: payload,
    });
    return { success: true };
  } catch (error) {
    console.error("Error updating season:", error);
    return { success: false, error: "Failed to update season" };
  }
}

export async function createBlock(data: {
  seasonId: string;
  type: string;
  startDate: string;
  endDate: string;
  focus?: string;
  targetHours?: number;
  targetHoursMin?: number;
  targetHoursMax?: number;
  targetTSSMin?: number;
  targetTSSMax?: number;
  focusDiscipline?: string;
  focusLabel?: string;
  intensityCap?: number;
  guardrails?: BlockGuardrails;
}) {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: "Unauthorized" };

  try {
    const maxOrder = await db.trainingBlock.aggregate({
      where: { seasonId: data.seasonId },
      _max: { blockOrder: true },
    });
    const block = await db.trainingBlock.create({
      data: {
        seasonId: data.seasonId,
        userId: session.user.id,
        type: data.type,
        startDate: new Date(data.startDate),
        endDate: new Date(data.endDate),
        focus: data.focus || null,
        targetHours: data.targetHours ?? null,
        targetHoursMin: data.targetHoursMin ?? null,
        targetHoursMax: data.targetHoursMax ?? null,
        targetTSSMin: data.targetTSSMin ?? null,
        targetTSSMax: data.targetTSSMax ?? null,
        focusDiscipline: (data.focusDiscipline as any) ?? null,
        focusLabel: data.focusLabel || null,
        intensityCap: data.intensityCap ?? null,
        guardrails: data.guardrails ? JSON.stringify(data.guardrails) : null,
        blockOrder: (maxOrder._max.blockOrder ?? -1) + 1,
      },
    });
    return { success: true, data: block };
  } catch (error) {
    console.error("Error creating block:", error);
    return { success: false, error: "Failed to create block" };
  }
}

export async function updateBlock(
  id: string,
  data: Partial<{
    type: string;
    startDate: string;
    endDate: string;
    focus: string;
    targetHours: number;
    targetHoursMin: number;
    targetHoursMax: number;
    targetTSSMin: number;
    targetTSSMax: number;
    focusDiscipline: string;
    focusLabel: string;
    intensityCap: number;
    guardrails: BlockGuardrails;
  }>
) {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: "Unauthorized" };

  try {
    const payload: any = {};
    if (data.type != null) payload.type = data.type;
    if (data.startDate != null) payload.startDate = new Date(data.startDate);
    if (data.endDate != null) payload.endDate = new Date(data.endDate);
    if (data.focus != null) payload.focus = data.focus;
    if (data.targetHours != null) payload.targetHours = data.targetHours;
    if (data.targetHoursMin != null) payload.targetHoursMin = data.targetHoursMin;
    if (data.targetHoursMax != null) payload.targetHoursMax = data.targetHoursMax;
    if (data.targetTSSMin != null) payload.targetTSSMin = data.targetTSSMin;
    if (data.targetTSSMax != null) payload.targetTSSMax = data.targetTSSMax;
    if (data.focusDiscipline != null) payload.focusDiscipline = data.focusDiscipline;
    if (data.focusLabel != null) payload.focusLabel = data.focusLabel;
    if (data.intensityCap != null) payload.intensityCap = data.intensityCap;
    if (data.guardrails != null) payload.guardrails = JSON.stringify(data.guardrails);

    await db.trainingBlock.update({
      where: { id, userId: session.user.id },
      data: payload,
    });
    return { success: true };
  } catch (error) {
    console.error("Error updating block:", error);
    return { success: false, error: "Failed to update block" };
  }
}

export async function reorderBlocks(seasonId: string, blockIds: string[]) {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: "Unauthorized" };

  try {
    for (let i = 0; i < blockIds.length; i++) {
      await db.trainingBlock.updateMany({
        where: { id: blockIds[i], seasonId, userId: session.user.id },
        data: { blockOrder: i },
      });
    }
    return { success: true };
  } catch (error) {
    console.error("Error reordering blocks:", error);
    return { success: false, error: "Failed to reorder blocks" };
  }
}

export async function deleteBlock(id: string) {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: "Unauthorized" };

  try {
    await db.trainingBlock.delete({
      where: { id, userId: session.user.id },
    });
    return { success: true };
  } catch (error) {
    return { success: false, error: "Failed to delete block" };
  }
}

export async function createMilestone(data: {
  seasonId: string;
  name: string;
  date: string;
  kind?: string;
  distance?: string;
  priority?: string;
  goalTime?: string;
  notes?: string;
}) {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: "Unauthorized" };

  try {
    const milestone = await db.raceEvent.create({
      data: {
        seasonId: data.seasonId,
        userId: session.user.id,
        name: data.name,
        date: new Date(data.date),
        kind: (data.kind as any) || "A_RACE",
        distance: data.distance || null,
        priority: data.priority || "A",
        goalTime: data.goalTime || null,
        notes: data.notes || null,
      },
    });
    return { success: true, data: milestone };
  } catch (error) {
    console.error("Error creating milestone:", error);
    return { success: false, error: "Failed to create milestone" };
  }
}

export async function updateMilestone(
  id: string,
  data: Partial<{ name: string; date: string; kind: string; distance: string; priority: string; goalTime: string; notes: string }>
) {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: "Unauthorized" };

  try {
    const payload: any = {};
    if (data.name != null) payload.name = data.name;
    if (data.date != null) payload.date = new Date(data.date);
    if (data.kind != null) payload.kind = data.kind;
    if (data.distance != null) payload.distance = data.distance;
    if (data.priority != null) payload.priority = data.priority;
    if (data.goalTime != null) payload.goalTime = data.goalTime;
    if (data.notes != null) payload.notes = data.notes;

    await db.raceEvent.update({
      where: { id, userId: session.user.id },
      data: payload,
    });
    return { success: true };
  } catch (error) {
    return { success: false, error: "Failed to update milestone" };
  }
}

export async function deleteMilestone(id: string) {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: "Unauthorized" };

  try {
    await db.raceEvent.delete({
      where: { id, userId: session.user.id },
    });
    return { success: true };
  } catch (error) {
    return { success: false, error: "Failed to delete milestone" };
  }
}

export async function dismissSeasonAlert(id: string) {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: "Unauthorized" };

  try {
    const alert = await db.seasonAlert.findFirst({
      where: { id },
      include: { season: true },
    });
    if (!alert || alert.season.userId !== session.user.id) {
      return { success: false, error: "Not found" };
    }
    await db.seasonAlert.update({
      where: { id },
      data: { dismissedAt: new Date() },
    });
    return { success: true };
  } catch (error) {
    return { success: false, error: "Failed to dismiss alert" };
  }
}

export async function autoCreateBlocks(seasonId: string) {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: "Unauthorized" };

  try {
    const season = await db.season.findFirst({
      where: { id: seasonId, userId: session.user.id },
      include: { trainingBlocks: true },
    });
    if (!season || season.trainingBlocks.length > 0) {
      return { success: false, error: "Season not found or already has blocks" };
    }

    const constraints = season.constraints ? JSON.parse(season.constraints) : {};
    const disciplineFocus = season.disciplineFocus ? JSON.parse(season.disciplineFocus) : null;
    const goalDate = season.goalRaceDate || season.endDate;

    const blocks = generateSeasonBlocks({
      startDate: season.startDate,
      goalRaceDate: goalDate,
      maxWeeklyHours: constraints.maxWeeklyHours || 12,
      intensityLimit: constraints.intensityLimit || "Normal",
      disciplineFocus,
    });

    for (let i = 0; i < blocks.length; i++) {
      const b = blocks[i];
      await db.trainingBlock.create({
        data: {
          seasonId: season.id,
          userId: session.user.id,
          type: b.type,
          startDate: b.startDate,
          endDate: b.endDate,
          focus: b.focus,
          targetHours: b.targetHours,
          targetHoursMin: b.targetHoursMin,
          targetHoursMax: b.targetHoursMax,
          targetTSSMin: b.targetTSSMin,
          targetTSSMax: b.targetTSSMax,
          focusDiscipline: b.focusDiscipline as any,
          focusLabel: b.focusLabel,
          blockOrder: i,
        },
      });
    }

    return { success: true };
  } catch (error) {
    console.error("Error auto-creating blocks:", error);
    return { success: false, error: "Failed to create blocks" };
  }
}
