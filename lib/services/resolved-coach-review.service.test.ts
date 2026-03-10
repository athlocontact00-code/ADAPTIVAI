import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({
  db: {
    coachSuggestion: {
      findFirst: vi.fn(),
    },
  },
}));

import { db } from "@/lib/db";
import { getResolvedCoachReviewSummary } from "./resolved-coach-review.service";

describe("resolved coach review service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns resolved review summary with coach and calendar links", async () => {
    vi.mocked(db.coachSuggestion.findFirst).mockResolvedValue({
      id: "suggestion-1",
      title: "Ease today's run",
      summary: "Reduce intensity to stay on track.",
      contextDate: new Date("2026-03-09T12:00:00.000Z"),
      payload: JSON.stringify({ kind: "adjustWorkout", workoutId: "workout-1" }),
    } as never);

    await expect(getResolvedCoachReviewSummary("user-1", "suggestion-1")).resolves.toEqual({
      suggestionId: "suggestion-1",
      contextDate: "2026-03-09",
      title: "Ease today's run",
      summary: "Reduce intensity to stay on track.",
      reviewHref: "/coach?resolvedSuggestionId=suggestion-1&resolvedContextDate=2026-03-09",
      calendarHref: "/calendar?workoutId=workout-1",
    });
  });

  it("returns null when suggestion is not found", async () => {
    vi.mocked(db.coachSuggestion.findFirst).mockResolvedValue(null);
    await expect(getResolvedCoachReviewSummary("user-1", "missing")).resolves.toBeNull();
  });
});
