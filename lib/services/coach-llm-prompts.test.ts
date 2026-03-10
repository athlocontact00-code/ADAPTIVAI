import { describe, expect, it } from "vitest";

import {
  buildCoachUserPrompt,
  getCoachToneFromPreference,
} from "./coach-llm-prompts";
import type { AIContext } from "@/lib/services/ai-context.builder";

function createContext(): AIContext {
  return {
    contextVersion: "2026-02-02.v1",
    generatedAt: "2026-03-09T08:00:00.000Z",
    userProfile: {
      userId: "user-1",
      name: "Alex",
      tonePreference: "SUPPORTIVE",
      explainLevel: "DETAILED",
      identityMode: "competitive",
      ageYears: 31,
      weightKg: 72,
      heightCm: 180,
      sportPrimary: "SWIM",
      experienceLevel: "intermediate",
      swimLevel: "age_group",
      coachIncludeResultTemplate: true,
      planRigidity: "LOCKED_1_DAY",
      equipmentNotes: "trainer ".repeat(80).trim(),
      terrainNotes: "flat route",
      availabilityNotes: "mornings only",
      swimPoolLengthM: 25,
      club: null,
      location: null,
      timezone: "Europe/Warsaw",
      birthYear: 1994,
      availability: { preferredTime: "morning", maxMinutesPerDay: 75 },
      preferences: {
        preferredSessionTypes: ["tempo", "endurance"],
        avoidedSessionTypes: ["brick"],
      },
      guardrails: {
        injuryAreas: "left shoulder",
      },
      activeInjuries: [
        {
          area: "left shoulder",
          severity: "moderate",
          status: "active",
          startedAt: "2026-03-01",
          endedAt: null,
          notesPresent: true,
        },
      ],
    },
    zones: {
      hr: {
        restingHR: 48,
        maxHR: 188,
        z1: { min: 100, max: 120 },
        z2: { min: 121, max: 140 },
        z3: { min: 141, max: 158 },
        z4: { min: 159, max: 174 },
        z5: { min: 175, max: 188 },
      },
      power: { ftp: 250 },
    },
    pbs: [],
    goals: {
      weeklyHoursGoal: 10,
      seasonGoal: "Sub-5 triathlon",
      upcomingRaces: [],
    },
    planSummary: {
      today: "Technique swim",
      activeSeason: null,
      activeBlock: null,
      keySessionsNext7d: [],
    },
    todayCheckin: {
      status: "completed",
      privacyMode: "FULL_AI_ACCESS",
      planLocked: false,
      data: {
        readinessScore: 71,
        topFactor: "Sleep",
        recommendation: "Proceed as planned",
        sleepQuality: 78,
        fatigue: 32,
        motivation: 81,
        soreness: 20,
        stress: 25,
        hasConflict: false,
        conflictReason: null,
      },
    },
    recentSignals: {
      checkIns7d: {
        window: { start: "2026-03-02", endExclusive: "2026-03-10" },
        items: [
          {
            date: "2026-03-08",
            readinessScore: 68,
            sleepDuration: 7.5,
            sleepQuality: 78,
            physicalFatigue: 35,
            mentalReadiness: 74,
            motivation: 80,
            stressLevel: 25,
            aiDecision: "PROCEED",
            aiConfidence: 0.8,
            notesPresent: true,
          },
        ],
      },
      feedbackPatterns14d: {
        window: { start: "2026-02-24", endExclusive: "2026-03-10" },
        totalFeedback: 4,
        avgEnjoyment: 4.2,
        avgMentalState: 4,
        perceivedDifficultyCounts: { MODERATE: 3, HARD: 1 },
        vsPlannedCounts: { AS_PLANNED: 3 },
        painOrDiscomfortCount: 0,
        commentCount: 2,
      },
      diarySignals7d: {
        window: { start: "2026-03-02", endExclusive: "2026-03-10" },
        includedCount: 2,
        excludedHiddenCount: 1,
        items: [
          {
            date: "2026-03-08",
            visibility: "FULL_AI_ACCESS",
            mood: 4,
            energy: 4,
            sleepHrs: 7.5,
            sleepQual: 4,
            stress: 2,
            soreness: 2,
            motivation: 5,
            notesPresent: true,
          },
          {
            date: "2026-03-09",
            visibility: "METRICS_ONLY",
            mood: 3,
            energy: 3,
            sleepHrs: 7,
            sleepQual: 3,
            stress: 3,
            soreness: 3,
            motivation: 3,
            notesPresent: false,
          },
        ],
      },
      metrics14d: {
        window: { start: "2026-02-24", endExclusive: "2026-03-10" },
        latest: {
          date: "2026-03-09",
          readinessScore: 71,
          complianceScore: 85,
          burnoutRisk: 12,
          ctl: 55,
          atl: 61,
          tsb: -6,
        },
      },
    },
    recentTraining: {
      completedWorkouts14d: {
        window: { start: "2026-02-24", endExclusive: "2026-03-10" },
        count: 6,
        totalDurationMin: 420,
        totalTss: 390,
        byTypeCounts: { swim: 3, run: 2, strength: 1 },
        items: [],
      },
    },
    privacySummary: {
      diary: {
        policy: "NO_RAW_DIARY_TEXT",
        fullAiAccess: "METRICS_AND_NOTES_PRESENT_ONLY",
        metricsOnly: "METRICS_ONLY",
        hidden: "EXCLUDED",
      },
      checkIns: {
        policy: "NO_RAW_CHECKIN_NOTES",
      },
      feedback: {
        policy: "NO_RAW_FEEDBACK_COMMENT",
      },
      verification: {
        verifier: "assertAIContextNoRawDiaryNotes",
      },
    },
  };
}

