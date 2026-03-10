import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("@/lib/services/adaptive-day-planner-cache.service", () => ({
  getAdaptiveDayPlannerCacheSnapshot: vi.fn(),
}));
vi.mock("@/lib/db", () => ({
  db: {
    workout: { findMany: vi.fn() },
    postWorkoutFeedback: { findMany: vi.fn() },
    dailyCheckIn: { findMany: vi.fn() },
    coachSuggestion: { findMany: vi.fn(), findFirst: vi.fn() },
    planChangeProposal: { findFirst: vi.fn() },
  },
}));
vi.mock("./calendar-client", () => ({
  CalendarClient: vi.fn(() => null),
}));

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getAdaptiveDayPlannerCacheSnapshot } from "@/lib/services/adaptive-day-planner-cache.service";
import CalendarPage from "./page";

describe("CalendarPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-09T10:00:00.000Z"));
    vi.mocked(auth).mockResolvedValue({
      user: { id: "user-1", email: "u@example.com" },
      expires: "",
    } as never);
    vi.mocked(db.workout.findMany).mockResolvedValue([
      {
        id: "workout-1",
        userId: "user-1",
        title: "Easy Run",
        type: "run",
        date: new Date("2026-03-09T12:00:00.000Z"),
        planned: true,
        completed: false,
        createdAt: new Date("2026-03-08T12:00:00.000Z"),
      },
    ] as never);
    vi.mocked(db.postWorkoutFeedback.findMany).mockResolvedValue([]);
    vi.mocked(db.dailyCheckIn.findMany).mockResolvedValue([]);
    vi.mocked(db.coachSuggestion.findMany).mockResolvedValue([]);
    vi.mocked(db.coachSuggestion.findFirst).mockResolvedValue(null);
    vi.mocked(getAdaptiveDayPlannerCacheSnapshot).mockResolvedValue({
      payload: null,
      stale: false,
      staleReason: null,
      changedAt: null,
    });
    vi.mocked(db.planChangeProposal.findFirst).mockResolvedValue({
      id: "proposal-1",
      workoutId: "workout-1",
      summary: "Move today's workout to tomorrow",
    } as never);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("resolves proposalId into initial proposal review and workout detail context", async () => {
    const element = await CalendarPage({
      searchParams: Promise.resolve({ proposalId: "proposal-1" }),
    });

    expect(db.planChangeProposal.findFirst).toHaveBeenCalledWith({
      where: {
        id: "proposal-1",
        userId: "user-1",
        status: "PENDING",
      },
      select: { id: true, workoutId: true, summary: true },
    });
    expect(element.props).toEqual(
      expect.objectContaining({
        userId: "user-1",
        initialOpenWorkoutId: "workout-1",
        initialProposalReview: {
          proposalId: "proposal-1",
          summary: "Move today's workout to tomorrow",
        },
      })
    );
  });

  it("prefers explicit workoutId over proposal-derived workout detail", async () => {
    const element = await CalendarPage({
      searchParams: Promise.resolve({ proposalId: "proposal-1", workoutId: "workout-99" }),
    });

    expect(element.props).toEqual(
      expect.objectContaining({
        initialOpenWorkoutId: "workout-99",
        initialProposalReview: {
          proposalId: "proposal-1",
          summary: "Move today's workout to tomorrow",
        },
      })
    );
  });

  it("uses date search param to seed selected day and month", async () => {
    const element = await CalendarPage({
      searchParams: Promise.resolve({ date: "2026-04-15" }),
    });

    const initialMonthDate = new Date(element.props.initialMonthDate);
    const initialSelectedDate = new Date(element.props.initialSelectedDate);

    expect(initialMonthDate.getFullYear()).toBe(2026);
    expect(initialMonthDate.getMonth()).toBe(3);
    expect(initialMonthDate.getDate()).toBe(1);
    expect(initialSelectedDate.getFullYear()).toBe(2026);
    expect(initialSelectedDate.getMonth()).toBe(3);
    expect(initialSelectedDate.getDate()).toBe(15);
  });

  it("resolves coach suggestion review context from search params", async () => {
    vi.mocked(db.coachSuggestion.findFirst).mockResolvedValue({
      id: "suggestion-1",
      title: "Ease today's run",
      summary: "Reduce intensity to stay on track.",
      contextDate: new Date("2026-03-09T12:00:00.000Z"),
    } as never);

    const element = await CalendarPage({
      searchParams: Promise.resolve({ suggestionId: "suggestion-1", contextDate: "2026-03-09", date: "2026-03-09" }),
    });

    expect(db.coachSuggestion.findFirst).toHaveBeenCalledWith({
      where: {
        id: "suggestion-1",
        userId: "user-1",
        status: "PENDING",
      },
      select: { id: true, title: true, summary: true, contextDate: true },
    });
    expect(element.props).toEqual(
      expect.objectContaining({
        initialCoachSuggestionReview: {
          suggestionId: "suggestion-1",
          contextDate: "2026-03-09",
          title: "Ease today's run",
          summary: "Reduce intensity to stay on track.",
          reviewHref: "/coach?suggestionId=suggestion-1&contextDate=2026-03-09",
        },
      })
    );
  });
});
