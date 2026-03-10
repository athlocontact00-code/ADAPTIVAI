import { describe, expect, it } from "vitest";
import { getCoachReviewNextStepCopy } from "./coach-review-next-step";

describe("coach review next step copy", () => {
  it("returns today-specific next step guidance", () => {
    expect(getCoachReviewNextStepCopy({ isToday: true, title: "Ease today's run" })).toEqual({
      title: "Ease today's run",
      description: "The change is resolved. Check today's guidance or continue refining it in Coach.",
      primaryLabel: "Open Today Decision",
      secondaryLabel: "View on Dashboard",
    });
  });

  it("returns non-today guidance with fallback title", () => {
    expect(getCoachReviewNextStepCopy({ isToday: false, title: "" })).toEqual({
      title: "Coach review completed",
      description: "The change is resolved. Return to Coach if you want to keep iterating on the plan.",
      primaryLabel: "Back to Coach",
      secondaryLabel: null,
    });
  });
});
