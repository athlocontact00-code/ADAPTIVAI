import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Session } from "next-auth";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/db", () => ({
  db: {
    workout: {
      create: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
    },
  },
}));

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  insertDraftWorkoutsFromCalendarJson,
  insertWorkoutFromCoachResponse,
} from "./coach-draft";
import { extractPayloadFromAssistantMessages } from "@/lib/coach/calendar-payload-from-messages";

/** Cast auth mock to accept Session | null (avoids NextMiddleware type from next-auth). */
const setAuthSession = (s: Session | null) => {
  (auth as unknown as { mockResolvedValue: (v: Session | null) => void }).mockResolvedValue(s);
};

const validPayload = {
  calendarInsert: true as const,
  mode: "final" as const,
  items: [
    {
      date: "2025-02-06",
      sport: "RUN" as const,
      title: "Easy Run",
      durationMin: 45,
      descriptionMd: "Easy 45 min run.",
      prescriptionJson: { steps: [] },
    },
  ],
};

describe("insertDraftWorkoutsFromCalendarJson", () => {
  beforeEach(() => {
    setAuthSession({
      user: { id: "user-1", email: "u@example.com" },
      expires: "",
    } as Session);
    vi.mocked(db.workout.create).mockResolvedValue({
      id: "workout-created-id",
    } as never);
  });

  it("returns success and created workout id when insert succeeds", async () => {
    const result = await insertDraftWorkoutsFromCalendarJson(validPayload, {
      forceMode: "final",
    });

    expect(result.success).toBe(true);
    expect(result.createdIds).toHaveLength(1);
    expect(result.createdIds[0]).toBe("workout-created-id");
    expect(result.error).toBeUndefined();
  });

  it("returns unauthorized when no session", async () => {
    setAuthSession(null);

    const result = await insertDraftWorkoutsFromCalendarJson(validPayload);

    expect(result.success).toBe(false);
    expect(result.createdIds).toEqual([]);
    expect(result.error).toBe("Unauthorized");
  });

  it("when replaceForDateSport is true, updates existing workout for same date+type instead of create", async () => {
    vi.mocked(db.workout.findFirst).mockResolvedValue({
      id: "existing-workout-id",
    } as never);
    vi.mocked(db.workout.update).mockResolvedValue({} as never);
    vi.mocked(db.workout.create).mockClear();

    const payloadWithDate = {
      ...validPayload,
      items: [{ ...validPayload.items[0], date: "2025-02-06", sport: "RUN" as const }],
    };
    const result = await insertDraftWorkoutsFromCalendarJson(payloadWithDate, {
      replaceForDateSport: true,
    });

    expect(result.success).toBe(true);
    expect(result.createdIds).toEqual(["existing-workout-id"]);
    expect(db.workout.findFirst).toHaveBeenCalled();
    expect(db.workout.update).toHaveBeenCalled();
    expect(db.workout.create).not.toHaveBeenCalled();
  });

  it("applies ensureExactTotalMeters for SWIM when computed total differs from target", async () => {
    vi.mocked(db.workout.findFirst).mockResolvedValue(null);
    vi.mocked(db.workout.create).mockClear();
    // 400+800+1600+400 = 3200; target 3000 -> auto-fix to 3000 (e.g. 8×100m -> 6×100m)
    const swimPayload = {
      calendarInsert: true as const,
      mode: "final" as const,
      items: [
        {
          date: "2025-02-06",
          sport: "SWIM" as const,
          title: "Swim 3000m",
          durationMin: 75,
          totalDistanceMeters: 3000,
          descriptionMd: `Warm-up: 400m
Main: 8×100m, 4×400m
Cool-down: 400m`,
          prescriptionJson: {},
        },
      ],
    };
    const result = await insertDraftWorkoutsFromCalendarJson(swimPayload);
    expect(result.success).toBe(true);
    expect(result.createdIds).toHaveLength(1);
    const createCall = vi.mocked(db.workout.create).mock.calls[0];
    const data = createCall[0].data as { descriptionMd: string; distanceM?: number; type: string };
    expect(data.type).toBe("SWIM");
    const { parseSwimMetersFromText } = await import("@/lib/utils/swim-meters");
    const sum = parseSwimMetersFromText(data.descriptionMd);
    expect(sum).toBe(3000);
    expect(data.distanceM).toBe(3000);
  });
});

describe("extractPayloadFromAssistantMessages", () => {
  const runMsg =
    "TITLE: Easy Run\nSPORT: RUN\nTOTAL TIME: 45 min\nWarm-up 10 min. Main 30 min. Cool-down 5 min.";
  const swimMsg =
    "TITLE: Swim 3000m\nSPORT: SWIM\nTOTAL TIME: 75 min\nMain set: 6x500m. Rest 30s.";

  it("selects SWIM when sportFilter is SWIM and messages contain both RUN and SWIM (newest first)", () => {
    const messages = [swimMsg, runMsg]; // newest first
    const payload = extractPayloadFromAssistantMessages(messages, "SWIM");
    expect(payload).not.toBeNull();
    expect(payload!.items[0].sport).toBe("SWIM");
    expect(payload!.items[0].title).toContain("Swim");
  });

  it("selects RUN when sportFilter is RUN and messages contain both RUN and SWIM", () => {
    const messages = [swimMsg, runMsg];
    const payload = extractPayloadFromAssistantMessages(messages, "RUN");
    expect(payload).not.toBeNull();
    expect(payload!.items[0].sport).toBe("RUN");
    expect(payload!.items[0].title).toContain("Easy Run");
  });

  it("returns first (newest) payload when no sportFilter", () => {
    const messages = [swimMsg, runMsg];
    const payload = extractPayloadFromAssistantMessages(messages);
    expect(payload).not.toBeNull();
    expect(payload!.items[0].sport).toBe("SWIM");
  });

  it("prefers payload matching dateFilter when two messages have different dates", () => {
    const msgToday = `\`\`\`json
{"calendarInsert":true,"mode":"final","items":[{"date":"2025-02-06","sport":"RUN","title":"Easy Run","durationMin":45,"descriptionMd":"Run.","prescriptionJson":{}}]}
\`\`\``;
    const msgTomorrow = `\`\`\`json
{"calendarInsert":true,"mode":"final","items":[{"date":"2025-02-07","sport":"RUN","title":"Easy Run","durationMin":45,"descriptionMd":"Run.","prescriptionJson":{}}]}
\`\`\``;
    const messages = [msgTomorrow, msgToday];
    const payload = extractPayloadFromAssistantMessages(messages, "RUN", "2025-02-07");
    expect(payload).not.toBeNull();
    expect(payload!.items[0].date).toBe("2025-02-07");
  });
});

describe("insertWorkoutFromCoachResponse (no fallback)", () => {
  beforeEach(() => {
    setAuthSession({
      user: { id: "user-1", email: "u@example.com" },
      expires: "",
    } as Session);
    vi.mocked(db.workout.create).mockResolvedValue({
      id: "workout-created-id",
    } as never);
  });

  it("returns friendly error when assistantMessages have no parseable workout (no Steady Run fallback)", async () => {
    const result = await insertWorkoutFromCoachResponse("No workout here, just chat.", {
      assistantMessages: ["No workout here.", "Still no workout."],
      sportFilter: undefined,
    });
    expect(result.success).toBe(false);
    expect(result.createdIds).toEqual([]);
    expect(result.error).toMatch(/couldn't detect a workout|write me a swim session/);
    expect(result.error).not.toMatch(/Steady Run|fallback/);
  });
});
