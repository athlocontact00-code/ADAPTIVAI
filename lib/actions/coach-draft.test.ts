import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Session } from "next-auth";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/db", () => ({
  db: { workout: { create: vi.fn() } },
}));

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { insertDraftWorkoutsFromCalendarJson } from "./coach-draft";

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
