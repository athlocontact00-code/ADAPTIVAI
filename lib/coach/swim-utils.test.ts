import { describe, it, expect } from "vitest";
import {
  parseSwimPR,
  computePaces,
  ensureExactTotalMeters,
  getClaimedTotalMeters,
} from "./swim-utils";
import { parseSwimMetersFromText } from "@/lib/utils/swim-meters";

describe("parseSwimPR", () => {
  it("parses 400m in 4:40 to distanceM 400 and timeSec 280", () => {
    const pr = parseSwimPR("400m in 4:40");
    expect(pr).not.toBeNull();
    expect(pr!.distanceM).toBe(400);
    expect(pr!.timeSec).toBe(280);
  });

  it("parses 4:40 for 400m", () => {
    const pr = parseSwimPR("4:40 for 400m");
    expect(pr).not.toBeNull();
    expect(pr!.distanceM).toBe(400);
    expect(pr!.timeSec).toBe(280);
  });

  it("returns null when no distance or time", () => {
    expect(parseSwimPR("hello")).toBeNull();
    expect(parseSwimPR("400m only")).toBeNull();
  });
});

describe("computePaces", () => {
  it("derives per100 ~70s from 400m in 4:40 (280 sec)", () => {
    const paces = computePaces({ distanceM: 400, timeSec: 280 });
    expect(paces.cssLikePer100Sec).toBe(70);
    expect(paces.aerobicPer100Sec).toBe(80);
    expect(paces.thresholdPer100Sec).toBe(73);
    expect(paces.vo2Per100Sec).toBe(67);
  });
});

describe("ensureExactTotalMeters", () => {
  it("adjusts 3200m draft down to 3000m without leaving 'drop' or 'correction' in output", () => {
    // 400 + 800 + 1600 + 400 = 3200
    const text = `Warm-up: 400m
Main: 8×100m, 4×400m
Cool-down: 400m`;
    const result = ensureExactTotalMeters(text, 3000);
    const computed = parseSwimMetersFromText(result);
    expect(computed).toBe(3000);
    expect(result.toLowerCase()).not.toMatch(/drop|correction|minus|zamiast/);
  });

  it("returns original when already exact", () => {
    const text = "Warm-up: 400m\nMain: 8×100m\nCool-down: 200m\nTOTAL: 1400m";
    const result = ensureExactTotalMeters(text, 1400);
    expect(result).toBe(text);
  });
});

describe("getClaimedTotalMeters", () => {
  it("extracts claimed total from TOTAL METERS: 3000", () => {
    expect(getClaimedTotalMeters("TOTAL METERS: 3000")).toBe(3000);
  });
  it("returns null when no claim", () => {
    expect(getClaimedTotalMeters("just some text")).toBeNull();
  });
});
