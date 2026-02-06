/**
 * Season HQ Service
 * Block generation, alert computation, test milestones.
 */

import type { DisciplineFocus } from "@/lib/types/season";

export interface GenerateBlocksInput {
  startDate: Date;
  goalRaceDate: Date;
  maxWeeklyHours: number;
  intensityLimit: "Low" | "Normal" | "High";
  disciplineFocus?: DisciplineFocus | null;
}

export interface GeneratedBlock {
  type: string;
  startDate: Date;
  endDate: Date;
  focus: string;
  targetHours: number;
  targetHoursMin: number;
  targetHoursMax: number;
  targetTSSMin: number;
  targetTSSMax: number;
  focusDiscipline: string;
  focusLabel: string;
}

const INTENSITY_FACTOR = { Low: 55, Normal: 65, High: 75 } as const;

export function generateSeasonBlocks(input: GenerateBlocksInput): GeneratedBlock[] {
  const { startDate, goalRaceDate, maxWeeklyHours, intensityLimit } = input;

  const totalMs = Math.max(0, goalRaceDate.getTime() - startDate.getTime());
  let totalWeeks = Math.max(1, Math.floor(totalMs / (7 * 24 * 60 * 60 * 1000)));

  // Very short season (< 3 weeks): collapse to Base + Taper
  if (totalWeeks < 3) {
    totalWeeks = Math.max(1, totalWeeks);
    const cursor = new Date(startDate);
    cursor.setHours(0, 0, 0, 0);
    const end = new Date(goalRaceDate);
    end.setHours(23, 59, 59, 999);
    const factor = { Low: 55, Normal: 65, High: 75 }[intensityLimit];
    const h = Math.max(2, Math.min(maxWeeklyHours, maxWeeklyHours * 0.8));
    const tssMin = Math.round(h * factor * 0.9);
    const tssMax = Math.round(h * factor * 1.15);
    return [
      {
        type: totalWeeks >= 2 ? "BASE" : "TAPER",
        startDate: new Date(cursor),
        endDate: end,
        focus: totalWeeks >= 2 ? "Short prep" : "Taper",
        targetHours: h,
        targetHoursMin: h * 0.85,
        targetHoursMax: h * 1.1,
        targetTSSMin: Math.round(tssMin * 0.9),
        targetTSSMax: Math.round(tssMax * 1.1),
        focusDiscipline: "MIXED",
        focusLabel: totalWeeks >= 2 ? "Base" : "Taper",
      },
    ];
  }

  const basePct = 0.4;
  const buildPct = 0.35;
  const peakPct = 0.15;
  const taperPct = 0.1;

  const baseWeeks = Math.max(1, Math.round(totalWeeks * basePct));
  const buildWeeks = Math.max(1, Math.round(totalWeeks * buildPct));
  const peakWeeks = Math.max(1, Math.round(totalWeeks * peakPct));
  const taperWeeks = Math.max(1, Math.min(3, Math.round(totalWeeks * taperPct)));

  const factor = INTENSITY_FACTOR[intensityLimit];
  const blocks: GeneratedBlock[] = [];
  const cursor = new Date(startDate);
  cursor.setHours(0, 0, 0, 0);

  const phases = [
    { type: "BASE", weeks: baseWeeks, hoursMult: 0.85, focus: "Aerobic foundation, consistency", focusLabel: "Bike endurance", discipline: "MIXED" },
    { type: "BUILD", weeks: buildWeeks, hoursMult: 1, focus: "Intensity progression, race-specific work", focusLabel: "Run threshold", discipline: "MIXED" },
    { type: "PEAK", weeks: peakWeeks, hoursMult: 1.05, focus: "Race simulation, sharpening", focusLabel: "Swim technique", discipline: "MIXED" },
    { type: "TAPER", weeks: taperWeeks, hoursMult: 0.5, focus: "Volume reduction, freshness", focusLabel: "Recovery", discipline: "MIXED" },
  ];

  let weekIndex = 0;
  for (const phase of phases) {
    let weeksLeft = phase.weeks;
    while (weeksLeft > 0) {
      const isRecoveryWeek = weekIndex > 0 && (weekIndex + 1) % 4 === 0 && phase.type !== "TAPER";
      const weeksThisBlock = isRecoveryWeek ? 1 : Math.min(weeksLeft, 4);
      const mult = isRecoveryWeek ? 0.65 : phase.hoursMult;
      const h = Math.max(2, Math.min(maxWeeklyHours, maxWeeklyHours * mult));
      const tssBase = h * factor;
      const tssMin = Math.round(tssBase * 0.9);
      const tssMax = Math.round(tssBase * 1.15);

      const end = new Date(cursor);
      end.setDate(end.getDate() + weeksThisBlock * 7 - 1);
      end.setHours(23, 59, 59, 999);

      blocks.push({
        type: isRecoveryWeek ? "RECOVERY" : phase.type,
        startDate: new Date(cursor),
        endDate: end,
        focus: isRecoveryWeek ? "Recovery, adaptation" : phase.focus,
        targetHours: h,
        targetHoursMin: h * 0.85,
        targetHoursMax: h * 1.1,
        targetTSSMin: Math.round(tssMin * 0.9),
        targetTSSMax: Math.round(tssMax * 1.1),
        focusDiscipline: phase.discipline,
        focusLabel: isRecoveryWeek ? "Recovery" : phase.focusLabel,
      });

      cursor.setDate(cursor.getDate() + weeksThisBlock * 7);
      weeksLeft -= weeksThisBlock;
      weekIndex += weeksThisBlock;
    }
  }

  return blocks;
}

