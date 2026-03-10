import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Session } from "next-auth";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/db", () => ({
  db: {
    auditLog: {
      count: vi.fn(),
      create: vi.fn(),
    },
    workout: {
      findMany: vi.fn(),
      delete: vi.fn(),
    },
  },
}));
vi.mock("@/lib/billing/entitlements", () => ({
  getEntitlements: vi.fn(),
}));
vi.mock("@/lib/services/ai-context.builder", () => ({
  buildAIContextForUser: vi.fn(),
}));
vi.mock("@/lib/services/coach-llm-prompts", () => ({
  buildCoachUserPrompt: vi.fn(() => "BASE_PROMPT"),
  getCoachToneFromPreference: vi.fn(() => "SUPPORTIVE"),
  getEffectiveCoachSystemPrompt: vi.fn(() => "SYSTEM_PROMPT"),
}));
vi.mock("@/lib/services/ai-coach-behavior.service", () => ({
  applyConfidenceGuardrail: vi.fn((text: string) => text),
}));
vi.mock("@/lib/actions/coach", () => ({
  generateTrainingPlan: vi.fn(),
  buildWorkoutDescriptionMd: vi.fn(),
  buildWorkoutPrescriptionJson: vi.fn(),
}));
vi.mock("@/lib/services/plan-rigidity.service", () => ({
  isWorkoutLocked: vi.fn(() => false),
}));
vi.mock("@/lib/actions/plan-rigidity", () => ({
  createPlanChangeProposal: vi.fn(),
}));
vi.mock("@/lib/actions/coach-draft", () => ({
  getCoachCalendarSettings: vi.fn(),
  insertDraftWorkoutsFromCalendarJson: vi.fn(),
  insertWorkoutFromCoachResponse: vi.fn(),
}));
vi.mock("@/lib/services/coach-brain", () => ({
  generateAndSaveWorkout: vi.fn(),
}));
vi.mock("@/lib/services/ai-memory.service", () => ({
  getAIMemoryContextForPrompt: vi.fn(),
}));
vi.mock("@/lib/logger", () => ({
  logError: vi.fn(),
  logWarn: vi.fn(),
}));
vi.mock("@/lib/services/adaptive-day-planner-cache.service", () => ({
  invalidateAdaptiveDayPlannerCacheForWorkoutDate: vi.fn(),
}));

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getEntitlements } from "@/lib/billing/entitlements";
import { buildAIContextForUser } from "@/lib/services/ai-context.builder";
import { getCoachCalendarSettings, insertDraftWorkoutsFromCalendarJson } from "@/lib/actions/coach-draft";
import { generateAndSaveWorkout } from "@/lib/services/coach-brain";
import { getAIMemoryContextForPrompt } from "@/lib/services/ai-memory.service";
import { sendCoachMessage } from "./coach-chat";

const setAuthSession = (session: Session | null) => {
  (auth as unknown as { mockResolvedValue: (value: Session | null) => void }).mockResolvedValue(session);
};

const baseContext = {
  userProfile: {
    tonePreference: "SUPPORTIVE",
    planRigidity: "LOCKED_1_DAY",
    sportPrimary: "RUN",
    explainLevel: "standard",
  },
};

