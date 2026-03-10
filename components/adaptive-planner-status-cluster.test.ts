import React from "react";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import { AdaptivePlannerStatusCluster } from "./adaptive-planner-status-cluster";

describe("AdaptivePlannerStatusCluster", () => {
  it("renders planner badges and freshness details together", () => {
    const html = renderToStaticMarkup(
      React.createElement(AdaptivePlannerStatusCluster, {
        decision: "ADAPT_SESSION",
        state: "ADAPT",
        generatedAt: "2026-03-09T08:15:00.000Z",
        cached: true,
        stale: true,
        staleReason: "WORKOUT_UPDATED",
      })
    );

    expect(html).toContain("Adapt today");
    expect(html).toContain("Adaptation");
    expect(html).toContain("Cached");
    expect(html).toContain("Workout changes may have made this recommendation outdated.");
  });

  it("renders nothing when no planner metadata is provided", () => {
    const html = renderToStaticMarkup(React.createElement(AdaptivePlannerStatusCluster, {}));
    expect(html).toBe("");
  });
});
