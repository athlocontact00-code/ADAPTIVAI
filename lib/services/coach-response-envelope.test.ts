import { describe, expect, it } from "vitest";

import {
  buildCoachErrorResult,
  buildCoachSuccessResult,
} from "./coach-response-envelope";

describe("coach response envelope", () => {
  it("builds success payload with decremented remaining and optional created ids", () => {
    expect(
      buildCoachSuccessResult({
        text: "ok",
        usedLLM: false,
        confidence: 90,
        tone: "SUPPORTIVE",
        isPro: true,
        dailyLimit: 100,
        remaining: 10,
        createdWorkoutIds: ["w1"],
      })
    ).toEqual({
      ok: true,
      text: "ok",
      meta: {
        usedLLM: false,
        confidence: 90,
        tone: "SUPPORTIVE",
        isPro: true,
        limit: { daily: 100, remaining: 9 },
        createdWorkoutIds: ["w1"],
      },
    });
  });

  it("builds error payload with optional limit metadata", () => {
    expect(
      buildCoachErrorResult({
        code: "RATE_LIMIT",
        error: "Daily limit reached",
        isPro: false,
        dailyLimit: 15,
        remaining: 0,
      })
    ).toEqual({
      ok: false,
      code: "RATE_LIMIT",
      error: "Daily limit reached",
      meta: {
        isPro: false,
        limit: { daily: 15, remaining: 0 },
      },
    });
  });
});
