import { describe, expect, it } from "vitest";

import {
  buildSevenDayPlanResponse,
  buildTodayWorkoutsResponse,
  formatCoachWorkoutLine,
} from "./coach-lightweight-response-handlers";

describe("formatCoachWorkoutLine", () => {
  it("formats workout duration and status", () => {
    expect(
      formatCoachWorkoutLine({
        title: "Easy Run",
        type: "run",
        durationMin: 45,
        planned: true,
        completed: false,
      })
    ).toBe("- **Easy Run** (run, 45 min) _(planned)_");
  });
});

describe("buildTodayWorkoutsResponse", () => {
  it("builds workout list response when workouts exist", () => {
    const result = buildTodayWorkoutsResponse({
      date: new Date(2026, 2, 10, 12, 0, 0, 0),
      workouts: [
        {
          title: "Easy Run",
          type: "run",
          durationMin: 45,
          planned: true,
          completed: false,
        },
      ],
    });
    expect(result.confidence).toBe(90);
    expect(result.text).toContain("## Today's workouts");
    expect(result.text).toContain("Easy Run");
    expect(result.text).toContain("fresh / heavy / sore");
  });

  it("builds empty-state response when no workouts exist", () => {
    const result = buildTodayWorkoutsResponse({
      date: new Date(2026, 2, 10, 12, 0, 0, 0),
      workouts: [],
    });
    expect(result.text).toContain("No workouts scheduled for today.");
    expect(result.text).toContain("tell me your goal for today");
  });
});

describe("buildSevenDayPlanResponse", () => {
  it("builds success response when summary exists", () => {
    expect(
      buildSevenDayPlanResponse({
        success: true,
        summaryMd: "Day 1: Easy run",
      })
    ).toEqual({
      ok: true,
      text: "Day 1: Easy run\n",
      confidence: 85,
    });
  });

  it("returns normalized error when plan generation fails", () => {
    expect(
      buildSevenDayPlanResponse({
        success: false,
        error: "Upstream failed",
      })
    ).toEqual({
      ok: false,
      error: "Upstream failed",
    });
  });
});
