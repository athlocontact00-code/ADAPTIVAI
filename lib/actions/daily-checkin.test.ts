import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Session } from "next-auth";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/analytics/events", () => ({ track: vi.fn() }));
vi.mock("@/lib/logger", () => ({
  createRequestId: vi.fn(() => "req-1"),
  logError: vi.fn(),
  logInfo: vi.fn(),
}));
vi.mock("@/lib/actions/plan-rigidity", () => ({
  createPlanChangeProposal: vi.fn(),
}));
vi.mock("@/lib/services/plan-rigidity.service", () => ({
  isWorkoutLocked: vi.fn(() => false),
}));
vi.mock("@/lib/services/openai-coach", () => ({
  isOpenAIAvailable: vi.fn(() => false),
}));
vi.mock("@/lib/services/ai-context.builder", () => ({
  buildAIContextForUser: vi.fn(),
}));
vi.mock("@/lib/services/adaptive-day-planner-cache.service", () => ({
  getAdaptiveDayPlannerCacheSnapshot: vi.fn(),
  invalidateAdaptiveDayPlannerCacheForWorkoutDate: vi.fn(),
  persistAdaptiveDayPlannerCache: vi.fn(),
  readAdaptiveDayPlannerCache: vi.fn(),
}));
vi.mock("@/lib/services/adaptive-day-planner.service", () => ({
  buildAdaptiveDayPlanner: vi.fn(),
}));
vi.mock("@/lib/services/adaptive-day-planner-premium.service", () => ({
  derivePremiumConflictSignal: vi.fn(),
  isAdaptivePlannerWorkoutIntense: vi.fn(),
  mapPlannerPatchToConflictSuggestion: vi.fn(),
}));
vi.mock("@/lib/utils/premium-readiness", () => ({
  calculatePremiumReadiness: vi.fn(),
}));
vi.mock("@/lib/db", () => ({
  db: {
    dailyCheckIn: {
      findUnique: vi.fn(),
      update: vi.fn(),
      findMany: vi.fn(),
    },
    workout: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    profile: {
      findUnique: vi.fn(),
    },
    auditLog: {
      create: vi.fn(),
    },
  },
}));

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { track } from "@/lib/analytics/events";
import { invalidateAdaptiveDayPlannerCacheForWorkoutDate } from "@/lib/services/adaptive-day-planner-cache.service";
import { acceptAIRecommendation, acceptConflictSuggestion } from "./daily-checkin";

const setAuthSession = (session: Session | null) => {
  (auth as unknown as { mockResolvedValue: (value: Session | null) => void }).mockResolvedValue(session);
};

describe("daily-checkin planner invalidation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setAuthSession({
      user: { id: "user-1", email: "u@example.com" },
      expires: "",
    } as Session);
    vi.mocked(db.profile.findUnique).mockResolvedValue({
      planRigidity: "LOCKED_1_DAY",
    } as never);
    vi.mocked(db.auditLog.create).mockResolvedValue({} as never);
    vi.mocked(db.dailyCheckIn.update).mockResolvedValue({} as never);
    vi.mocked(db.workout.update).mockResolvedValue({} as never);
    vi.mocked(track).mockResolvedValue(undefined as never);
  });

  it("invalidates planner cache after applying accepted AI recommendation to a workout", async () => {
    vi.mocked(db.dailyCheckIn.findUnique).mockResolvedValue({
      id: "checkin-1",
      userId: "user-1",
      workoutId: "workout-1",
      aiDecision: "SHORTEN",
      aiConfidence: 82,
      aiExplanation: "Reduce load today.",
      aiReasonJson: JSON.stringify({
        readiness_score: 48,
        key_factors: ["Low readiness"],
        recommendation_type: "reduce_volume",
        explanation: "Reduce volume today.",
        changes: {
          apply: true,
          requires_confirmation: false,
          before: {
            title: "Threshold Run",
            type: "run",
            durationMin: 60,
            tss: 80,
          },
          after: {
            title: "Threshold Run (lighter)",
            type: "run",
            durationMin: 40,
            tss: 52,
          },
          rationale: ["Lower load after check-in"],
        },
        coach_message: "Go lighter today.",
      }),
    } as never);
    vi.mocked(db.workout.findUnique).mockResolvedValue({
      id: "workout-1",
      userId: "user-1",
      title: "Threshold Run",
      type: "run",
      date: new Date(2026, 2, 10, 12, 0, 0, 0),
      durationMin: 60,
      tss: 80,
      descriptionMd: null,
      prescriptionJson: null,
      notes: null,
    } as never);

    const result = await acceptAIRecommendation("checkin-1");

    expect(result).toEqual({
      success: true,
      applied: true,
      workoutId: "workout-1",
    });
    expect(db.workout.update).toHaveBeenCalledWith({
      where: { id: "workout-1" },
      data: expect.objectContaining({
        title: "Threshold Run (lighter)",
        type: "run",
        durationMin: 40,
        tss: 52,
        source: "daily-checkin",
      }),
    });
    expect(invalidateAdaptiveDayPlannerCacheForWorkoutDate).toHaveBeenCalledWith(
      "user-1",
      new Date(2026, 2, 10, 12, 0, 0, 0)
    );
    expect(revalidatePath).toHaveBeenCalledWith("/dashboard");
    expect(revalidatePath).toHaveBeenCalledWith("/calendar");
  });

  it("invalidates planner cache after applying accepted conflict suggestion to a workout", async () => {
    vi.mocked(db.dailyCheckIn.findUnique).mockResolvedValue({
      id: "checkin-2",
      userId: "user-1",
      workoutId: "workout-2",
      hasConflict: true,
      suggestedChange: JSON.stringify({
        action: "reduce_duration",
        reason: "Recovery is lower than planned load.",
        durationFactor: 0.75,
        patch: {
          title: "Endurance Ride (lighter)",
          type: "bike",
          durationMin: 45,
          tss: 44,
        },
      }),
      conflictReason: "Recovery is lower than planned load.",
    } as never);
    vi.mocked(db.workout.findUnique).mockResolvedValue({
      id: "workout-2",
      userId: "user-1",
      title: "Endurance Ride",
      type: "bike",
      date: new Date(2026, 2, 11, 12, 0, 0, 0),
      durationMin: 60,
      tss: 60,
      completed: false,
    } as never);

    const result = await acceptConflictSuggestion("checkin-2");

    expect(result).toEqual({
      success: true,
      applied: true,
    });
    expect(db.workout.update).toHaveBeenCalledWith({
      where: { id: "workout-2" },
      data: expect.objectContaining({
        title: "Endurance Ride (lighter)",
        type: "bike",
        durationMin: 45,
        tss: 44,
        source: "daily-checkin-conflict",
      }),
    });
    expect(invalidateAdaptiveDayPlannerCacheForWorkoutDate).toHaveBeenCalledWith(
      "user-1",
      new Date(2026, 2, 11, 12, 0, 0, 0)
    );
    expect(revalidatePath).toHaveBeenCalledWith("/dashboard");
    expect(revalidatePath).toHaveBeenCalledWith("/calendar");
  });
});
