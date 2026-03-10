import { describe, expect, it } from "vitest";
import {
  getCoachReviewApplyToast,
  getCoachReviewDismissToast,
  getCoachReviewManualResolutionToast,
} from "./coach-review-outcome";

describe("coach review outcome helpers", () => {
  it("returns stable review outcome copy", () => {
    expect(getCoachReviewApplyToast()).toBe("Coach change applied");
    expect(getCoachReviewApplyToast({ proposalCreated: true })).toBe("Proposal created");
    expect(getCoachReviewDismissToast()).toBe("Coach review dismissed");
    expect(getCoachReviewManualResolutionToast()).toBe("Coach review updated");
  });
});
