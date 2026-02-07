import { z } from "zod";

/** Sport for rubric (uppercase). */
export const rubricSportSchema = z.enum(["SWIM", "BIKE", "RUN", "STRENGTH"]);
export type RubricSport = z.infer<typeof rubricSportSchema>;

/** Single step in warmup/main/cooldown. */
export const rubricStepSchema = z.object({
  description: z.string(),
  durationMin: z.number().int().min(0).optional(),
  distanceM: z.number().int().min(0).optional(),
  restSec: z.number().int().min(0).optional(),
  intensityTarget: z
    .object({
      pace: z.string().optional(),
      hr: z.string().optional(),
      watts: z.string().optional(),
      rpe: z.string().optional(),
      zone: z.string().optional(),
    })
    .optional(),
});
export type RubricStep = z.infer<typeof rubricStepSchema>;

/** Intensity in at least two systems (pace+RPE, HR+RPE, watts+RPE). */
export const intensityTargetsSchema = z.object({
  pace: z.string().optional(),
  hr: z.string().optional(),
  watts: z.string().optional(),
  rpe: z.string().optional(),
  zone: z.string().optional(),
});
export type IntensityTargets = z.infer<typeof intensityTargetsSchema>;

/** Why / explainability. */
export const whyDriversSchema = z.object({
  rationale: z.string(),
  guardrailChecks: z.array(z.string()).optional(),
  adaptationReason: z.string().optional(),
});
export type WhyDrivers = z.infer<typeof whyDriversSchema>;

/** Full workout in rubric format (internal contract). */
export const workoutRubricPrescriptionSchema = z.object({
  sport: rubricSportSchema,
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  title: z.string().min(1),
  durationMin: z.number().int().min(1),
  goal: z.string().min(1),
  warmup: z.array(rubricStepSchema),
  main: z.array(rubricStepSchema),
  cooldown: z.array(rubricStepSchema),
  intensityTargets: intensityTargetsSchema,
  techniqueCues: z.array(z.string()),
  fuelingGuidance: z.string().optional(),
  variantA: z.string().optional(),
  variantB: z.string().optional(),
  successCriteria: z.string().optional(),
  rationale: z.string(),
  why: whyDriversSchema.optional(),
});
export type WorkoutRubricPrescription = z.infer<typeof workoutRubricPrescriptionSchema>;

/** Session intent resolved from user message. */
export const sessionIntentSchema = z.object({
  kind: z.enum(["single", "week"]),
  sport: rubricSportSchema.optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  addToCalendar: z.boolean(),
  createSeparate: z.boolean(),
  durationMinHint: z.number().int().min(1).optional(),
});
export type SessionIntent = z.infer<typeof sessionIntentSchema>;
