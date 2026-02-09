import { describe, it, expect } from "vitest";
import { computeLoadFromDailyTSS } from "./metrics";

describe("computeLoadFromDailyTSS", () => {
  it("returns null for empty array", () => {
    expect(computeLoadFromDailyTSS([])).toBeNull();
  });

  it("returns null when all TSS are zero", () => {
    expect(
      computeLoadFromDailyTSS([
        { date: "2025-01-01", tss: 0 },
        { date: "2025-01-02", tss: 0 },
      ])
    ).toBeNull();
  });

  it("returns CTL/ATL/TSB and series when there is at least one non-zero TSS", () => {
    const result = computeLoadFromDailyTSS([
      { date: "2025-01-01", tss: 50 },
      { date: "2025-01-02", tss: 70 },
    ]);
    expect(result).not.toBeNull();
    expect(result!.series).toHaveLength(2);
    expect(typeof result!.ctl).toBe("number");
    expect(typeof result!.atl).toBe("number");
    expect(typeof result!.tsb).toBe("number");
    expect(result!.tsb).toBe(result!.ctl - result!.atl);
  });

  it("EMA: second day CTL is between first day TSS and second day TSS", () => {
    const result = computeLoadFromDailyTSS([
      { date: "2025-01-01", tss: 100 },
      { date: "2025-01-02", tss: 0 },
    ]);
    expect(result).not.toBeNull();
    expect(result!.series[0].ctl).toBe(100);
    expect(result!.series[1].ctl).toBeLessThan(100);
    expect(result!.series[1].ctl).toBeGreaterThan(0);
  });

  it("EMA: ATL responds faster than CTL (tau 7 vs 42)", () => {
    const result = computeLoadFromDailyTSS([
      { date: "2025-01-01", tss: 100 },
      { date: "2025-01-02", tss: 0 },
      { date: "2025-01-03", tss: 0 },
    ]);
    expect(result).not.toBeNull();
    const [, day1, day2] = result!.series;
    expect(day1.atl).toBeLessThan(day1.ctl);
    expect(day2.atl).toBeLessThan(day2.ctl);
    expect(day2.atl).toBeLessThan(day1.atl);
    expect(day2.ctl).toBeLessThan(day1.ctl);
  });
});
