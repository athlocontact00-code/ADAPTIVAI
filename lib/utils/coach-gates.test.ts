import { describe, it, expect } from "vitest";
import {
  detectSportInResponse,
  validateSportCorrectness,
  validateSwimMetersCompleteness,
  validateWorkoutStructure,
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

describe("validateWorkoutStructure", () => {
  it("accepts a complete swim workout with sections, meters, targets, and rest", () => {
    const result = validateWorkoutStructure(`TITLE: Threshold Swim
SPORT: SWIM
WARM-UP:
400m easy

MAIN SET:
10x100m at threshold pace, rest 20s

COOL-DOWN:
200m easy

TOTAL METERS: 1600
TARGETS:
RPE 7`, "SWIM");
    expect(result.valid).toBe(true);
    expect(result.missing).toEqual([]);
  });

  it("flags missing swim structure and targets", () => {
    const result = validateWorkoutStructure("Easy swim today, focus on feel for water.", "SWIM");
    expect(result.valid).toBe(false);
    expect(result.missing).toContain("warm-up");
    expect(result.missing).toContain("main set");
    expect(result.missing).toContain("cool-down");
    expect(result.missing).toContain("explicit swim meters");
  });

  it("accepts a run workout with warm-up, main set, cool-down, and intensity", () => {
    const result = validateWorkoutStructure(`Warm-up 15 min easy.
Main set: 4x5 min at threshold pace, 2 min jog.
Cool-down 10 min easy.
Targets: pace 4:25/km, RPE 7.`, "RUN");
    expect(result.valid).toBe(true);
  });

  it("requires core and sets x reps for strength", () => {
    const result = validateWorkoutStructure(`WARM-UP:
5 min bike

MAIN SET:
3x8 goblet squat, 75s rest, RPE 7

CORE:
dead bug 3x8/side

COOL-DOWN:
mobility`, "STRENGTH");
    expect(result.valid).toBe(true);
  });

  it("flags incomplete strength workouts", () => {
    const result = validateWorkoutStructure("Strength session. Do some lifting.", "STRENGTH");
    expect(result.valid).toBe(false);
    expect(result.missing).toContain("core section");
    expect(result.missing).toContain("sets x reps");
    expect(result.missing).toContain("RPE/tempo/rest cues");
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
