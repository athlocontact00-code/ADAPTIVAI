import { describe, expect, it, vi } from "vitest";

import { handleManualCoachWorkout } from "./coach-manual-add-handler";

const draft = {
  date: new Date(2026, 2, 10, 12, 0, 0, 0),
  type: "run",
  durationMin: 60,
  intensity: "easy",
  title: "Easy Run",
  tss: 48,
};

describe("handleManualCoachWorkout", () => {
  it("rejects past workout dates", async () => {
    const result = await handleManualCoachWorkout({
      draft: { ...draft, date: new Date(2026, 2, 8, 12, 0, 0, 0) },
      now: new Date(2026, 2, 9, 12, 0, 0, 0),
      planRigidity: "LOCKED_1_DAY",
      isProtected: vi.fn(),
      createWorkout: vi.fn(),
      createProposal: vi.fn(),
      deleteWorkout: vi.fn(),
    });

    expect(result.confidence).toBe(90);
    expect(result.text).toContain("Nie dodaję treningów wstecz");
  });

  it("creates a proposal when the date is protected", async () => {
    const result = await handleManualCoachWorkout({
      draft,
      now: new Date(2026, 2, 9, 12, 0, 0, 0),
      planRigidity: "LOCKED_1_DAY",
      isProtected: vi.fn(() => true),
      createWorkout: vi.fn(async () => ({
        id: "workout-1",
        date: draft.date,
        title: draft.title,
        descriptionMd: "Protected workout proposal",
      })),
      createProposal: vi.fn(async () => ({ success: true, proposalId: "proposal-1" })),
      deleteWorkout: vi.fn(),
    });

    expect(result.confidence).toBe(90);
    expect(result.text).toContain("przygotowałem propozycję zmiany");
    expect(result.text).toContain("Protected workout proposal");
  });

  it("deletes created workout when proposal creation fails", async () => {
    const deleteWorkout = vi.fn();

    const result = await handleManualCoachWorkout({
      draft,
      now: new Date(2026, 2, 9, 12, 0, 0, 0),
      planRigidity: "LOCKED_1_DAY",
      isProtected: vi.fn(() => true),
      createWorkout: vi.fn(async () => ({
        id: "workout-1",
        date: draft.date,
        title: draft.title,
        descriptionMd: "Protected workout proposal",
      })),
      createProposal: vi.fn(async () => ({ success: false })),
      deleteWorkout,
    });

    expect(deleteWorkout).toHaveBeenCalledWith("workout-1");
    expect(result.confidence).toBe(80);
    expect(result.text).toContain("Nie mogę teraz utworzyć propozycji zmiany planu");
  });

  it("creates workout directly when the date is not protected", async () => {
    const result = await handleManualCoachWorkout({
      draft,
      now: new Date(2026, 2, 9, 12, 0, 0, 0),
      planRigidity: "LOCKED_1_DAY",
      isProtected: vi.fn(() => false),
      createWorkout: vi.fn(async () => ({
        id: "workout-1",
        date: draft.date,
        title: draft.title,
        descriptionMd: "Directly added workout",
      })),
      createProposal: vi.fn(),
      deleteWorkout: vi.fn(),
    });

    expect(result.confidence).toBe(90);
    expect(result.text).toContain("✅ Added to Calendar");
    expect(result.text).toContain("Directly added workout");
  });
});
