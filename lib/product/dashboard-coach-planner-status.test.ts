import { describe, expect, it } from "vitest";
import { getDashboardCoachPlannerStatusCopy } from "./dashboard-coach-planner-status";

describe("dashboard coach planner status copy", () => {
  it("prioritizes pending coach changes", () => {
    expect(getDashboardCoachPlannerStatusCopy({ pendingCount: 2, resolvedTitle: "Ignored", plannerStale: true })).toEqual({
      title: "2 coach changes waiting",
      description: "Review the latest coach recommendation before continuing with today's plan.",
    });
  });

  it("falls back to resolved review copy before stale planner copy", () => {
    expect(getDashboardCoachPlannerStatusCopy({ resolvedTitle: "Ease today's run", plannerStale: true })).toEqual({
      title: "Coach review completed",
      description: "Ease today's run",
    });
  });

  it("returns stale and default planner states", () => {
    expect(getDashboardCoachPlannerStatusCopy({ plannerStale: true })).toEqual({
      title: "Today's guidance needs refresh",
      description: "Your latest check-in or workout change may have affected today's recommendation.",
    });
    expect(getDashboardCoachPlannerStatusCopy({})).toEqual({
      title: "Coach and planner are aligned",
      description: "Review today's guidance or continue refining your plan with Coach.",
    });
  });
});
