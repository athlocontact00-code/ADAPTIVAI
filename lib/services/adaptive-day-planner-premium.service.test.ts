import { describe, expect, it } from "vitest";

import {
  derivePremiumConflictSignal,
  isAdaptivePlannerWorkoutIntense,
  mapPlannerPatchToConflictSuggestion,
} from "./adaptive-day-planner-premium.service";

describe("isAdaptivePlannerWorkoutIntense", () => {
  it("detects intense workouts from title keywords or TSS", () => {
    expect(isAdaptivePlannerWorkoutIntense({ title: "VO2 Intervals", type: "run", tss: 55 })).toBe(true);
    expect(isAdaptivePlannerWorkoutIntense({ title: "Easy Run", type: "run", tss: 90 })).toBe(true);
    expect(isAdaptivePlannerWorkoutIntense({ title: "Easy Run", type: "run", tss: 35 })).toBe(false);
  });
});

describe("derivePremiumConflictSignal", () => {
  it("flags conflict for intense workout with reduced readiness", () => {
    const hasConflict = derivePremiumConflictSignal({
      readinessScore: 62,
      fatigue: 55,
      soreness: 40,
      todayWorkout: {
        id: "w1",
        title: "Threshold Run",
        type: "run",
        tss: 85,
      },
      recentHardSessionsBeforeToday: 1,
    });

    expect(hasConflict).toBe(true);
  });

  it("does not flag easy workout when signals are acceptable", () => {
    const hasConflict = derivePremiumConflictSignal({
      readinessScore: 62,
      fatigue: 55,
      soreness: 40,
      todayWorkout: {
        id: "w1",
        title: "Easy Run",
        type: "run",
        tss: 35,
      },
      recentHardSessionsBeforeToday: 1,
    });

    expect(hasConflict).toBe(false);
  });
});

describe("mapPlannerPatchToConflictSuggestion", () => {
  it("maps shortened adaptation to reduce_duration", () => {
    const suggestion = mapPlannerPatchToConflictSuggestion(
      {
        decision: "ADAPT_SESSION",
        state: "ADAPT",
        action: { title: "Use the lighter version today", details: "details" },
        why: "Lower the load today.",
        confidence: "MED",
        reasons: ["Readiness 52/100"],
        patchPreview: {
          summary: "Short-horizon replan",
          horizonDays: 3,
          items: [
            {
              date: "2026-03-09",
              title: "Threshold Run (lighter)",
              type: "run",
              change: "ADAPT",
              before: "run • 60 min • 80 TSS",
              after: "run • 45 min • 56 TSS",
            },
          ],
        },
      },
      {
        title: "Threshold Run",
        type: "run",
        durationMin: 60,
        tss: 80,
      }
    );

    expect(suggestion?.action).toBe("reduce_duration");
    expect(suggestion?.durationFactor).toBe(0.75);
    expect(suggestion?.patch?.durationMin).toBe(45);
    expect(suggestion?.patch?.tss).toBe(56);
  });

  it("maps recovery-focused patch to swap_recovery", () => {
    const suggestion = mapPlannerPatchToConflictSuggestion(
      {
        decision: "RECOVER_AND_REPLAN",
        state: "ADAPT",
        action: { title: "Recover today", details: "details" },
        why: "Protect recovery.",
        confidence: "HIGH",
        reasons: ["Active injury context is present"],
        patchPreview: {
          summary: "Recovery replan",
          horizonDays: 3,
          items: [
            {
              date: "2026-03-09",
              title: "Recovery-focused alternative",
              type: "recovery",
              change: "RECOVER",
              before: "run • 60 min • 80 TSS",
              after: "recovery • 30 min • 20 TSS",
            },
          ],
        },
      },
      {
        title: "Threshold Run",
        type: "run",
        durationMin: 60,
        tss: 80,
      }
    );

    expect(suggestion?.action).toBe("swap_recovery");
    expect(suggestion?.newType).toBe("recovery");
    expect(suggestion?.newTitle).toBe("Recovery-focused alternative");
  });

  it("returns null when planner keeps the session", () => {
    const suggestion = mapPlannerPatchToConflictSuggestion(
      {
        decision: "DO_THIS_WORKOUT",
        state: "READY",
        action: { title: "Today's session is ready", details: "details" },
        why: "Keep the plan.",
        confidence: "HIGH",
        reasons: [],
        patchPreview: {
          summary: "Keep plan",
          horizonDays: 3,
          items: [
            {
              date: "2026-03-09",
              title: "Threshold Run",
              type: "run",
              change: "KEEP",
              before: "run • 60 min • 80 TSS",
              after: "run • 60 min • 80 TSS",
            },
          ],
        },
      },
      {
        title: "Threshold Run",
        type: "run",
        durationMin: 60,
        tss: 80,
      }
    );

    expect(suggestion).toBeNull();
  });
});
