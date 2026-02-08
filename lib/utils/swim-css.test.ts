import { describe, it, expect } from "vitest";
import {
  paceSecPer100m,
  inferCssSecPer100m,
  type SwimRepeat,
} from "./swim-css";

describe("paceSecPer100m", () => {
  it("computes pace for 100m in 90 sec", () => {
    expect(paceSecPer100m(100, 90)).toBe(90);
  });

  it("computes pace for 400m in 360 sec", () => {
    expect(paceSecPer100m(400, 360)).toBe(90);
  });

  it("returns 0 for zero distance", () => {
    expect(paceSecPer100m(0, 90)).toBe(0);
  });
});

describe("inferCssSecPer100m", () => {
  it("returns null for empty or single repeat", () => {
    expect(inferCssSecPer100m([])).toBe(null);
    expect(inferCssSecPer100m([{ distanceM: 100, timeSec: 90 }])).toBe(null);
  });

  it("infers CSS from 10x100 repeats", () => {
    // 10×100m all at 90 sec/100m -> median 90, +2–5 -> ~92–95
    const repeats: SwimRepeat[] = Array.from({ length: 10 }, (_, i) => ({
      rep: i + 1,
      distanceM: 100,
      timeSec: 88 + i * 2, // 88–106 sec
      restSec: 15,
    }));
    const css = inferCssSecPer100m(repeats, { rpe: 8, typicalRestSec: 15 });
    expect(css).not.toBe(null);
    expect(css).toBeGreaterThanOrEqual(90);
    expect(css).toBeLessThanOrEqual(100);
  });

  it("uses higher add when RPE is lower", () => {
    const repeats: SwimRepeat[] = [
      { distanceM: 100, timeSec: 95 },
      { distanceM: 100, timeSec: 97 },
      { distanceM: 100, timeSec: 96 },
    ];
    const cssLowRpe = inferCssSecPer100m(repeats, { rpe: 5 });
    const cssHighRpe = inferCssSecPer100m(repeats, { rpe: 8 });
    expect(cssLowRpe).not.toBe(null);
    expect(cssHighRpe).not.toBe(null);
    expect(cssLowRpe!).toBeGreaterThanOrEqual(cssHighRpe!);
  });
});
