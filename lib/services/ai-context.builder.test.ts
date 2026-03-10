import { describe, expect, it } from "vitest";

import { assertAIContextNoRawDiaryNotes, type AIContext } from "./ai-context.builder";

describe("assertAIContextNoRawDiaryNotes", () => {
  it("does not throw when context only exposes notesPresent flags", () => {
    const context = {
      recentSignals: {
        diarySignals7d: {
          items: [
            {
              date: "2026-03-09",
              visibility: "FULL_AI_ACCESS",
              mood: 4,
              notesPresent: true,
            },
            {
              date: "2026-03-10",
              visibility: "METRICS_ONLY",
              mood: 3,
              notesPresent: false,
            },
          ],
        },
      },
      privacySummary: {
        diary: { policy: "NO_RAW_DIARY_TEXT" },
      },
    } as unknown as AIContext;

    expect(() => assertAIContextNoRawDiaryNotes(context)).not.toThrow();
  });

  it("throws when nested raw diary notes leak into AI context", () => {
    const context = {
      recentSignals: {
        diarySignals7d: {
          items: [
            {
              date: "2026-03-09",
              visibility: "FULL_AI_ACCESS",
              notesPresent: true,
              notes: "Raw private diary text should never be here.",
            },
          ],
        },
      },
    } as unknown as AIContext;

    expect(() => assertAIContextNoRawDiaryNotes(context)).toThrow(
      "AI context leak detected: recentSignals.diarySignals7d.items.0.notes"
    );
  });
});
