import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Session } from "next-auth";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/db", () => ({
  db: {
    workout: {
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    profile: {
      findUnique: vi.fn(),
    },
    dailyCheckIn: {
      findFirst: vi.fn(),
    },
    performanceBenchmarks: {
      findUnique: vi.fn(),
    },
  },
}));
vi.mock("@/lib/services/plan-rigidity.service", () => ({
  isWorkoutLocked: vi.fn(),
}));
vi.mock("@/lib/actions/plan-rigidity", () => ({
  createPlanChangeProposal: vi.fn(),
}));
vi.mock("@/lib/services/adaptive-day-planner-cache.service", () => ({
  invalidateAdaptiveDayPlannerCacheForWorkoutDate: vi.fn(),
}));

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { isWorkoutLocked } from "@/lib/services/plan-rigidity.service";
import { createPlanChangeProposal } from "@/lib/actions/plan-rigidity";
import { invalidateAdaptiveDayPlannerCacheForWorkoutDate } from "@/lib/services/adaptive-day-planner-cache.service";
import { applyCoachWorkoutPlan } from "./coach-workout-plan";

const setAuthSession = (session: Session | null) => {
  (auth as unknown as { mockResolvedValue: (value: Session | null) => void }).mockResolvedValue(session);
};

const samplePlan = {
  sport: "RUN",
  headline: "Tempo refresh",
  rationale: "Sharpen threshold rhythm.",
  sections: [
    {
      key: "main",
      label: "Main set",
      blocks: [
        {
          key: "main-1",
          label: "Tempo block",
          notes: "3 x 8 min steady",
          targets: [{ label: "RPE", value: "7/10" }],
          steps: [
            {
              key: "step-1",
              kind: "work",
              label: "Tempo",
              durationMin: 24,
              notes: "Controlled tempo running",
            },
          ],
        },
      ],
    },
  ],
} as const;

describe("applyCoachWorkoutPlan", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setAuthSession({
      user: { id: "user-1", email: "u@example.com" },
      expires: "",
    } as Session);
    vi.mocked(db.workout.findFirst).mockResolvedValue({
      id: "workout-1",
      userId: "user-1",
      title: "Tempo Run",
      type: "run",
      date: new Date(2026, 2, 12, 12, 0, 0, 0),
      durationMin: 60,
    } as never);
    vi.mocked(db.profile.findUnique).mockResolvedValue({
      ftp: null,
      swimPoolLengthM: null,
      planRigidity: "LOCKED_1_DAY",
    } as never);
    vi.mocked(db.workout.update).mockResolvedValue({} as never);
    vi.mocked(isWorkoutLocked).mockReturnValue(false);
    vi.mocked(createPlanChangeProposal).mockResolvedValue({
      success: true,
      proposalId: "proposal-1",
    } as never);
  });

  it("invalidates planner cache and revalidates today when updating an unlocked workout", async () => {
    const result = await applyCoachWorkoutPlan({
      workoutId: "workout-1",
      plan: samplePlan as never,
      source: "planned",
      reason: "Use updated coach prescription.",
    });

    expect(result).toEqual({ ok: true, applied: "UPDATED" });
    expect(db.workout.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "workout-1" },
        data: expect.objectContaining({
          aiGenerated: true,
          aiReason: "Use updated coach prescription.",
          aiConfidence: 85,
          source: "coach",
        }),
      })
    );
    expect(invalidateAdaptiveDayPlannerCacheForWorkoutDate).toHaveBeenCalledWith(
      "user-1",
      new Date(2026, 2, 12, 12, 0, 0, 0)
    );
    expect(revalidatePath).toHaveBeenCalledWith("/calendar");
    expect(revalidatePath).toHaveBeenCalledWith("/dashboard");
    expect(revalidatePath).toHaveBeenCalledWith("/today");
    expect(createPlanChangeProposal).not.toHaveBeenCalled();
  });

  it("creates a proposal for a locked workout without invalidating planner cache yet", async () => {
    vi.mocked(isWorkoutLocked).mockReturnValue(true);

    const result = await applyCoachWorkoutPlan({
      workoutId: "workout-1",
      plan: samplePlan as never,
      source: "adjusted",
      reason: "Lower load after check-in.",
    });

    expect(result).toEqual({ ok: true, applied: "PROPOSED", proposalId: "proposal-1" });
    expect(createPlanChangeProposal).toHaveBeenCalledWith(
      expect.objectContaining({
        workoutId: "workout-1",
        sourceType: "COACH",
        confidence: 85,
      })
    );
    expect(db.workout.update).not.toHaveBeenCalled();
    expect(invalidateAdaptiveDayPlannerCacheForWorkoutDate).not.toHaveBeenCalled();
  });
});
