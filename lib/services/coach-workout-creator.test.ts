import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({
  db: {
    workout: {
      create: vi.fn(),
    },
    auditLog: {
      create: vi.fn(),
    },
  },
}));
vi.mock("@/lib/actions/coach", () => ({
  buildWorkoutDescriptionMd: vi.fn(),
  buildWorkoutPrescriptionJson: vi.fn(),
}));
vi.mock("@/lib/services/adaptive-day-planner-cache.service", () => ({
  invalidateAdaptiveDayPlannerCacheForWorkoutDate: vi.fn(),
}));

import { db } from "@/lib/db";
import {
  buildWorkoutDescriptionMd,
  buildWorkoutPrescriptionJson,
} from "@/lib/actions/coach";
import { invalidateAdaptiveDayPlannerCacheForWorkoutDate } from "@/lib/services/adaptive-day-planner-cache.service";
import { createWorkoutFromCoach } from "./coach-workout-creator";

describe("createWorkoutFromCoach", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(buildWorkoutDescriptionMd).mockResolvedValue("Workout description" as never);
    vi.mocked(buildWorkoutPrescriptionJson).mockResolvedValue({ steps: [] } as never);
    vi.mocked(db.workout.create).mockResolvedValue({ id: "workout-1" } as never);
    vi.mocked(db.auditLog.create).mockResolvedValue({} as never);
  });

  it("builds template content, persists workout, logs audit event, and invalidates planner cache", async () => {
    const draftDate = new Date(2026, 2, 10, 12, 0, 0, 0);
    const result = await createWorkoutFromCoach({
      userId: "user-1",
      aiContext: {
        userProfile: { swimPoolLengthM: null },
      } as never,
      draft: {
        date: draftDate,
        type: "run",
        durationMin: 50,
        intensity: "moderate",
        title: "Tempo Run",
        tss: 50,
        warmUpText: "10 min easy",
        mainSetText: "4x5 min threshold",
        coolDownText: "10 min easy",
        extraTargets: [{ label: "Pace", value: "4:20-4:30/km" }],
      },
    });

    expect(buildWorkoutDescriptionMd).toHaveBeenCalledWith(
      expect.objectContaining({
        workout: expect.objectContaining({
          title: "Tempo Run",
          aiReason: "Requested by athlete via AI Coach",
        }),
      })
    );
    expect(buildWorkoutPrescriptionJson).toHaveBeenCalled();
    expect(db.workout.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: "user-1",
          title: "Tempo Run",
          type: "run",
          source: "coach",
          descriptionMd: "Workout description",
        }),
      })
    );
    expect(db.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          actionType: "COACH_WORKOUT_CREATED",
          targetId: "workout-1",
        }),
      })
    );
    expect(invalidateAdaptiveDayPlannerCacheForWorkoutDate).toHaveBeenCalledWith("user-1", draftDate);
    expect(result).toEqual({
      id: "workout-1",
      date: draftDate,
      title: "Tempo Run",
      descriptionMd: "Workout description",
    });
  });

  it("supports overriding planned and source", async () => {
    await createWorkoutFromCoach({
      userId: "user-1",
      aiContext: {
        userProfile: { swimPoolLengthM: null },
      } as never,
      planned: false,
      source: "coach_proposal",
      draft: {
        date: new Date(2026, 2, 10, 12, 0, 0, 0),
        type: "strength",
        durationMin: 45,
        intensity: "easy",
        title: "Strength Session",
        tss: 30,
      },
    });

    expect(db.workout.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          planned: false,
          source: "coach_proposal",
        }),
      })
    );
  });
});
