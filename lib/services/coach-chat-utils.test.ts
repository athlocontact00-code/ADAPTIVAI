import { describe, expect, it } from "vitest";

import {
  endExclusiveOfLocalDay,
  extractPayloadFromCoachText,
  isOpenAIQuotaError,
  isTransientLLMError,
  parseCoachPlanRigidity,
  startOfLocalDay,
  stripMedicalDiagnosisLanguage,
} from "./coach-chat-utils";

describe("coach chat utils", () => {
  it("normalizes local day boundaries", () => {
    const date = new Date(2026, 2, 10, 15, 30, 0, 0);
    const start = startOfLocalDay(date);
    const end = endExclusiveOfLocalDay(date);
    expect(start.getHours()).toBe(0);
    expect(end.getDate()).toBe(start.getDate() + 1);
  });

  it("parses supported plan rigidity values and falls back safely", () => {
    expect(parseCoachPlanRigidity("LOCKED_2_DAYS")).toBe("LOCKED_2_DAYS");
    expect(parseCoachPlanRigidity("UNKNOWN")).toBe("LOCKED_1_DAY");
    expect(parseCoachPlanRigidity(null)).toBe("LOCKED_1_DAY");
  });

  it("strips medical diagnosis language", () => {
    expect(stripMedicalDiagnosisLanguage("You likely have tendon pain.")).not.toContain("likely have");
  });

  it("detects quota and transient LLM errors", () => {
    expect(isOpenAIQuotaError(new Error("OpenAI error: 429 insufficient_quota"))).toBe(true);
    expect(isTransientLLMError(new Error("OpenAI error: 503 upstream"))).toBe(true);
    expect(isTransientLLMError(new Error("Something else"))).toBe(false);
  });

  it("extracts calendar payload from JSON response", () => {
    const payload = extractPayloadFromCoachText(`\`\`\`json
{"calendarInsert":true,"mode":"final","items":[{"date":"2026-03-10","sport":"RUN","title":"Easy Run","durationMin":45,"descriptionMd":"Warm-up 10 min"}]}
\`\`\``);
    expect(payload?.items[0].title).toBe("Easy Run");
  });

  it("falls back to text parser when JSON is missing", () => {
    const payload = extractPayloadFromCoachText(`---
Title: Easy Run
Sport: RUN
Total: 45 min
Warm-up:
- 10 min easy
Main set:
- 25 min steady
Cool-down:
- 10 min easy
---`);
    expect(payload?.items[0].sport).toBe("RUN");
    expect(payload?.items[0].durationMin).toBe(45);
  });
});
