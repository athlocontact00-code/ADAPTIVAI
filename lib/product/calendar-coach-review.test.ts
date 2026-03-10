import { describe, expect, it } from "vitest";
import {
  clearCalendarCoachReviewContext,
  shouldShowCalendarCoachReviewContext,
} from "./calendar-coach-review";

describe("calendar coach review helpers", () => {
  it("shows coach review context only on the reviewed day", () => {
    expect(
      shouldShowCalendarCoachReviewContext({
        context: {
          suggestionId: "suggestion-1",
          contextDate: "2026-03-09",
          title: "Ease today's run",
          summary: "Reduce intensity to stay on track.",
          reviewHref: "/coach?suggestionId=suggestion-1&contextDate=2026-03-09",
        },
        selectedDate: new Date("2026-03-09T12:00:00.000Z"),
      })
    ).toBe(true);

    expect(
      shouldShowCalendarCoachReviewContext({
        context: {
          suggestionId: "suggestion-1",
          contextDate: "2026-03-09",
          title: "Ease today's run",
          summary: "Reduce intensity to stay on track.",
          reviewHref: "/coach?suggestionId=suggestion-1&contextDate=2026-03-09",
        },
        selectedDate: new Date("2026-03-10T12:00:00.000Z"),
      })
    ).toBe(false);
  });

  it("clears coach review context only for matching dates", () => {
    const context = {
      suggestionId: "suggestion-1",
      contextDate: "2026-03-09",
      title: "Ease today's run",
      summary: "Reduce intensity to stay on track.",
      reviewHref: "/coach?suggestionId=suggestion-1&contextDate=2026-03-09",
    };

    expect(clearCalendarCoachReviewContext(context, "2026-03-09")).toBeNull();
    expect(clearCalendarCoachReviewContext(context, new Date("2026-03-10T12:00:00.000Z"))).toEqual(context);
  });
});
