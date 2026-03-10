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
vi.mock("@/lib/services/adaptive-day-planner-cache.service", () => ({
  invalidateAdaptiveDayPlannerCacheForDateRange: vi.fn(),
  invalidateAdaptiveDayPlannerCacheForWorkoutDate: vi.fn(),
}));
vi.mock("@/lib/db", () => ({
  db: {
    profile: {
      upsert: vi.fn(),
      findUnique: vi.fn(),
    },
    auditLog: {
      create: vi.fn(),
    },
    planChangeProposal: {
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      findMany: vi.fn(),
    },
    dailyCheckIn: {
      update: vi.fn(),
    },
    workout: {
      update: vi.fn(),
      findUnique: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { track } from "@/lib/analytics/events";
import {
  invalidateAdaptiveDayPlannerCacheForDateRange,
  invalidateAdaptiveDayPlannerCacheForWorkoutDate,
} from "@/lib/services/adaptive-day-planner-cache.service";
import { decidePlanChangeProposal } from "./plan-rigidity";

const setAuthSession = (session: Session | null) => {
  (auth as unknown as { mockResolvedValue: (value: Session | null) => void }).mockResolvedValue(session);
};

describe("decidePlanChangeProposal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setAuthSession({
      user: { id: "user-1", email: "u@example.com" },
      expires: "",
    } as Session);
    vi.mocked(db.auditLog.create).mockResolvedValue({} as never);
    vi.mocked(db.planChangeProposal.update).mockResolvedValue({} as never);
    vi.mocked(db.dailyCheckIn.update).mockResolvedValue({} as never);
    vi.mocked(db.workout.update).mockResolvedValue({} as never);
    vi.mocked(db.workout.delete).mockResolvedValue({} as never);
    vi.mocked(track).mockResolvedValue(undefined as never);
  });

  it("invalidates planner cache for the old and new workout date when proposal is accepted", async () => {
    vi.mocked(db.planChangeProposal.findUnique).mockResolvedValue({
      id: "proposal-1",
      userId: "user-1",
      workoutId: "workout-1",
      checkInId: "checkin-1",
      status: "PENDING",
      sourceType: "DAILY_CHECKIN",
      patchJson: JSON.stringify({
        workout: {
          id: "workout-1",
          update: {
            date: "2026-03-12",
            durationMin: 40,
          },
        },
      }),
    } as never);
    vi.mocked(db.workout.findUnique).mockResolvedValue({
      id: "workout-1",
      userId: "user-1",
      date: new Date(2026, 2, 10, 12, 0, 0, 0),
      planned: true,
      completed: false,
      source: "daily-checkin",
    } as never);

    const result = await decidePlanChangeProposal({
      proposalId: "proposal-1",
      decision: "ACCEPT",
    });

    expect(result).toEqual({ success: true });
    expect(db.workout.update).toHaveBeenCalledWith({
      where: { id: "workout-1" },
      data: expect.objectContaining({
        date: new Date(2026, 2, 12, 12, 0, 0, 0),
        durationMin: 40,
      }),
    });
    expect(invalidateAdaptiveDayPlannerCacheForDateRange).toHaveBeenCalledWith(
      "user-1",
      new Date(2026, 2, 10, 12, 0, 0, 0),
      new Date(2026, 2, 12, 12, 0, 0, 0)
    );
    expect(db.dailyCheckIn.update).toHaveBeenCalledWith({
      where: { id: "checkin-1" },
      data: { userAccepted: true, userOverrideReason: null },
    });
    expect(revalidatePath).toHaveBeenCalledWith("/calendar");
    expect(revalidatePath).toHaveBeenCalledWith("/dashboard");
  });

  it("invalidates planner cache for coach proposal workout date when declined draft workout is deleted", async () => {
    vi.mocked(db.planChangeProposal.findUnique).mockResolvedValue({
      id: "proposal-2",
      userId: "user-1",
      workoutId: "workout-2",
      checkInId: null,
      status: "PENDING",
      sourceType: "COACH",
      patchJson: JSON.stringify({
        workout: {
          id: "workout-2",
          update: {},
        },
      }),
    } as never);
    vi.mocked(db.workout.findUnique).mockResolvedValue({
      id: "workout-2",
      userId: "user-1",
      date: new Date(2026, 2, 11, 12, 0, 0, 0),
      planned: false,
      completed: false,
      source: "coach_proposal",
    } as never);

    const result = await decidePlanChangeProposal({
      proposalId: "proposal-2",
      decision: "DECLINE",
    });

    expect(result).toEqual({ success: true });
    expect(db.workout.delete).toHaveBeenCalledWith({ where: { id: "workout-2" } });
    expect(invalidateAdaptiveDayPlannerCacheForWorkoutDate).toHaveBeenCalledWith(
      "user-1",
      new Date(2026, 2, 11, 12, 0, 0, 0)
    );
    expect(invalidateAdaptiveDayPlannerCacheForDateRange).not.toHaveBeenCalled();
  });

  it("returns not found when proposal does not belong to the current user", async () => {
    vi.mocked(db.planChangeProposal.findUnique).mockResolvedValue({
      id: "proposal-3",
      userId: "other-user",
      workoutId: "workout-3",
      checkInId: null,
      status: "PENDING",
      sourceType: "RULE",
      patchJson: "{}",
    } as never);

    const result = await decidePlanChangeProposal({
      proposalId: "proposal-3",
      decision: "ACCEPT",
    });

    expect(result).toEqual({ success: false, error: "Proposal not found" });
    expect(invalidateAdaptiveDayPlannerCacheForDateRange).not.toHaveBeenCalled();
    expect(invalidateAdaptiveDayPlannerCacheForWorkoutDate).not.toHaveBeenCalled();
  });
});
