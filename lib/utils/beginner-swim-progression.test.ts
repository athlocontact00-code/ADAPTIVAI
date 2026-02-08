import { describe, it, expect } from "vitest";
import { getBeginnerSwimTargetMeters } from "./beginner-swim-progression";

describe("getBeginnerSwimTargetMeters", () => {
  it("returns 900–1400m for phase 1 (week 1–2)", () => {
    const t = getBeginnerSwimTargetMeters(1);
    expect(t.minMeters).toBe(900);
    expect(t.maxMeters).toBe(1400);
    expect(t.drillRatioMin).toBe(0.3);
    expect(t.drillRatioMax).toBe(0.4);
  });

  it("returns 1200–1800m for phase 2 (week 3–4)", () => {
    const t = getBeginnerSwimTargetMeters(2);
    expect(t.minMeters).toBe(1200);
    expect(t.maxMeters).toBe(1800);
  });

  it("returns 1500–2200m for phase 3 (week 5–6)", () => {
    const t = getBeginnerSwimTargetMeters(3);
    expect(t.minMeters).toBe(1500);
    expect(t.maxMeters).toBe(2200);
  });
});
