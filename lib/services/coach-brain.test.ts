import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
  db: {
    workout: {
      findFirst: vi.fn(),
      update: vi.fn(),
      create: vi.fn(),
    },
  },
}));
vi.mock("@/lib/logger", () => ({ logInfo: vi.fn(), logError: vi.fn() }));

import { db } from "@/lib/db";
import {
  resolveSessionIntent,
  generateRubricPrescription,
  saveWorkoutIdempotent,
  rubricToCalendarItem,
  type CoachBrainContext,
} from "./coach-brain";

function minimalContext(todayStr: string): CoachBrainContext {
  return {
    aiContext: {
      planSummary: { today: todayStr },
      userProfile: {
        swimLevel: "age_group",
        swimPoolLengthM: 25,
        experienceLevel: "intermediate",
        identityMode: "competitive",
        sportPrimary: "RUN",
      },
      zones: {
        hr: { z2: { min: 120, max: 140 }, z3: { min: 141, max: 160 } },
        power: { ftp: 200 },
      },
      todayCheckin: null,
    } as unknown as CoachBrainContext["aiContext"],
    recentWorkouts: [],
    plannedWorkoutsThisWeek: [],
    loadMetrics: { currentWeekLoad: 0, previousWeekLoad: 0, rampRate: null, status: "ok" },
    hardSessionsThisWeek: 0,
    aimemorySummary: null as never,
  };
}

describe("resolveSessionIntent", () => {
  it("parses 'tomorrow 3500m swim' -> sport SWIM, targetMeters 3500", () => {
    const ctx = minimalContext("2026-02-09");
    const intent = resolveSessionIntent("tomorrow 3500m swim", ctx);
    expect(intent).not.toBeNull();
    expect(intent!.sport).toBe("SWIM");
    expect(intent!.targetMeters).toBe(3500);
    expect(intent!.date).toBe("2026-02-10");
  });

  it("parses 'change tomorrow's workout to 3500m' -> replaceIntent true, targetMeters 3500", () => {
    const ctx = minimalContext("2026-02-09");
    const intent = resolveSessionIntent("change tomorrow's workout to 3500m", ctx);
    expect(intent).not.toBeNull();
    expect(intent!.replaceIntent).toBe(true);
    expect(intent!.targetMeters).toBe(3500);
  });

  it("parses 'write me a swim session for 3500m for tomorrow' -> targetMeters 3500, sport SWIM", () => {
    const ctx = minimalContext("2026-02-09");
    const intent = resolveSessionIntent("write me a swim session for 3500m for tomorrow", ctx);
    expect(intent).not.toBeNull();
    expect(intent!.sport).toBe("SWIM");
    expect(intent!.targetMeters).toBe(3500);
  });
});

describe("generateRubricPrescription", () => {
  it("uses targetMeters 3500 and title 'Swim 3500m' when intent has targetMeters", () => {
    const ctx = minimalContext("2026-02-09");
    const intent = {
      kind: "single" as const,
      sport: "SWIM" as const,
      date: "2026-02-10",
      addToCalendar: true,
      createSeparate: false,
      targetMeters: 3500,
      replaceIntent: false,
    };
    const prescription = generateRubricPrescription(intent, ctx);
    expect(prescription.title).toBe("Swim 3500m");
    const total =
      prescription.warmup.reduce((s, x) => s + (x.distanceM ?? 0), 0) +
      prescription.main.reduce((s, x) => s + (x.distanceM ?? 0), 0) +
      prescription.cooldown.reduce((s, x) => s + (x.distanceM ?? 0), 0);
    expect(total).toBe(3500);
  });

  it("does not return 'Technique & Endurance Swim' when targetMeters is 3500", () => {
    const ctx = minimalContext("2026-02-09");
    const intent = {
      kind: "single" as const,
      sport: "SWIM" as const,
      date: "2026-02-10",
      addToCalendar: true,
      createSeparate: false,
      targetMeters: 3500,
      replaceIntent: false,
    };
    const prescription = generateRubricPrescription(intent, ctx);
    expect(prescription.title).not.toBe("Technique & Endurance Swim");
    expect(prescription.title).toBe("Swim 3500m");
  });

  it("STRENGTH prescription has title, sport STRENGTH, durationMin, main includes core block (add-to-calendar ready)", () => {
    const ctx = minimalContext("2026-02-09");
    const intent = {
      kind: "single" as const,
      sport: "STRENGTH" as const,
      date: "2026-02-10",
      addToCalendar: true,
      createSeparate: false,
      replaceIntent: false,
    };
    const prescription = generateRubricPrescription(intent, ctx);
    expect(prescription.sport).toBe("STRENGTH");
    expect(prescription.title).toMatch(/Strength/);
    expect(prescription.durationMin).toBeGreaterThanOrEqual(20);
    const mainText = prescription.main.map((m) => m.description).join(" ");
    expect(mainText).toMatch(/[Cc]ore/);
    const item = rubricToCalendarItem(prescription);
    expect(item.descriptionMd).toMatch(/STRENGTH|Strength/);
    expect(item.prescriptionJson).toBeDefined();
  });

  it("STRENGTH with 45 min intent produces ~45 min total and add-to-calendar payload", () => {
    const ctx = minimalContext("2026-02-09");
    const intent = {
      kind: "single" as const,
      sport: "STRENGTH" as const,
      date: "2026-02-10",
      addToCalendar: true,
      createSeparate: false,
      replaceIntent: false,
      durationMinHint: 45,
    };
    const prescription = generateRubricPrescription(intent, ctx);
    expect(prescription.sport).toBe("STRENGTH");
    expect(prescription.durationMin).toBe(45);
    const item = rubricToCalendarItem(prescription);
    expect(item).toBeDefined();
    expect(prescription.warmup.length + prescription.main.length + prescription.cooldown.length).toBeGreaterThan(0);
  });

  it("STRENGTH with strengthMobilityOnly (e.g. shoulder pain) returns mobility-only, no heavy compound", () => {
    const ctx: CoachBrainContext = {
      ...minimalContext("2026-02-09"),
      strengthMobilityOnly: true,
    };
    const intent = {
      kind: "single" as const,
      sport: "STRENGTH" as const,
      date: "2026-02-10",
      addToCalendar: true,
      createSeparate: false,
      replaceIntent: false,
    };
    const prescription = generateRubricPrescription(intent, ctx);
    expect(prescription.sport).toBe("STRENGTH");
    expect(prescription.title).toMatch(/Mobility/);
    const mainText = prescription.main.map((m) => m.description).join(" ");
    expect(mainText).toMatch(/[Mm]obility|[Pp]rehab|avoid load|No heavy/);
    expect(prescription.intensityTargets.rpe).toMatch(/3–4|light/);
  });
});

