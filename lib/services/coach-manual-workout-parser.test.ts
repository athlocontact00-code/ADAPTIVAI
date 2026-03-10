import { describe, expect, it } from "vitest";

import {
  parseCoachDateFromText,
  parseCoachExtraTargets,
  parseCoachSectionsFromInput,
  parseCoachWorkoutDraft,
} from "./coach-manual-workout-parser";

describe("parseCoachDateFromText", () => {
  it("parses ISO and relative dates", () => {
    const now = new Date(2026, 2, 9, 12, 0, 0, 0);
    expect(parseCoachDateFromText("2026-03-12 easy run", now)?.toISOString()).toContain("2026-03-12");
    expect(parseCoachDateFromText("run tomorrow", now)?.toISOString()).toContain("2026-03-10");
    expect(parseCoachDateFromText("swim in 3 days", now)?.toISOString()).toContain("2026-03-12");
  });
});

describe("parseCoachSectionsFromInput", () => {
  it("extracts warm-up, main set, and cool-down", () => {
    const sections = parseCoachSectionsFromInput(`Warm-up: 10 min easy
Main set: 4x5 min threshold
Cool-down: 10 min easy`);
    expect(sections.warmUpText).toBe("10 min easy");
    expect(sections.mainSetText).toBe("4x5 min threshold");
    expect(sections.coolDownText).toBe("10 min easy");
  });
});

describe("parseCoachExtraTargets", () => {
  it("extracts pace, HR, cadence, power, and distance targets", () => {
    const targets = parseCoachExtraTargets("pace 4:20-4:30/km hr 140-155 bpm cadence 170-176 power 220-240w 12km");
    expect(targets).toEqual(
      expect.arrayContaining([
        { label: "Pace", value: "4:20–4:30/km" },
        { label: "HR", value: "140–155 bpm" },
        { label: "Cadence", value: "170–176 spm" },
        { label: "Power", value: "220–240 W" },
        { label: "Distance", value: "12 km" },
      ])
    );
  });
});

describe("parseCoachWorkoutDraft", () => {
  it("fails when no date is provided", () => {
    expect(parseCoachWorkoutDraft("easy run 45 min", new Date())).toEqual({
      ok: false,
      error: "Podaj dzień treningu (np. 2026-02-05 albo 'jutro').",
    });
  });

  it("parses manual run draft with heuristic main set and targets", () => {
    const result = parseCoachWorkoutDraft(
      '2026-03-12 tempo run 50 min pace 4:20-4:30/km cadence 176-182 "Track Session" 4x5 min threshold',
      new Date(2026, 2, 9, 12, 0, 0, 0)
    );
    expect(result.ok).toBe(true);
    expect(result.data).toEqual(
      expect.objectContaining({
        type: "run",
        intensity: "moderate",
        title: "Track Session",
        durationMin: 50,
      })
    );
    expect(result.data?.mainSetText).toContain("4x5 min threshold");
    expect(result.data?.extraTargets).toEqual(
      expect.arrayContaining([
        { label: "Pace", value: "4:20–4:30/km" },
        { label: "Cadence", value: "176–182 spm" },
      ])
    );
  });

  it("parses strength draft with explicit sections", () => {
    const result = parseCoachWorkoutDraft(
      `tomorrow strength 45 min
Warm-up: 5 min bike
Main set: split squat 3x8
Cool-down: mobility`,
      new Date(2026, 2, 9, 12, 0, 0, 0)
    );
    expect(result.ok).toBe(true);
    expect(result.data).toEqual(
      expect.objectContaining({
        type: "strength",
        durationMin: 45,
        warmUpText: "5 min bike",
        mainSetText: "split squat 3x8",
        coolDownText: "mobility",
      })
    );
  });
});
