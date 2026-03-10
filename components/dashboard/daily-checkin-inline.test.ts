import React from "react";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import { DailyCheckinInline } from "./daily-checkin-inline";

describe("DailyCheckinInline", () => {
  it("renders shared planner freshness labels for completed check-ins", () => {
    const html = renderToStaticMarkup(
      React.createElement(DailyCheckinInline, {
        status: "completed",
        checkin: {
          readinessScore: 68,
          topFactor: "Sleep",
          updatedAt: "2026-03-09T09:20:00.000Z",
          plannerGeneratedAt: "2026-03-09T08:15:00.000Z",
          plannerStale: true,
          plannerStaleReason: "CHECKIN_UPDATED",
        } as any,
        onOpenCheckin: () => {},
      })
    );

    expect(html).toContain("Cached");
    expect(html).toContain("Check-in updated");
  });
});
