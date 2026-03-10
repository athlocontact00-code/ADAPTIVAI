import { describe, expect, it } from "vitest";

import { buildAdaptiveDayPlannerFromContext, type AdaptivePlannerWorkout } from "./adaptive-day-planner.service";

function createWorkout(overrides: Partial<AdaptivePlannerWorkout> = {}): AdaptivePlannerWorkout {
  return {
    id: "w1",
    title: "Threshold Run",
    type: "run",
    date: "2026-03-09",
    planned: true,
    completed: false,
    durationMin: 60,
    tss: 85,
    ...overrides,
  };
}

function createContext(overrides: Record<string, unknown> = {}) {
  return {
    contextVersion: 1,
    generatedAt: "2026-03-09T00:00:00.000Z",
    todayCheckin: {
      status: "completed",
      data: {
        readinessScore: 72,
        hasConflict: false,
      },
    },
    recentSignals: {
      checkIns7d: [],
      metrics14d: [],
      feedbackPatterns14d: {
        perceivedDifficultyCounts: {
          HARD: 0,
          BRUTAL: 0,
        },
      },
    },
    userProfile: {
      activeInjuries: [],
    },
    zones: {},
    pbs: [],
    goals: [],
    recentTraining: [],
    aiMemory: null,
    planSummary: null,
    ...overrides,
  } as unknown as Parameters<typeof buildAdaptiveDayPlannerFromContext>[0]["context"];
}

describe("buildAdaptiveDayPlanner", () => {
  it("keeps the session when signals are stable", () => {
    const workout = createWorkout();
    const decision = buildAdaptiveDayPlannerFromContext({
      context: createContext(),
      decisionDate: "2026-03-09",
      todayWorkouts: [workout],
      horizonWorkouts: [workout],
      feedbackRequiredWorkout: null,
    });

    expect(decision.decision).toBe("DO_THIS_WORKOUT");
    expect(decision.state).toBe("READY");
    expect(decision.patchPreview?.items[0]?.change).toBe("KEEP");
  });

  it("requires check-in before a planned session", () => {
    const workout = createWorkout();
    const decision = buildAdaptiveDayPlannerFromContext({
      context: createContext({
        todayCheckin: {
          status: "required",
          data: null,
        },
      }),
      decisionDate: "2026-03-09",
      todayWorkouts: [workout],
      horizonWorkouts: [workout],
      feedbackRequiredWorkout: null,
    });

    expect(decision.decision).toBe("CHECK_IN_FIRST");
    expect(decision.state).toBe("CHECK_IN_REQUIRED");
    expect(decision.patchPreview?.items[0]?.after).toContain("Pending check-in");
  });

  it("adapts the session when readiness is low", () => {
    const workout = createWorkout();
    const tomorrow = createWorkout({
      id: "w2",
      title: "Bike Endurance",
      type: "bike",
      date: "2026-03-10",
      durationMin: 90,
      tss: 70,
    });
    const decision = buildAdaptiveDayPlannerFromContext({
      context: createContext({
        todayCheckin: {
          status: "completed",
          data: {
            readinessScore: 41,
            hasConflict: false,
          },
        },
        recentSignals: {
          feedbackPatterns14d: {
            perceivedDifficultyCounts: {
              HARD: 1,
              BRUTAL: 1,
            },
          },
        },
      }),
      decisionDate: "2026-03-09",
      todayWorkouts: [workout],
      horizonWorkouts: [workout, tomorrow],
      feedbackRequiredWorkout: null,
    });

    expect(decision.decision).toBe("ADAPT_SESSION");
    expect(decision.state).toBe("ADAPT");
    expect(decision.patchPreview?.items.map((item) => item.change)).toContain("ADAPT");
    expect(decision.patchPreview?.items.map((item) => item.change)).toContain("REVIEW");
  });

  it("asks for feedback before replanning", () => {
    const decision = buildAdaptiveDayPlannerFromContext({
      context: createContext(),
      decisionDate: "2026-03-09",
      todayWorkouts: [],
      horizonWorkouts: [],
      feedbackRequiredWorkout: {
        id: "done-1",
        title: "Morning Run",
        type: "run",
        date: "2026-03-09",
      },
    });

    expect(decision.decision).toBe("RECOVER_AND_REPLAN");
    expect(decision.state).toBe("FEEDBACK_REQUIRED");
    expect(decision.action.link?.type).toBe("workout");
  });
});
