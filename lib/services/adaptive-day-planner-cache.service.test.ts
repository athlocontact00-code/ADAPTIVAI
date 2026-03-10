import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({
  db: {
    todayDecision: {
      findUnique: vi.fn(),
      deleteMany: vi.fn(),
    },
    dailyCheckIn: {
      findUnique: vi.fn(),
    },
    workout: {
      findFirst: vi.fn(),
    },
  },
}));

import { db } from "@/lib/db";
import {
  getAdaptiveDayPlannerCacheSnapshot,
  invalidateAdaptiveDayPlannerCacheForDateRange,
} from "./adaptive-day-planner-cache.service";

function localStartOfDay(value: string): Date {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
}

const plannerPayload = {
  decision: "DO_THIS_WORKOUT" as const,
  state: "READY" as const,
  generatedAt: "2026-03-09T08:00:00.000Z",
  action: {
    title: "Do the planned session",
    details: "Signals are stable enough to keep the plan.",
  },
  why: "No major recovery conflict was detected.",
  confidence: "HIGH" as const,
  reasons: ["Readiness is stable"],
  patchPreview: {
    summary: "Keep the current short-horizon plan.",
    horizonDays: 3,
    items: [
      {
        date: "2026-03-09",
        title: "Threshold Run",
        type: "run",
        change: "KEEP" as const,
        before: "run 60 min",
        after: "run 60 min",
      },
    ],
  },
};

describe("adaptive-day-planner-cache.service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(db.todayDecision.findUnique).mockResolvedValue(null);
    vi.mocked(db.todayDecision.deleteMany).mockResolvedValue({ count: 0 } as never);
    vi.mocked(db.dailyCheckIn.findUnique).mockResolvedValue(null);
    vi.mocked(db.workout.findFirst).mockResolvedValue(null);
  });

  it("marks cached planner as stale when today's check-in was updated after planner generation", async () => {
    vi.mocked(db.todayDecision.findUnique).mockResolvedValue({
      payload: JSON.stringify(plannerPayload),
    } as never);
    vi.mocked(db.dailyCheckIn.findUnique).mockResolvedValue({
      updatedAt: new Date("2026-03-09T09:15:00.000Z"),
    } as never);

    const result = await getAdaptiveDayPlannerCacheSnapshot("user-1", new Date("2026-03-09T12:00:00.000Z"));

    expect(result.payload?.decision).toBe("DO_THIS_WORKOUT");
    expect(result.stale).toBe(true);
    expect(result.staleReason).toBe("CHECKIN_UPDATED");
    expect(result.changedAt).toBe("2026-03-09T09:15:00.000Z");
  });

  it("marks cached planner as stale when a workout in the 72h horizon changed after planner generation", async () => {
    vi.mocked(db.todayDecision.findUnique).mockResolvedValue({
      payload: JSON.stringify(plannerPayload),
    } as never);
    vi.mocked(db.dailyCheckIn.findUnique).mockResolvedValue({
      updatedAt: new Date("2026-03-09T07:30:00.000Z"),
    } as never);
    vi.mocked(db.workout.findFirst).mockResolvedValue({
      updatedAt: new Date("2026-03-10T06:00:00.000Z"),
    } as never);

    const result = await getAdaptiveDayPlannerCacheSnapshot("user-1", new Date("2026-03-09T12:00:00.000Z"));
    const decisionDate = localStartOfDay("2026-03-09T12:00:00.000Z");
    const horizonEnd = new Date(decisionDate);
    horizonEnd.setDate(horizonEnd.getDate() + 3);

    expect(result.stale).toBe(true);
    expect(result.staleReason).toBe("WORKOUT_UPDATED");
    expect(result.changedAt).toBe("2026-03-10T06:00:00.000Z");
    expect(db.workout.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          userId: "user-1",
          date: expect.objectContaining({
            gte: decisionDate,
            lt: horizonEnd,
          }),
        }),
      })
    );
  });

  it("returns non-stale snapshot when no source changed after generation time", async () => {
    vi.mocked(db.todayDecision.findUnique).mockResolvedValue({
      payload: JSON.stringify(plannerPayload),
    } as never);
    vi.mocked(db.dailyCheckIn.findUnique).mockResolvedValue({
      updatedAt: new Date("2026-03-09T07:00:00.000Z"),
    } as never);
    vi.mocked(db.workout.findFirst).mockResolvedValue({
      updatedAt: new Date("2026-03-09T07:30:00.000Z"),
    } as never);

    const result = await getAdaptiveDayPlannerCacheSnapshot("user-1", new Date("2026-03-09T12:00:00.000Z"));

    expect(result.stale).toBe(false);
    expect(result.staleReason).toBeNull();
    expect(result.changedAt).toBeNull();
  });

  it("invalidates cache for all decision dates affected by a workout date range", async () => {
    await invalidateAdaptiveDayPlannerCacheForDateRange(
      "user-1",
      new Date("2026-03-11T14:00:00.000Z"),
      new Date("2026-03-13T09:00:00.000Z")
    );

    const expectedStart = localStartOfDay("2026-03-11T14:00:00.000Z");
    expectedStart.setDate(expectedStart.getDate() - 2);
    const expectedEndExclusive = localStartOfDay("2026-03-13T09:00:00.000Z");
    expectedEndExclusive.setDate(expectedEndExclusive.getDate() + 1);

    expect(db.todayDecision.deleteMany).toHaveBeenCalledWith({
      where: {
        userId: "user-1",
        date: {
          gte: expectedStart,
          lt: expectedEndExclusive,
        },
      },
    });
  });
});