describe("sendCoachMessage quality retries", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.OPENAI_API_KEY = "sk-test-1234567890";
    setAuthSession({
      user: { id: "user-1", email: "runner@example.com" },
      expires: "",
    } as Session);
    vi.mocked(getEntitlements).mockResolvedValue({
      canUseAICoach: true,
      isPro: true,
    } as never);
    vi.mocked(db.auditLog.count).mockResolvedValue(0 as never);
    vi.mocked(db.auditLog.create).mockResolvedValue({} as never);
    vi.mocked(buildAIContextForUser).mockResolvedValue(baseContext as never);
    vi.mocked(getCoachCalendarSettings).mockResolvedValue({
      autoAddToCalendar: "off",
      detailLevel: "detailed",
    } as never);
    vi.mocked(insertDraftWorkoutsFromCalendarJson).mockResolvedValue({
      success: true,
      createdIds: ["workout-1"],
    } as never);
    vi.mocked(generateAndSaveWorkout).mockResolvedValue({
      success: false,
    } as never);
    vi.mocked(getAIMemoryContextForPrompt).mockResolvedValue("" as never);
  });

  it("retries LLM generation when workout structure is incomplete", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: "Easy run today. Pace 5:00/km." } }],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: `Warm-up: 15 min easy.
Main set: 4x5 min at threshold pace, 2 min jog.
Cool-down: 10 min easy.
Targets: pace 4:25/km, RPE 7.`,
              },
            },
          ],
        }),
      });
    vi.stubGlobal("fetch", fetchMock);

    const result = await sendCoachMessage({
      input: "Write me a run workout for today.",
    });

    expect(result.ok).toBe(true);
    expect(result.ok && result.text).toContain("Warm-up");
    expect(fetchMock).toHaveBeenCalledTimes(2);

    const secondCallBody = JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body));
    const lastMessage = secondCallBody.messages[secondCallBody.messages.length - 1]?.content as string;
    expect(lastMessage).toContain("Rewrite the workout as a complete, save-ready RUN session");
    expect(lastMessage).toContain("Missing elements: warm-up, main set, cool-down");
  });

  it("does not trigger workout-structure retry for question-only coach replies", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: "Threshold improves lactate clearance and sustainable pace." } }],
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await sendCoachMessage({
      input: "Why is threshold useful?",
    });

    expect(result.ok).toBe(true);
    expect(result.ok && result.text).toContain("Threshold improves");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("retries with strict JSON when the first calendar payload does not match intent", async () => {
    vi.mocked(buildAIContextForUser).mockResolvedValue({
      userProfile: {
        ...baseContext.userProfile,
        sportPrimary: "SWIM",
      },
    } as never);
    vi.mocked(getCoachCalendarSettings).mockResolvedValue({
      autoAddToCalendar: "final",
      detailLevel: "detailed",
    } as never);

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: `\`\`\`json
{"calendarInsert":true,"mode":"final","items":[{"date":"2026-03-10","sport":"RUN","title":"Wrong Sport","durationMin":60,"descriptionMd":"Warm-up: 400m easy.\nMain set: 8x100m threshold, rest 20s.\nCool-down: 200m easy.\nTOTAL METERS: 1400\nTargets: RPE 7."}]}
\`\`\``,
              },
            },
          ],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: `\`\`\`json
{"calendarInsert":true,"mode":"final","items":[{"date":"2026-03-10","sport":"SWIM","title":"Threshold Swim","durationMin":60,"descriptionMd":"Warm-up: 400m easy.\nMain set: 22x100m threshold, rest 20s.\nCool-down: 400m easy.\nTOTAL METERS: 3000\nTargets: threshold pace, RPE 7.","totalDistanceMeters":3000}]}
\`\`\``,
              },
            },
          ],
        }),
      });
    vi.stubGlobal("fetch", fetchMock);

    const result = await sendCoachMessage({
      input: "Write me a 3000m swim session for 2026-03-10.",
    });

    expect(result.ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(insertDraftWorkoutsFromCalendarJson).toHaveBeenCalledWith(
      expect.objectContaining({
        items: [
          expect.objectContaining({
            sport: "SWIM",
            title: "Threshold Swim",
            totalDistanceMeters: 3000,
          }),
        ],
      }),
      expect.objectContaining({
        forceMode: "final",
      })
    );

    const secondCallBody = JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body));
    const lastMessage = secondCallBody.messages[secondCallBody.messages.length - 1]?.content as string;
    expect(lastMessage).toContain("Output ONLY a JSON code block");
    expect(lastMessage).toContain("sport=SWIM");
    expect(lastMessage).toContain("totalMeters=3000");
  });

  it("does not save swim workout when payload is still wrong after strict JSON retry", async () => {
    vi.mocked(buildAIContextForUser).mockResolvedValue({
      userProfile: {
        ...baseContext.userProfile,
        sportPrimary: "SWIM",
      },
    } as never);
    vi.mocked(getCoachCalendarSettings).mockResolvedValue({
      autoAddToCalendar: "final",
      detailLevel: "detailed",
    } as never);

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: `\`\`\`json
{"calendarInsert":true,"mode":"final","items":[{"date":"2026-03-10","sport":"SWIM","title":"Too Short Swim","durationMin":55,"descriptionMd":"Warm-up: 400m easy.\nMain set: 10x100m threshold, rest 20s.\nCool-down: 200m easy.\nTOTAL METERS: 1600\nTargets: threshold pace, RPE 7.","totalDistanceMeters":1600}]}
\`\`\``,
              },
            },
          ],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: `\`\`\`json
{"calendarInsert":true,"mode":"final","items":[{"date":"2026-03-10","sport":"SWIM","title":"Still Wrong Swim","durationMin":60,"descriptionMd":"Warm-up: 400m easy.\nMain set: 12x100m threshold, rest 20s.\nCool-down: 200m easy.\nTOTAL METERS: 1800\nTargets: threshold pace, RPE 7.","totalDistanceMeters":1800}]}
\`\`\``,
              },
            },
          ],
        }),
      });
    vi.stubGlobal("fetch", fetchMock);

    const result = await sendCoachMessage({
      input: "Write me a 3000m swim session for 2026-03-10.",
    });

    expect(result.ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(insertDraftWorkoutsFromCalendarJson).not.toHaveBeenCalled();
    expect(result.ok && result.text).toContain("Nie mogę stworzyć treningu na 3000 m");
    expect(result.ok && result.text).toContain("25 m lub 50 m");
  });

  it("auto-fixes small swim meter mismatch without strict JSON retry", async () => {
    vi.mocked(buildAIContextForUser).mockResolvedValue({
      userProfile: {
        ...baseContext.userProfile,
        sportPrimary: "SWIM",
      },
    } as never);
    vi.mocked(getCoachCalendarSettings).mockResolvedValue({
      autoAddToCalendar: "final",
      detailLevel: "detailed",
    } as never);

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: `\`\`\`json
{"calendarInsert":true,"mode":"final","items":[{"date":"2026-03-10","sport":"SWIM","title":"Almost Right Swim","durationMin":60,"descriptionMd":"Warm-up: 400m easy.\nMain set: 20x100m threshold, rest 20s.\nCool-down: 400m easy.\nTOTAL METERS: 2800\nTargets: threshold pace, RPE 7.","totalDistanceMeters":2800}]}
\`\`\``,
            },
          },
        ],
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await sendCoachMessage({
      input: "Write me a 3000m swim session for 2026-03-10.",
    });

    expect(result.ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(insertDraftWorkoutsFromCalendarJson).toHaveBeenCalledWith(
      expect.objectContaining({
        items: [
          expect.objectContaining({
            sport: "SWIM",
            totalDistanceMeters: 3000,
            descriptionMd: expect.stringContaining("200m easy"),
          }),
        ],
      }),
      expect.objectContaining({
        forceMode: "final",
      })
    );
  });
});