describe("saveWorkoutIdempotent", () => {
  const prescription = {
    sport: "SWIM" as const,
    date: "2026-02-10",
    title: "Swim 3500m",
    durationMin: 75,
    goal: "Swim",
    warmup: [{ description: "400m easy", durationMin: 5, distanceM: 400 }],
    main: [{ description: "2700m main", durationMin: 50, distanceM: 2700 }],
    cooldown: [{ description: "400m easy", durationMin: 5, distanceM: 400 }],
    techniqueCues: [],
    intensityTargets: { rpe: "RPE 4" },
    rationale: "Test",
  } as Parameters<typeof saveWorkoutIdempotent>[1];

  beforeEach(() => {
    vi.mocked(db.workout.findFirst).mockResolvedValue(null);
    vi.mocked(db.workout.create).mockResolvedValue({ id: "new-id" } as never);
    vi.mocked(db.workout.update).mockResolvedValue({} as never);
  });

  it("when mode=replace and existing workout found, updates and returns created: false, updated: true", async () => {
    vi.mocked(db.workout.findFirst).mockResolvedValue({
      id: "existing-id",
      title: "Technique & Endurance Swim",
      descriptionMd: "Warm 200m\nMain 1400m\nCool 200m",
      durationMin: 45,
      distanceM: 1800,
      prescriptionJson: "{}",
    } as never);

    const result = await saveWorkoutIdempotent("user-1", prescription, {
      mode: "replace",
      reason: "user asked to change/replace",
      targetMeters: 3500,
    });

    expect(result.created).toBe(false);
    expect(result.updated).toBe(true);
    expect(result.reused).toBe(false);
    expect(result.workoutId).toBe("existing-id");
    expect(result.reason).toMatch(/payload changed|change|replace/i);
    expect(db.workout.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "existing-id" },
        data: expect.objectContaining({ title: "Swim 3500m", distanceM: 3500 }),
      })
    );
    expect(db.workout.create).not.toHaveBeenCalled();
  });

  it("when mode=replace and existing SWIM 1800m, new 3500m => updates record to 3500m and updated: true", async () => {
    vi.mocked(db.workout.findFirst).mockResolvedValue({
      id: "seed-id",
      title: "Technique & Endurance Swim",
      descriptionMd: "Warm-up 200m\nMain 1400m\nCool-down 200m",
      durationMin: 40,
      distanceM: 1800,
      prescriptionJson: JSON.stringify({ blocks: [] }),
    } as never);

    const result = await saveWorkoutIdempotent("user-1", prescription, {
      mode: "replace",
      reason: "user asked to change/replace",
      targetMeters: 3500,
    });

    expect(result.updated).toBe(true);
    expect(result.reused).toBe(false);
    expect(result.workoutId).toBe("seed-id");
    const updateCall = vi.mocked(db.workout.update).mock.calls[0];
    expect(updateCall[0].data.distanceM).toBe(3500);
    expect(updateCall[0].data.title).toBe("Swim 3500m");
  });

  it("when mode=upsert and no existing, creates and returns created: true", async () => {
    const result = await saveWorkoutIdempotent("user-1", prescription, {
      mode: "upsert",
      targetMeters: 3500,
    });

    expect(result.created).toBe(true);
    expect(result.updated).toBe(false);
    expect(result.reused).toBe(false);
    expect(result.workoutId).toBe("new-id");
    expect(db.workout.create).toHaveBeenCalled();
  });

  it("when mode=replace and payload unchanged (same hash), returns reused: true and does not update", async () => {
    const item = rubricToCalendarItem(prescription);
    vi.mocked(db.workout.findFirst).mockResolvedValue({
      id: "same-id",
      title: item.title,
      descriptionMd: item.descriptionMd,
      durationMin: item.durationMin,
      distanceM: 3500,
      prescriptionJson: JSON.stringify(item.prescriptionJson),
    } as never);
    vi.mocked(db.workout.update).mockClear();

    const result = await saveWorkoutIdempotent("user-1", prescription, {
      mode: "replace",
      reason: "user asked to change/replace",
      includeResultTemplate: true,
    });

    expect(result.created).toBe(false);
    expect(result.updated).toBe(false);
    expect(result.reused).toBe(true);
    expect(result.workoutId).toBe("same-id");
    expect(db.workout.update).not.toHaveBeenCalled();
  });
});