export interface ComputedAlert {
  type: string;
  severity: "info" | "warn" | "danger";
  title: string;
  message: string;
  why: string;
  ctaLabel: string;
  ctaActionKey: string;
}

export function computeSeasonAlerts(
  seasonId: string,
  blocks: { targetTSSMin?: number | null; targetTSSMax?: number | null; startDate: Date; endDate: Date; type: string }[],
  weeklyTSS: number[] | null,
  compliancePercent: number | null
): ComputedAlert[] {
  const alerts: ComputedAlert[] = [];

  const RAMP_THRESHOLD = 12;
  if (blocks.length >= 2 && weeklyTSS && weeklyTSS.length >= 2) {
    const last = weeklyTSS[weeklyTSS.length - 1];
    const prev = weeklyTSS[weeklyTSS.length - 2];
    if (prev > 0) {
      const rampPct = ((last - prev) / prev) * 100;
      if (rampPct > RAMP_THRESHOLD) {
        alerts.push({
          type: "OVERLOAD_RISK",
          severity: "warn",
          title: "Ramp rate high",
          message: `Weekly load increased by ${Math.round(rampPct)}% — above ${RAMP_THRESHOLD}% threshold.`,
          why: "Rapid load increases raise injury and overtraining risk.",
          ctaLabel: "Review blocks",
          ctaActionKey: "review_blocks",
        });
      }
    }
  }

  if (compliancePercent != null && compliancePercent < 70) {
    alerts.push({
      type: "COMPLIANCE_DROP",
      severity: "warn",
      title: "Compliance slipping",
      message: `Current week compliance is ${compliancePercent}%.`,
      why: "Consistent execution drives results. Consider adjusting targets.",
      ctaLabel: "Adjust targets",
      ctaActionKey: "adjust_targets",
    });
  }

  const now = new Date();
  const taperBlocks = blocks.filter((b) => b.type === "TAPER");
  if (taperBlocks.length > 0) {
    const taperStart = new Date(taperBlocks[0].startDate);
    const daysToTaper = Math.ceil((taperStart.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    if (daysToTaper > 0 && daysToTaper <= 14) {
      alerts.push({
        type: "RACE_PROXIMITY",
        severity: "info",
        title: "Taper approaching",
        message: `Taper starts in ${daysToTaper} days.`,
        why: "A proper taper maximizes race-day performance.",
        ctaLabel: "Start taper",
        ctaActionKey: "start_taper",
      });
    }
  }

  alerts.push({
    type: "MISSING_PROFILE_DATA",
    severity: "info",
    title: "Check your profile",
    message: "Ensure zones, FTP, and PBs are up to date for accurate planning.",
    why: "Complete profile data improves plan quality and intensity prescriptions.",
    ctaLabel: "Add missing data",
    ctaActionKey: "add_missing_data",
  });

  return alerts;
}

export function getTestMilestonesForSport(
  sport: string,
  startDate: Date,
  goalRaceDate: Date
): { name: string; date: Date }[] {
  const tests: { name: string; date: Date }[] = [];
  const mid = new Date(startDate.getTime() + (goalRaceDate.getTime() - startDate.getTime()) * 0.4);
  mid.setHours(12, 0, 0, 0);

  const sportLower = sport.toLowerCase();
  if (sportLower.includes("tri") || sportLower.includes("bike")) {
    tests.push({ name: "FTP Test", date: mid });
  }
  if (sportLower.includes("tri") || sportLower.includes("run")) {
    const runTest = new Date(mid);
    runTest.setDate(runTest.getDate() + 7);
    tests.push({ name: "5k TT", date: runTest });
  }
  if (sportLower.includes("tri") || sportLower.includes("swim")) {
    const swimTest = new Date(mid);
    swimTest.setDate(swimTest.getDate() + 14);
    tests.push({ name: "Swim TT (400m)", date: swimTest });
  }
  if (sportLower.includes("run") && !sportLower.includes("tri")) {
    tests.push({ name: "5k TT", date: mid });
  }

  return tests;
}
