import { describe, it, expect } from "vitest";
import {
  detectSportInResponse,
  validateSportCorrectness,
  validateSwimMetersCompleteness,
  deriveExpectedSport,
} from "./coach-gates";

describe("detectSportInResponse", () => {
  it("detects SWIM from pool and meters", () => {
    const text = "## Technique & Endurance Swim\n**Duration:** 60 min\n**TOTAL METERS:** 2400\nWarm-up 400m easy.";
    expect(detectSportInResponse(text)).toBe("SWIM");
  });

  it("detects RUN from run and pace", () => {
    const text = "## Easy Run\n**Goal:** Aerobic. Keep pace 5:30/km.";
    expect(detectSportInResponse(text)).toBe("RUN");
  });

  it("detects BIKE from bike and watts", () => {
    const text = "## Tempo Ride\n**Goal:** 75% FTP, 45 min.";
    expect(detectSportInResponse(text)).toBe("BIKE");
  });

  it("returns null for generic text", () => {
    expect(detectSportInResponse("Hello, how can I help?")).toBe(null);
  });
});

describe("validateSportCorrectness", () => {
  it("valid when detected matches expected", () => {
    const text = "## Easy Run\nPace 5:30/km.";
    expect(validateSportCorrectness(text, "RUN")).toEqual({ valid: true, detectedSport: "RUN" });
  });

  it("invalid when detected differs from expected", () => {
    const text = "## Easy Run\nPace 5:30/km.";
    expect(validateSportCorrectness(text, "SWIM")).toEqual({ valid: false, detectedSport: "RUN" });
  });

  it("valid when no expected sport", () => {
    expect(validateSportCorrectness("Any text", null)).toEqual({ valid: true, detectedSport: null });
  });
});

describe("validateSwimMetersCompleteness", () => {
  it("valid when TOTAL METERS present", () => {
    expect(validateSwimMetersCompleteness("**TOTAL METERS:** 2400")).toBe(true);
  });

  it("valid when distances parseable", () => {
    expect(validateSwimMetersCompleteness("4x50m drill, 8x100m main")).toBe(true);
  });

  it("invalid when no distances", () => {
    expect(validateSwimMetersCompleteness("Easy swim, focus on technique.")).toBe(false);
  });
});

describe("deriveExpectedSport", () => {
  it("returns SWIM for 'I am a swimmer' and 'I'm a swimmer'", () => {
    expect(deriveExpectedSport("I am a swimmer", null)).toBe("SWIM");
    expect(deriveExpectedSport("I'm a swimmer", null)).toBe("SWIM");
  });

  it("returns SWIM for primary sport when message has no sport", () => {
    expect(deriveExpectedSport("Give me a workout", "SWIM")).toBe("SWIM");
  });

  it("returns null when no signal", () => {
    expect(deriveExpectedSport("What's the weather?", null)).toBe(null);
  });
});
