import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/db", () => ({
  db: {
    workout: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
    },
  },
}));
vi.mock("@/lib/services/adaptive-day-planner-cache.service", () => ({
  adaptiveDayPlannerPayloadSchema: {
    parse: vi.fn((value) => value),
  },
  getAdaptiveDayPlannerCacheSnapshot: vi.fn(),
  persistAdaptiveDayPlannerCache: vi.fn(),
}));
vi.mock("@/lib/services/ai-context.builder", () => ({
  buildAIContextForUser: vi.fn(),
}));
vi.mock("@/lib/services/adaptive-day-planner.service", () => ({
  buildAdaptiveDayPlannerFromContext: vi.fn(),
}));

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  getAdaptiveDayPlannerCacheSnapshot,
  persistAdaptiveDayPlannerCache,
} from "@/lib/services/adaptive-day-planner-cache.service";
import { buildAIContextForUser } from "@/lib/services/ai-context.builder";
import { buildAdaptiveDayPlannerFromContext } from "@/lib/services/adaptive-day-planner.service";
import { POST } from "./route";

const setAuthSession = (value: { user: { id: string; email: string }; expires: string } | null) => {
  (auth as unknown as { mockResolvedValue: (session: typeof value) => void }).mockResolvedValue(value);
};

function localStartOfDay(value: string): Date {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
}

const cachedDecision = {
  decision: "DO_THIS_WORKOUT" as const,
  state: "READY" as const,
  generatedAt: "2026-03-09T08:00:00.000Z",
  action: {
    title: "Do the planned session",
    details: "Keep the current workout.",
  },
  why: "Signals look stable.",
  confidence: "HIGH" as const,
  reasons: ["Readiness is stable"],
  patchPreview: null,
};

describe("POST /api/ai/today-decision", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setAuthSession({
      user: { id: "user-1", email: "u@example.com" },
      expires: "",
    });
    vi.mocked(getAdaptiveDayPlannerCacheSnapshot).mockResolvedValue({
      payload: null,
      stale: false,
      staleReason: null,
      changedAt: null,
    });
    vi.mocked(buildAIContextForUser).mockResolvedValue({
      contextVersion: 1,
      generatedAt: "2026-03-09T07:30:00.000Z",
    } as never);
    vi.mocked(db.workout.findMany).mockResolvedValue([]);
    vi.mocked(db.workout.findFirst).mockResolvedValue(null);
    vi.mocked(buildAdaptiveDayPlannerFromContext).mockReturnValue(cachedDecision as never);
    vi.mocked(persistAdaptiveDayPlannerCache).mockResolvedValue(cachedDecision as never);
  });

  it("returns 401 when user is not authenticated", async () => {
    setAuthSession(null);

    const response = await POST(new Request("http://localhost/api/ai/today-decision", { method: "POST" }));

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "Unauthorized" });
  });

  it("returns cached planner payload with stale metadata when snapshot exists and force is not requested", async () => {
    vi.mocked(getAdaptiveDayPlannerCacheSnapshot).mockResolvedValue({
      payload: cachedDecision,
      stale: true,
      staleReason: "WORKOUT_UPDATED",
      changedAt: "2026-03-09T09:45:00.000Z",
    });

    const response = await POST(
      new Request("http://localhost/api/ai/today-decision", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      })
    );
    const body = await response.json();
    const decisionDate = localStartOfDay("2026-03-09T12:00:00.000Z");
    const expectedDecisionDate = decisionDate.toISOString().slice(0, 10);

    expect(response.status).toBe(200);
    expect(body.cached).toBe(true);
    expect(body.stale).toBe(true);
    expect(body.staleReason).toBe("WORKOUT_UPDATED");
    expect(body.changedAt).toBe("2026-03-09T09:45:00.000Z");
    expect(body.decision).toEqual(cachedDecision);
    expect(buildAIContextForUser).not.toHaveBeenCalled();
    expect(persistAdaptiveDayPlannerCache).not.toHaveBeenCalled();
  });

  it("recomputes and persists planner when force is requested", async () => {
    const recomputedDecision = {
      ...cachedDecision,
      decision: "ADAPT_SESSION" as const,
      state: "ADAPT" as const,
      action: {
        title: "Use the lighter version today",
        details: "Reduce load and review tomorrow.",
      },
      reasons: ["Readiness dropped after check-in"],
      patchPreview: {
        summary: "Adapt today and review tomorrow.",
        horizonDays: 3,
        items: [
          {
            date: "2026-03-09",
            title: "Threshold Run (lighter)",
            type: "run",
            change: "ADAPT" as const,
            before: "run 60 min",
            after: "run 45 min",
          },
        ],
      },
    };
    vi.mocked(getAdaptiveDayPlannerCacheSnapshot).mockResolvedValue({
      payload: cachedDecision,
      stale: true,
      staleReason: "CHECKIN_UPDATED",
      changedAt: "2026-03-09T09:20:00.000Z",
    });
    vi.mocked(db.workout.findMany).mockResolvedValue([
      {
        id: "w1",
        title: "Threshold Run",
        type: "run",
        date: new Date("2026-03-09T10:00:00.000Z"),
        planned: true,
        completed: false,
        durationMin: 60,
        tss: 80,
      },
    ] as never);
    vi.mocked(buildAdaptiveDayPlannerFromContext).mockReturnValue(recomputedDecision as never);
    vi.mocked(persistAdaptiveDayPlannerCache).mockResolvedValue({
      ...recomputedDecision,
      generatedAt: "2026-03-09T10:05:00.000Z",
    } as never);

    const response = await POST(
      new Request("http://localhost/api/ai/today-decision", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ force: true, date: "2026-03-09T12:00:00.000Z" }),
      })
    );
    const body = await response.json();
    const decisionDate = localStartOfDay("2026-03-09T12:00:00.000Z");
    const expectedDecisionDate = decisionDate.toISOString().slice(0, 10);

    expect(response.status).toBe(200);
    expect(body.cached).toBe(false);
    expect(body.stale).toBe(false);
    expect(body.staleReason).toBeNull();
    expect(body.changedAt).toBeNull();
    expect(body.decision.generatedAt).toBe("2026-03-09T10:05:00.000Z");
    expect(buildAIContextForUser).toHaveBeenCalledWith("user-1");
    expect(buildAdaptiveDayPlannerFromContext).toHaveBeenCalledWith(
      expect.objectContaining({
        decisionDate: expectedDecisionDate,
        horizonWorkouts: [
          expect.objectContaining({ id: "w1", date: "2026-03-09" }),
        ],
      })
    );
    const plannerInput = vi.mocked(buildAdaptiveDayPlannerFromContext).mock.calls[0]?.[0];
    expect(plannerInput?.todayWorkouts).toEqual(
      expectedDecisionDate === "2026-03-09"
        ? [expect.objectContaining({ id: "w1", date: "2026-03-09" })]
        : []
    );
    expect(persistAdaptiveDayPlannerCache).toHaveBeenCalledWith(
      "user-1",
      decisionDate,
      recomputedDecision
    );
  });
});