describe("getCoachToneFromPreference", () => {
  it("falls back to SUPPORTIVE for unknown tone", () => {
    expect(getCoachToneFromPreference("UNKNOWN")).toBe("SUPPORTIVE");
    expect(getCoachToneFromPreference(null)).toBe("SUPPORTIVE");
  });
});

describe("buildCoachUserPrompt", () => {
  it("injects required sport/date/distance constraints and compacts context", () => {
    const prompt = buildCoachUserPrompt({
      input: "Write me a swim session for 3500m tomorrow. My 400m PR is 6:00.",
      context: createContext(),
      intentOverride: {
        sport: "SWIM",
        targetDateISO: "2026-03-10",
        swimMeters: 3500,
        durationMin: null,
        mode: "generate",
        confidence: 0.95,
        raw: {
          action: "CREATE_WORKOUT",
          sport: "SWIM",
          constraints: {
            date: "2026-03-10",
            distanceM: 3500,
          },
        },
      },
    });

    expect(prompt).toContain("REQUIRED sport: SWIM");
    expect(prompt).toContain("REQUIRED date for calendar: 2026-03-10");
    expect(prompt).toContain("REQUIRED total swim meters: 3500");
    expect(prompt).toContain("Swim pace targets from athlete PR (400m)");
    expect(prompt).toContain("\"activeInjuries\":[{\"area\":\"left shoulder\",\"severity\":\"moderate\",\"status\":\"active\"}]");
    expect(prompt).toContain("\"notesPresent\":true");
    expect(prompt).not.toContain("trainer trainer trainer trainer trainer trainer trainer trainer trainer trainer trainer trainer trainer trainer trainer trainer trainer trainer trainer trainer trainer trainer trainer trainer trainer trainer trainer trainer trainer trainer trainer trainer trainer trainer trainer trainer trainer trainer trainer trainer");
    expect(prompt).toContain("…");
  });

  it("throws when raw diary notes leak into context passed to prompt builder", () => {
    const unsafeContext = {
      ...createContext(),
      recentSignals: {
        ...createContext().recentSignals,
        diarySignals7d: {
          ...createContext().recentSignals.diarySignals7d,
          items: [
            {
              ...createContext().recentSignals.diarySignals7d.items[0],
              notes: "This private diary note must never reach the coach prompt.",
            },
          ],
        },
      },
    } as unknown as AIContext;

    expect(() =>
      buildCoachUserPrompt({
        input: "What should I do today?",
        context: unsafeContext,
      })
    ).toThrow("AI context leak detected");
  });
});
