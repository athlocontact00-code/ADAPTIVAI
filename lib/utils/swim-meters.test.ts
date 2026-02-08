import { describe, it, expect } from "vitest";
import { parseSwimMetersFromText } from "./swim-meters";

describe("parseSwimMetersFromText", () => {
  it("sums single distances", () => {
    expect(parseSwimMetersFromText("400m easy")).toBe(400);
    expect(parseSwimMetersFromText("Warm-up 200m")).toBe(200);
  });

  it("sums 4x50 + 3x400 style", () => {
    expect(parseSwimMetersFromText("4x50m drill, 3x400m main")).toBe(200 + 1200);
    expect(parseSwimMetersFromText("4×50m and 3×400m")).toBe(200 + 1200);
  });

  it("handles space and optional m", () => {
    expect(parseSwimMetersFromText("8 x 100m")).toBe(800);
    expect(parseSwimMetersFromText("2*200")).toBe(400);
  });

  it("returns null for no distances", () => {
    expect(parseSwimMetersFromText("Easy run 30 min")).toBe(null);
    expect(parseSwimMetersFromText("")).toBe(null);
  });

  it("ignores unrealistic values", () => {
    const t = parseSwimMetersFromText("99999m");
    expect(t).toBe(null);
  });
});
