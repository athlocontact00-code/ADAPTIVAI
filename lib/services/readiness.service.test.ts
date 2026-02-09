import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
  db: {
    dailyCheckIn: { findFirst: vi.fn() },
    diaryEntry: { findFirst: vi.fn() },
    metricDaily: { findFirst: vi.fn() },
  },
}));

import { db } from "@/lib/db";
import { computeReadinessForUser, computeReadiness } from "./readiness.service";

describe("readiness.service", () => {
  beforeEach(() => {
    vi.mocked(db.dailyCheckIn.findFirst).mockResolvedValue(null);
    vi.mocked(db.diaryEntry.findFirst).mockResolvedValue(null);
    vi.mocked(db.metricDaily.findFirst).mockResolvedValue(null);
  });

  describe("computeReadinessForUser", () => {
    it("when daily_checkin exists for date, returns score from check-in (primary)", async () => {
      vi.mocked(db.dailyCheckIn.findFirst).mockResolvedValue({
        readinessScore: 78,
        topFactor: "Sleep",
        recommendation: "Proceed as planned",
        sleepQuality100: 80,
        fatigue100: 25,
        soreness100: 20,
      } as never);

      const result = await computeReadinessForUser("user-1", new Date("2026-02-06T12:00:00Z"));

      expect(result.score).toBe(78);
      expect(result.confidence).toBe("high");
      expect(result.source).toBe("checkin");
      expect(result.missing).toEqual([]);
      expect(result.status).toBe("OPTIMAL");
    });

    it("when no check-in but diary/metrics exist, returns estimated readiness", async () => {
      vi.mocked(db.diaryEntry.findFirst).mockResolvedValue({
        mood: 4,
        energy: 4,
        sleepHrs: 7.5,
        sleepQual: 4,
        stress: 2,
        soreness: 2,
      } as never);
      vi.mocked(db.metricDaily.findFirst).mockResolvedValue({
        atl: 40,
        ctl: 50,
        tsb: 5,
      } as never);

      const result = await computeReadinessForUser("user-1", new Date("2026-02-06T12:00:00Z"));

      expect(result.score).not.toBeNull();
      expect(typeof result.score).toBe("number");
      expect(result.source).toBe("estimated");
      expect(result.missing).toEqual([]);
    });

    it("when no check-in and no diary/metrics, returns score null and missing checkin", async () => {
      const result = await computeReadinessForUser("user-1", new Date("2026-02-06T12:00:00Z"));

      expect(result.score).toBeNull();
      expect(result.confidence).toBe("low");
      expect(result.missing).toContain("checkin");
      expect(result.source).toBeNull();
    });
  });

  describe("computeReadiness (signals only)", () => {
    it("computes score from diary + load signals", () => {
      const result = computeReadiness(
        { sleepQual: 4, sleepHrs: 7.5, mood: 4, energy: 4 },
        { tsb: 5, atl: 40, ctl: 50 }
      );
      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(100);
      expect(result.status).toMatch(/OPTIMAL|CAUTION|FATIGUED/);
    });
  });
});
