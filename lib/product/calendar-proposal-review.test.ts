import { describe, expect, it } from "vitest";

import {
  buildCalendarDetailUrl,
  clearCalendarProposalReviewContext,
  shouldShowCalendarProposalReviewContext,
} from "./calendar-proposal-review";

describe("calendar proposal review helpers", () => {
  it("shows review context only while proposal is loading or still pending", () => {
    expect(
      shouldShowCalendarProposalReviewContext({
        context: { proposalId: "proposal-1", summary: "Move workout" },
        proposalLoading: false,
        pendingProposalIds: ["proposal-1"],
      })
    ).toBe(true);

    expect(
      shouldShowCalendarProposalReviewContext({
        context: { proposalId: "proposal-1", summary: "Move workout" },
        proposalLoading: false,
        pendingProposalIds: [],
      })
    ).toBe(false);
  });

  it("clears review context only for the decided proposal", () => {
    expect(
      clearCalendarProposalReviewContext({ proposalId: "proposal-1", summary: "Move workout" }, "proposal-1")
    ).toBeNull();

    expect(
      clearCalendarProposalReviewContext({ proposalId: "proposal-1", summary: "Move workout" }, "proposal-2")
    ).toEqual({
      proposalId: "proposal-1",
      summary: "Move workout",
    });
  });

  it("removes proposalId while preserving workout detail context", () => {
    expect(
      buildCalendarDetailUrl({
        currentUrl:
          "https://app.test/calendar?proposalId=proposal-1&workoutId=workout-1&suggestionId=suggestion-1&contextDate=2026-03-09",
        workoutId: "workout-1",
      })
    ).toBe("/calendar?workoutId=workout-1");

    expect(
      buildCalendarDetailUrl({
        currentUrl: "https://app.test/calendar?proposalId=proposal-1",
        workoutId: null,
      })
    ).toBe("/calendar");
  });
});
