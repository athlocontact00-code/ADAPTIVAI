import { describe, expect, it } from "vitest";
import {
  getCalendarCoachReviewHeaderLabel,
  getCoachReviewInCalendarLabel,
  getCoachReviewInCoachLabel,
  getCoachReviewTargetBadgeLabel,
} from "./coach-review-copy";

describe("coach review copy helpers", () => {
  it("returns stable review labels", () => {
    expect(getCoachReviewInCoachLabel()).toBe("Review in Coach");
    expect(getCoachReviewInCalendarLabel()).toBe("Open in Calendar");
    expect(getCoachReviewTargetBadgeLabel()).toBe("Review target");
    expect(getCalendarCoachReviewHeaderLabel()).toBe("Reviewing coach suggestion");
  });
});
