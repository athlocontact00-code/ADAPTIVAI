import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Session } from "next-auth";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/db", () => ({
  db: { workout: { create: vi.fn() } },
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
    expect(result.error).toMatch(/Nie widzę|rozpisz trening/);
    expect(result.error).not.toMatch(/Steady Run|fallback/);
  });
});
