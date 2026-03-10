import { describe, expect, it } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { TodayDecisionInlineStatus } from "./today-decision-inline-status";

describe("TodayDecisionInlineStatus", () => {
  it("renders stale detail and generated label together", () => {
    const html = renderToStaticMarkup(
      React.createElement(TodayDecisionInlineStatus, {
        stale: true,
        staleReason: "WORKOUT_UPDATED",
        changedAt: "2026-03-09T09:20:00.000Z",
        generatedAt: "2026-03-09T08:15:00.000Z",
        cached: true,
      })
    );

    expect(html).toContain("Workout changes may have made this recommendation outdated.");
    expect(html).toContain("Latest change");
    expect(html).toContain("Cached");
  });

  it("renders nothing when no status metadata exists", () => {
    const html = renderToStaticMarkup(React.createElement(TodayDecisionInlineStatus, {}));
    expect(html).toBe("");
  });
});
