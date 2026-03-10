import { describe, expect, it } from "vitest";

import {
  buildSportCorrectionPrompt,
  buildStructureCorrectionPrompt,
  buildStrictJsonCorrectionPrompt,
  buildSwimMetersCorrectionPrompt,
  buildSwimPoolLengthClarification,
  maybeRepairSwimPayloadToIntent,
  shouldBlockSwimSaveAfterRetry,
  shouldRetryCalendarPayloadAsStrictJson,
} from "./coach-correction-orchestrator";
import type { CoachIntentResult } from "@/lib/coach/intent";

const swimIntent: CoachIntentResult = {
  sport: "SWIM",
  targetDateISO: "2026-03-10",
  swimMeters: 3000,
  durationMin: null,
  mode: "generate",
  confidence: 0.9,
  raw: {
    action: "CREATE_WORKOUT",
    sport: "SWIM",
    constraints: { date: "2026-03-10", distanceM: 3000 },
  },
};

describe("coach correction orchestrator", () => {
  it("builds sport correction prompt", () => {
    expect(buildSportCorrectionPrompt("BASE", "SWIM", "RUN")).toContain(
      "The user asked for SWIM. Your reply was about RUN."
    );
  });

  it("builds swim meters correction prompt", () => {
    expect(buildSwimMetersCorrectionPrompt("BASE")).toContain("include a line \"TOTAL METERS: <sum>\"");
  });

  it("builds structure correction prompt with missing fields", () => {
    const prompt = buildStructureCorrectionPrompt({
      userPrompt: "BASE",
      expectedSport: "RUN",
      missing: ["warm-up", "cool-down"],
    });
    expect(prompt).toContain("complete, save-ready RUN session");
    expect(prompt).toContain("Missing elements: warm-up, cool-down");
  });

  it("repairs near-match swim payload and revalidates it", () => {
    const repaired = maybeRepairSwimPayloadToIntent({
      intent: swimIntent,
      payload: {
        calendarInsert: true,
        mode: "final",
        items: [
          {
            date: "2026-03-10",
            sport: "SWIM",
            title: "Almost Right Swim",
            durationMin: 60,
            descriptionMd:
              "Warm-up: 400m easy.\nMain set: 20x100m threshold, rest 20s.\nCool-down: 400m easy.\nTOTAL METERS: 2800",
            prescriptionJson: { steps: [] },
            totalDistanceMeters: 2800,
          },
        ],
      },
      validation: {
        valid: false,
        mismatchReason: "Swim meters mismatch: user asked 3000m, got 2800m",
        offByMeters: 200,
      },
    });

    expect(repaired.repaired).toBe(true);
    expect(repaired.validation.valid).toBe(true);
    expect(repaired.payload.items[0].totalDistanceMeters).toBe(3000);
    expect(repaired.payload.items[0].descriptionMd).toContain("TOTAL METERS: 3000");
  });

  it("does not repair large swim mismatch", () => {
    const repaired = maybeRepairSwimPayloadToIntent({
      intent: swimIntent,
      payload: {
        calendarInsert: true,
        mode: "final",
        items: [
          {
            date: "2026-03-10",
            sport: "SWIM",
            title: "Wrong Swim",
            durationMin: 60,
            descriptionMd: "TOTAL METERS: 1800",
            prescriptionJson: { steps: [] },
            totalDistanceMeters: 1800,
          },
        ],
      },
      validation: {
        valid: false,
        mismatchReason: "Swim meters mismatch",
        offByMeters: 1200,
      },
    });

    expect(repaired.repaired).toBe(false);
    expect(repaired.validation.valid).toBe(false);
  });

  it("decides when strict JSON retry is needed", () => {
    expect(
      shouldRetryCalendarPayloadAsStrictJson({
        valid: false,
        mismatchReason: "Sport mismatch",
      })
    ).toBe(true);
    expect(
      shouldRetryCalendarPayloadAsStrictJson({
        valid: false,
        mismatchReason: "Swim meters mismatch",
        offByMeters: 200,
      })
    ).toBe(false);
  });

  it("builds strict JSON correction prompt", () => {
    const prompt = buildStrictJsonCorrectionPrompt("BASE", swimIntent);
    expect(prompt).toContain("Output ONLY a JSON code block");
    expect(prompt).toContain("sport=SWIM");
    expect(prompt).toContain("totalMeters=3000");
  });

  it("builds swim hard guard clarification", () => {
    expect(buildSwimPoolLengthClarification(3000)).toContain("25 m lub 50 m");
    expect(
      shouldBlockSwimSaveAfterRetry(swimIntent, {
        valid: false,
        mismatchReason: "Swim meters mismatch",
        offByMeters: 1200,
      })
    ).toBe(true);
  });
});
