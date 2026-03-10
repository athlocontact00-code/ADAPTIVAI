import { describe, expect, it } from "vitest";
import {
  buildResolvedCoachReviewUrl,
  buildResolvedDashboardCoachReviewUrl,
  clearCoachReviewContextUrl,
} from "./coach-review-context";

describe("coach review context helpers", () => {
  it("removes coach review params while preserving other query params", () => {
    expect(
      clearCoachReviewContextUrl(
        "https://app.test/coach?suggestionId=suggestion-1&contextDate=2026-03-09&prefill=Adjust+today"
      )
    ).toBe("/coach?prefill=Adjust+today");
  });

  it("keeps hash fragments when clearing review params", () => {
    expect(
      clearCoachReviewContextUrl(
        "https://app.test/coach?suggestionId=suggestion-1&contextDate=2026-03-09&resolvedSuggestionId=suggestion-1&resolvedContextDate=2026-03-09#command-center"
      )
    ).toBe("/coach#command-center");
  });

  it("builds resolved review urls", () => {
    expect(
      buildResolvedCoachReviewUrl({
        suggestionId: "suggestion-1",
        contextDate: "2026-03-09",
      })
    ).toBe("/coach?resolvedSuggestionId=suggestion-1&resolvedContextDate=2026-03-09");
    expect(
      buildResolvedDashboardCoachReviewUrl({
        suggestionId: "suggestion-1",
        contextDate: "2026-03-09",
      })
    ).toBe("/dashboard?resolvedSuggestionId=suggestion-1&resolvedContextDate=2026-03-09");
  });
});
