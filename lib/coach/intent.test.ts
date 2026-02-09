import { describe, it, expect } from "vitest";
import { extractCoachIntentFull, getCoachActionIntent, validateWorkoutMatchesIntent } from "./intent";

describe("extractCoachIntentFull", () => {
  it("parses 'add a swim session for tomorrow for 3500m' -> sport SWIM, date tomorrow, swimMeters 3500", () => {
    const intent = extractCoachIntentFull("add a swim session for tomorrow for 3500m");
    expect(intent.sport).toBe("SWIM");
    expect(intent.targetDateISO).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(intent.swimMeters).toBe(3500);
    expect(["generate", "generate_and_add", "add_to_calendar"]).toContain(intent.mode);
  });

  it("parses 'generate a swim session for today 3000m and send it to calendar' -> sport SWIM, today, 3000m", () => {
    const intent = extractCoachIntentFull("generate a swim session for today 3000m and send it to calendar");
    expect(intent.sport).toBe("SWIM");
    expect(intent.targetDateISO).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(intent.swimMeters).toBe(3000);
  });

  it("parses 'change tomorrow's workout to 3500m' -> mode change, swimMeters 3500 when defaultSport SWIM", () => {
    const intent = extractCoachIntentFull("change tomorrow's workout to 3500m", { defaultSport: "SWIM" });
    expect(intent.mode).toBe("change");
    expect(intent.swimMeters).toBe(3500);
    expect(intent.sport).toBe("SWIM");
  });

  it("parses 'tomorrow 3500m swim' -> swimMeters 3500, sport SWIM", () => {
    const intent = extractCoachIntentFull("tomorrow 3500m swim");
    expect(intent.swimMeters).toBe(3500);
    expect(intent.sport).toBe("SWIM");
    expect(intent.targetDateISO).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe("getCoachActionIntent", () => {
  it("returns ADD_TO_CALENDAR for 'add to calendar' (no generate phrase)", () => {
    const intent = extractCoachIntentFull("add to calendar");
    expect(intent.mode).toBe("add_to_calendar");
    expect(getCoachActionIntent("add to calendar", intent)).toBe("ADD_TO_CALENDAR");
  });

  it("returns ADD_TO_CALENDAR for 'dodaj do kalendarza'", () => {
    const intent = extractCoachIntentFull("dodaj do kalendarza");
    expect(getCoachActionIntent("dodaj do kalendarza", intent)).toBe("ADD_TO_CALENDAR");
  });

  it("returns GENERATE for 'swim 3500m tomorrow'", () => {
    const intent = extractCoachIntentFull("swim 3500m tomorrow");
    expect(getCoachActionIntent("swim 3500m tomorrow", intent)).toBe("GENERATE");
  });

  it("returns CHANGE for 'change tomorrow's workout to 3000m'", () => {
    const intent = extractCoachIntentFull("change tomorrow's workout to 3000m", { defaultSport: "SWIM" });
    expect(intent.mode).toBe("change");
    expect(getCoachActionIntent("change tomorrow's workout to 3000m", intent)).toBe("CHANGE");
  });

  it("returns QUESTION_ONLY for short question without workout keywords", () => {
    const intent = extractCoachIntentFull("why did you give me that?");
    expect(getCoachActionIntent("why did you give me that?", intent)).toBe("QUESTION_ONLY");
  });
});

describe("validateWorkoutMatchesIntent", () => {
  it("rejects payload with wrong sport when user asked for swim", () => {
    const intent = {
      sport: "SWIM" as const,
      targetDateISO: "2025-02-07",
      swimMeters: 3500,
      durationMin: null,
      mode: "generate" as const,
      confidence: 80,
      raw: {} as never,
    };
    const payload = {
      items: [
        { sport: "RUN", date: "2025-02-07", title: "Steady Run", descriptionMd: "60 min", totalDistanceMeters: null },
      ],
    };
    const result = validateWorkoutMatchesIntent(intent, payload);
    expect(result.valid).toBe(false);
    expect(result.valid === false && result.mismatchReason).toMatch(/Sport mismatch|SWIM.*RUN/);
  });

  it("rejects swim payload with 1800m when user asked 3500m (regression: never use 1800m default)", () => {
    const intent = {
      sport: "SWIM" as const,
      targetDateISO: "2025-02-07",
      swimMeters: 3500,
      durationMin: null,
      mode: "generate" as const,
      confidence: 80,
      raw: {} as never,
    };
    const payload = {
      items: [
        {
          sport: "SWIM",
          date: "2025-02-07",
          title: "Technique & Endurance Swim",
          descriptionMd: "Warm-up 400m\nMain 1000m\nCool-down 400m",
          totalDistanceMeters: 1800,
        },
      ],
    };
    const result = validateWorkoutMatchesIntent(intent, payload);
    expect(result.valid).toBe(false);
    expect(result.valid === false && result.offByMeters).toBe(1700);
  });

  it("accepts payload when sport, date, and totalMeters match intent", () => {
    const intent = {
      sport: "SWIM" as const,
      targetDateISO: "2025-02-07",
      swimMeters: 3500,
      durationMin: null,
      mode: "generate" as const,
      confidence: 80,
      raw: {} as never,
    };
    const payload = {
      items: [
        {
          sport: "SWIM",
          date: "2025-02-07",
          title: "Swim 3500m",
          descriptionMd: "Warm-up 400m\nMain 2700m\nCool-down 400m",
          totalDistanceMeters: 3500,
        },
      ],
    };
    const result = validateWorkoutMatchesIntent(intent, payload);
    expect(result.valid).toBe(true);
  });
});
