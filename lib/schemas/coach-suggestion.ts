import { z } from "zod";

export const SuggestionScopeSchema = z.enum(["today", "week", "season"]);
export type SuggestionScope = z.infer<typeof SuggestionScopeSchema>;

export const SuggestionTypeSchema = z.enum([
  "ADJUST_INTENSITY",
  "SWAP_SESSION",
  "ADD_RECOVERY",
  "REBALANCE_WEEK",
  "REDUCE_VOLUME",
  "MOVE_SESSION",
  "ADD_EASY_SESSION",
]);
export type SuggestionType = z.infer<typeof SuggestionTypeSchema>;

export const AdjustWorkoutPayloadSchema = z.object({
  kind: z.literal("adjustWorkout"),
  workoutId: z.string(),
  intensityDeltaPct: z.number(),
  volumeDeltaPct: z.number().optional(),
  notes: z.string().optional(),
});

export const SwapWorkoutsPayloadSchema = z.object({
  kind: z.literal("swapWorkouts"),
  fromWorkoutId: z.string(),
  toDate: z.string(),
  replacementWorkoutTemplate: z
    .object({
      type: z.string(),
      durationMin: z.number(),
      title: z.string().optional(),
    })
    .optional(),
});

export const MoveWorkoutPayloadSchema = z.object({
  kind: z.literal("moveWorkout"),
  workoutId: z.string(),
  toDate: z.string(),
});

export const AddRecoveryDayPayloadSchema = z.object({
  kind: z.literal("addRecoveryDay"),
  date: z.string(),
  replacement: z.enum(["rest", "walk", "easy_spin"]),
  durationMin: z.number().optional(),
});

export const RebalanceWeekPayloadSchema = z.object({
  kind: z.literal("rebalanceWeek"),
  rules: z.array(z.string()).optional(),
  changes: z
    .array(
      z.object({
        workoutId: z.string(),
        patch: z.record(z.unknown()),
      })
    )
    .optional(),
});

export const SuggestionPayloadSchema = z.discriminatedUnion("kind", [
  AdjustWorkoutPayloadSchema,
  SwapWorkoutsPayloadSchema,
  MoveWorkoutPayloadSchema,
  AddRecoveryDayPayloadSchema,
  RebalanceWeekPayloadSchema,
]);
export type SuggestionPayload = z.infer<typeof SuggestionPayloadSchema>;

export const AISuggestionSchema = z.object({
  scope: SuggestionScopeSchema,
  type: SuggestionTypeSchema,
  title: z.string().min(1).max(200),
  summary: z.string().min(1).max(300),
  why: z.string().min(1).max(1000),
  payload: SuggestionPayloadSchema,
});

export type AISuggestion = z.infer<typeof AISuggestionSchema>;

export const AISuggestionsResponseSchema = z.object({
  suggestions: z.array(AISuggestionSchema).max(5),
});

export function parseAISuggestionsResponse(raw: unknown): AISuggestion[] {
  const parsed = AISuggestionsResponseSchema.safeParse(raw);
  if (!parsed.success) {
    console.error("[CoachSuggestions] AI response validation failed:", parsed.error.message);
    return [];
  }
  return parsed.data.suggestions;
}
