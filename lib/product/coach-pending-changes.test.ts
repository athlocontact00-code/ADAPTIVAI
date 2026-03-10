import { describe, expect, it } from "vitest";
import {
  buildCoachPendingChangesReviewHref,
  getCoachPendingChangesTitle,
  getCoachSuggestionCalendarHref,
  normalizeCoachPendingScope,
  summarizeCoachPendingChanges,
} from "./coach-pending-changes";

describe("coach pending changes helpers", () => {
  it("returns null when there are no pending changes", () => {
    expect(summarizeCoachPendingChanges([])).toBeNull();
  });

  it("summarizes the first pending change and unique scopes", () => {
    expect(
      summarizeCoachPendingChanges([
        {
          id: "suggestion-1",
          title: "Ease today's run",
          summary: "Reduce intensity to stay on track.",
          scope: "today",
          contextDate: "2026-03-09",
          payload: { kind: "adjustWorkout", workoutId: "workout-1" },
        },
        {
          id: "suggestion-2",
          title: "Rebalance week",
          summary: "Move intensity later in the week.",
          scope: "week",
          contextDate: "2026-03-09",
          payload: { kind: "rebalanceWeek", changes: [{ workoutId: "workout-2", patch: {} }] },
        },
        {
          id: "suggestion-3",
          title: "Duplicate scope",
          summary: "Still same scope.",
          scope: "today",
          contextDate: "2026-03-09",
          payload: { kind: "moveWorkout", workoutId: "workout-3", toDate: "2026-03-10" },
        },
      ])
    ).toEqual({
      count: 3,
      primaryTitle: "Ease today's run",
      primarySummary: "Reduce intensity to stay on track.",
      scopes: ["Today", "This week"],
      primarySuggestionId: "suggestion-1",
      contextDate: "2026-03-09",
      reviewHref: "/coach?suggestionId=suggestion-1&contextDate=2026-03-09",
      calendarHref: "/calendar?workoutId=workout-1&suggestionId=suggestion-1&contextDate=2026-03-09",
    });
  });

  it("falls back when title or summary is blank", () => {
    expect(
      summarizeCoachPendingChanges([
        {
          id: "suggestion-1",
          title: " ",
          summary: "",
          scope: "custom_scope",
          contextDate: "2026-03-09",
          payload: { kind: "addRecoveryDay", date: "2026-03-09", replacement: "rest" },
        },
      ])
    ).toEqual({
      count: 1,
      primaryTitle: "Coach recommendation",
      primarySummary: "Coach has a suggested adjustment ready for your review.",
      scopes: ["Custom_scope"],
      primarySuggestionId: "suggestion-1",
      contextDate: "2026-03-09",
      reviewHref: "/coach?suggestionId=suggestion-1&contextDate=2026-03-09",
      calendarHref: "/calendar?date=2026-03-09&suggestionId=suggestion-1&contextDate=2026-03-09",
    });
  });

  it("formats helper copy for scope and title", () => {
    expect(normalizeCoachPendingScope("today")).toBe("Today");
    expect(normalizeCoachPendingScope("week")).toBe("This week");
    expect(getCoachPendingChangesTitle(1)).toBe("Coach has 1 pending change");
    expect(getCoachPendingChangesTitle(2)).toBe("Coach has 2 pending changes");
    expect(
      buildCoachPendingChangesReviewHref({
        suggestionId: "suggestion-1",
        contextDate: "2026-03-09",
      })
    ).toBe("/coach?suggestionId=suggestion-1&contextDate=2026-03-09");
    expect(
      getCoachSuggestionCalendarHref(
        { kind: "swapWorkouts", fromWorkoutId: "workout-4" },
        undefined,
        { suggestionId: "suggestion-4", contextDate: "2026-03-09" }
      )
    ).toBe(
      "/calendar?workoutId=workout-4&suggestionId=suggestion-4&contextDate=2026-03-09"
    );
    expect(
      getCoachSuggestionCalendarHref(
        { kind: "addRecoveryDay", date: "2026-03-09", replacement: "rest" },
        undefined,
        { suggestionId: "suggestion-5", contextDate: "2026-03-09" }
      )
    ).toBe("/calendar?date=2026-03-09&suggestionId=suggestion-5&contextDate=2026-03-09");
    expect(
      getCoachSuggestionCalendarHref(
        { kind: "moveWorkout", toDate: "2026-03-10" },
        "2026-03-09",
        { suggestionId: "suggestion-6", contextDate: "2026-03-09" }
      )
    ).toBe("/calendar?date=2026-03-10&suggestionId=suggestion-6&contextDate=2026-03-09");
    expect(
      getCoachSuggestionCalendarHref({
        kind: "rebalanceWeek",
        changes: [{ workoutId: "workout-5", patch: {} }],
      }, undefined, { suggestionId: "suggestion-7", contextDate: "2026-03-09" })
    ).toBe("/calendar?workoutId=workout-5&suggestionId=suggestion-7&contextDate=2026-03-09");
    expect(
      getCoachSuggestionCalendarHref(
        { kind: "rebalanceWeek" },
        "2026-03-09",
        { suggestionId: "suggestion-8", contextDate: "2026-03-09" }
      )
    ).toBe("/calendar?date=2026-03-09&suggestionId=suggestion-8&contextDate=2026-03-09");
  });
});
