import { describe, expect, it } from "vitest";

import {
  getTodayDecisionStaleBadgeCopy,
  getTodayDecisionGeneratedLabel,
  getTodayDecisionStaleDetail,
  getTodayDecisionStaleMessage,
} from "./today-decision-staleness";

describe("today decision staleness copy", () => {
  it("returns specific copy for stale reasons", () => {
    expect(getTodayDecisionStaleBadgeCopy("CHECKIN_UPDATED")).toBe("Check-in updated");
    expect(getTodayDecisionStaleBadgeCopy("WORKOUT_UPDATED")).toBe("Plan changed");
    expect(getTodayDecisionStaleMessage("CHECKIN_UPDATED")).toBe("New check-in saved after this recommendation.");
    expect(getTodayDecisionStaleMessage("WORKOUT_UPDATED")).toBe(
      "Workout changes may have made this recommendation outdated."
    );
  });

  it("falls back to generic copy when reason is absent", () => {
    expect(getTodayDecisionStaleBadgeCopy(null)).toBe("Needs refresh");
    expect(getTodayDecisionStaleMessage(undefined)).toBe("This recommendation may be outdated.");
  });

  it("builds generated and stale detail labels with timestamps when available", () => {
    expect(
      getTodayDecisionGeneratedLabel({
        cached: true,
        generatedAt: "2026-03-09T08:15:00.000Z",
      })
    ).toMatch(/^Cached /);

    expect(
      getTodayDecisionStaleDetail({
        reason: "CHECKIN_UPDATED",
        changedAt: "2026-03-09T09:20:00.000Z",
      })
    ).toContain("Latest change");
  });
});
