import { describe, expect, it } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import {
  AdaptiveDayPlannerPreview,
  AdaptiveDayPlannerReasonChips,
} from "./adaptive-day-planner-preview";

describe("AdaptiveDayPlannerReasonChips", () => {
  it("renders only the configured number of reason chips", () => {
    const html = renderToStaticMarkup(
      React.createElement(AdaptiveDayPlannerReasonChips, {
        reasons: [
          "Readiness 52/100",
          "Pre-training check-in still required",
          "Current plan conflicts with latest recovery signals",
        ],
        limit: 2,
      })
    );

    expect(html).toContain("Readiness 52/100");
    expect(html).toContain("Pre-training check-in still required");
    expect(html).not.toContain("Current plan conflicts with latest recovery signals");
  });

  it("renders nothing when there are no reasons", () => {
    const html = renderToStaticMarkup(React.createElement(AdaptiveDayPlannerReasonChips, { reasons: [] }));
    expect(html).toBe("");
  });
});

describe("AdaptiveDayPlannerPreview", () => {
  it("renders preview title, summary and normalized patch labels", () => {
    const html = renderToStaticMarkup(
      React.createElement(AdaptiveDayPlannerPreview, {
        preview: {
          summary: "Short-horizon replan for today and the next 72 hours.",
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
            {
              date: "2026-03-10",
              title: "Bike Endurance",
              type: "bike",
              change: "REVIEW",
              before: "bike • 90 min • 70 TSS",
              after: "Keep under review after today&#x27;s adaptation",
            },
          ],
        },
      })
    );

    expect(html).toContain("Next 72h plan");
    expect(html).toContain("Short-horizon replan for today and the next 72 hours.");
    expect(html).toContain("Threshold Run (lighter)");
    expect(html).toContain("Adapt");
    expect(html).toContain("Review");
    expect(html).toContain("Before: run");
    expect(html).toContain("After: run");
  });

  it("renders nothing when preview is missing", () => {
    const html = renderToStaticMarkup(React.createElement(AdaptiveDayPlannerPreview, { preview: null }));
    expect(html).toBe("");
  });
});
