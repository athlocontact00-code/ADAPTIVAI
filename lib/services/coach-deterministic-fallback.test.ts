import { describe, expect, it } from "vitest";

import { buildDeterministicCoachFallback } from "./coach-deterministic-fallback";

const baseContext = {
  userProfile: {
    sportPrimary: "RUN",
  },
  planSummary: {
    today: "Easy day",
    keySessionsNext7d: [],
  },
  recentSignals: {
    checkIns7d: {
      items: [],
    },
  },
} as const;

describe("buildDeterministicCoachFallback", () => {
  it("returns greeting response with today summary", () => {
    const result = buildDeterministicCoachFallback({
      tone: "SUPPORTIVE",
      input: "Hey coach",
      context: {
        ...baseContext,
        planSummary: {
          ...baseContext.planSummary,
          todaySummary: "Easy aerobic run and mobility.",
        },
      },
    });

    expect(result.confidence).toBe(85);
    expect(result.text).toContain("How are you feeling today?");
    expect(result.text).toContain("Today: Easy aerobic run and mobility.");
    expect(result.text).toContain("What would you like");
  });

  it("returns low-readiness fallback with workout option", () => {
    const result = buildDeterministicCoachFallback({
      tone: "COACH",
      input: "Write me a workout for today",
      context: {
        ...baseContext,
        userProfile: { sportPrimary: "SWIM" },
        recentSignals: {
          checkIns7d: {
            items: [{ readinessScore: 32 }],
          },
        },
      },
    });

    expect(result.confidence).toBe(75);
    expect(result.text).toContain("take a recovery day or do easy movement");
    expect(result.text).toContain("45 min easy swim");
  });

  it("uses next key session when available", () => {
    const result = buildDeterministicCoachFallback({
      tone: "DIRECT",
      input: "What should I do?",
      context: {
        ...baseContext,
        planSummary: {
          today: "Easy day",
          keySessionsNext7d: [{ title: "Tempo Run", date: "2026-03-12" }],
        },
      },
    });

    expect(result.confidence).toBe(80);
    expect(result.text).toContain("focus on your next key session (Tempo Run) on 2026-03-12");
    expect(result.text).toContain("Next step: tell me how you slept");
  });

  it("adds uncertainty copy when there is no strong signal", () => {
    const result = buildDeterministicCoachFallback({
      tone: "SUPPORTIVE",
      input: "Any advice?",
      context: baseContext,
    });

    expect(result.confidence).toBe(65);
    expect(result.text).toContain("keep today simple");
    expect(result.text).toContain("my confidence is around 65%");
  });
});
