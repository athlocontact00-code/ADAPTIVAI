import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({
  db: {
    diaryEntry: {
      findMany: vi.fn(),
      count: vi.fn(),
    },
    aIMemory: {
      findMany: vi.fn(),
    },
  },
}));

import { db } from "@/lib/db";
import {
  getAIMemoryContextForPrompt,
  getAIMemorySummary,
  getLearnableEntries,
} from "./ai-memory.service";

describe("ai-memory.service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(db.diaryEntry.findMany).mockResolvedValue([]);
    vi.mocked(db.diaryEntry.count).mockResolvedValue(0);
    vi.mocked(db.aIMemory.findMany).mockResolvedValue([]);
  });

  it("splits learnable diary entries by visibility and excludes hidden entries", async () => {
    vi.mocked(db.diaryEntry.findMany).mockResolvedValue([
      {
        date: new Date("2026-03-01T12:00:00.000Z"),
        visibilityLevel: "FULL_AI_ACCESS",
        mood: 4,
        stress: 2,
        sleepQual: 4,
        motivation: 5,
        energy: 4,
        soreness: 2,
        notes: "Felt great after recovery day.",
      },
      {
        date: new Date("2026-03-02T12:00:00.000Z"),
        visibilityLevel: "METRICS_ONLY",
        mood: 3,
        stress: 3,
        sleepQual: 3,
        motivation: 3,
        energy: 3,
        soreness: 3,
        notes: "Should never reach AI memory as raw text.",
      },
      {
        date: new Date("2026-03-03T12:00:00.000Z"),
        visibilityLevel: "HIDDEN",
        mood: 1,
        stress: 5,
        sleepQual: 1,
        motivation: 1,
        energy: 1,
        soreness: 5,
        notes: "Hidden note",
      },
    ] as never);

    const result = await getLearnableEntries(
      "user-1",
      new Date("2026-03-01T00:00:00.000Z"),
      new Date("2026-03-07T23:59:59.000Z")
    );

    expect(result.fullAccess).toHaveLength(1);
    expect(result.fullAccess[0]?.notes).toBe("Felt great after recovery day.");
    expect(result.metricsOnly).toHaveLength(1);
    expect(result.metricsOnly[0]).not.toHaveProperty("notes");
  });

  it("builds AI memory summary with visibility score from visible diary entries", async () => {
    vi.mocked(db.aIMemory.findMany).mockResolvedValue([
      {
        memoryType: "PSYCHOLOGICAL",
        dataPoints: 7,
        updatedAt: new Date("2026-03-08T10:00:00.000Z"),
        profileDataJson: JSON.stringify({
          motivationBaseline: 4.1,
          motivationVariance: 0.3,
          stressTolerance: 3.8,
          stressRecoveryDays: 2,
          moodStability: 0.8,
          optimalMoodForTraining: 4,
        }),
      },
      {
        memoryType: "PREFERENCE",
        dataPoints: 5,
        updatedAt: new Date("2026-03-09T08:00:00.000Z"),
        profileDataJson: JSON.stringify({
          preferredSessionTypes: ["tempo", "long_run"],
          avoidedSessionTypes: ["brick"],
          intensityPreference: "MODERATE",
          volumePreference: "MODERATE",
          varietyPreference: 0.6,
        }),
      },
    ] as never);
    vi.mocked(db.diaryEntry.count)
      .mockResolvedValueOnce(10 as never)
      .mockResolvedValueOnce(4 as never);

    const summary = await getAIMemorySummary("user-1");

    expect(summary.totalDataPoints).toBe(12);
    expect(summary.visibilityScore).toBe(40);
    expect(summary.lastUpdated).toEqual(new Date("2026-03-09T08:00:00.000Z"));
    expect(summary.psychological?.motivationBaseline).toBe(4.1);
    expect(summary.preference?.preferredSessionTypes).toEqual(["tempo", "long_run"]);
  });

  it("adds limited-visibility guidance to AI memory prompt context", async () => {
    vi.mocked(db.aIMemory.findMany).mockResolvedValue([
      {
        memoryType: "FATIGUE_RESPONSE",
        dataPoints: 9,
        updatedAt: new Date("2026-03-09T08:00:00.000Z"),
        profileDataJson: JSON.stringify({
          recoveryRate: "NORMAL",
          fatigueThreshold: 3.2,
          sleepSensitivity: 0.74,
          optimalSleepHours: 8,
          energyPatterns: "CONSISTENT",
        }),
      },
    ] as never);
    vi.mocked(db.diaryEntry.count)
      .mockResolvedValueOnce(12 as never)
      .mockResolvedValueOnce(5 as never);

    const promptContext = await getAIMemoryContextForPrompt("user-1");

    expect(promptContext).toContain("## AI Memory Profile (9 data points, 42% visibility)");
    expect(promptContext).toContain("### Fatigue Response");
    expect(promptContext).toContain("Recovery rate: NORMAL");
    expect(promptContext).toContain("Limited diary visibility (42%)");
    expect(promptContext).not.toContain("raw text");
  });
});
