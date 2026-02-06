/**
 * Season HQ input validation (zod)
 */

import { z } from "zod";

export const createSeasonManualSchema = z
  .object({
    name: z.string().min(1, "Name is required").max(120),
    sport: z.string().optional().default("Triathlon"),
    startDate: z.string().min(1, "Start date is required"),
    endDate: z.string().min(1, "End date is required"),
    goalRaceDate: z.string().optional(),
    primaryGoal: z.string().max(500).optional(),
  })
  .refine(
    (d) => {
      if (!d.startDate || !d.endDate) return true;
      return new Date(d.startDate) <= new Date(d.endDate);
    },
    { message: "Start date must be before or equal to end date", path: ["startDate"] }
  )
  .refine(
    (d) => {
      if (!d.goalRaceDate || !d.startDate) return true;
      return new Date(d.goalRaceDate) >= new Date(d.startDate);
    },
    { message: "Goal race date must be on or after start date", path: ["goalRaceDate"] }
  );

export const autoCreateWizardSchema = z
  .object({
    name: z.string().max(120).optional().default(""),
    sport: z.string().min(1).default("Triathlon"),
    goalRaceDate: z.string().min(1, "Goal race date is required"),
    raceType: z.string().min(1).default("70.3"),
    startDate: z.string().min(1, "Start date is required"),
    maxWeeklyHours: z.number().min(4).max(30).default(12),
    availability: z.array(z.number().min(0).max(6)).default([1, 2, 3, 4, 5, 6, 0]),
    intensityLimit: z.enum(["Low", "Normal", "High"]),
    injuryToggle: z.boolean().default(false),
    injuryNote: z.string().max(500).optional().default(""),
    planRigidity: z.enum(["LOCKED", "SEMI_LOCKED", "FLEXIBLE"]),
    disciplineFocus: z.record(z.string(), z.number()).optional(),
  })
  .refine(
    (d) => new Date(d.goalRaceDate) >= new Date(d.startDate),
    { message: "Goal race date must be on or after start date", path: ["goalRaceDate"] }
  );

export const updateBlockSchema = z.object({
  type: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  focus: z.string().nullable().optional(),
  targetHoursMin: z.number().optional(),
  targetHoursMax: z.number().optional(),
  targetTSSMin: z.number().optional(),
  targetTSSMax: z.number().optional(),
  focusDiscipline: z.string().optional(),
  focusLabel: z.string().nullable().optional(),
  guardrails: z
    .object({
      maxHardSessionsPerWeek: z.number().optional(),
      rampRateLimit: z.number().optional(),
    })
    .optional(),
});

export const createMilestoneSchema = z.object({
  seasonId: z.string().min(1),
  name: z.string().min(1, "Name is required").max(120),
  date: z.string().min(1, "Date is required"),
  kind: z.string().optional(),
  distance: z.string().max(80).optional(),
  priority: z.string().optional(),
  goalTime: z.string().max(20).optional(),
  notes: z.string().max(500).optional(),
});
