import { describe, expect, it } from "vitest";

import {
  getPlanAdaptationActionCopy,
  getPlanAdaptationDecisionToast,
  getPlanAdaptationOutcomeCopy,
  getPlanAdaptationReviewContextCopy,
  getPlanAdaptationReviewHref,
} from "./plan-adaptation-ui";

describe("plan adaptation ui", () => {
  it("returns shared outcome copy for applied and proposal flows", () => {
    expect(getPlanAdaptationOutcomeCopy({ proposalCreated: false })).toMatchObject({
      title: "Adaptation applied",
      toast: "Adaptation applied",
    });
    expect(getPlanAdaptationOutcomeCopy({ proposalCreated: true })).toMatchObject({
      title: "Proposal created",
      toast: "Proposal created",
    });
  });

  it("returns action labels for locked and unlocked flows", () => {
    expect(getPlanAdaptationActionCopy({ locked: true }).applyLabel).toBe("Create proposal");
    expect(getPlanAdaptationActionCopy({ requiresConfirmation: true }).applyLabel).toBe("Review adaptation");
    expect(getPlanAdaptationActionCopy({ hasUpdatedWorkout: true }).viewWorkoutLabel).toBe("View adapted workout");
    expect(getPlanAdaptationActionCopy({}).declineLabel).toBe("Decline proposal");
    expect(getPlanAdaptationActionCopy({}).keepLabel).toBe("Keep current workout");
  });

  it("returns decision toast copy for proposal review", () => {
    expect(getPlanAdaptationDecisionToast("ACCEPT")).toBe("Adaptation applied");
    expect(getPlanAdaptationDecisionToast("DECLINE")).toBe("Proposal declined");
  });

  it("builds a shared calendar review href", () => {
    expect(getPlanAdaptationReviewHref({ proposalId: "proposal-1" })).toBe("/calendar?proposalId=proposal-1");
    expect(getPlanAdaptationReviewHref({ workoutId: "workout-1" })).toBe("/calendar?workoutId=workout-1");
    expect(getPlanAdaptationReviewHref({})).toBe("/calendar");
  });

  it("returns review context copy with summary fallback", () => {
    expect(getPlanAdaptationReviewContextCopy("Move today's workout to tomorrow")).toEqual({
      title: "Reviewing proposal",
      description: "Move today's workout to tomorrow",
    });
  });
});
