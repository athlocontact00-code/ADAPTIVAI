import { describe, expect, it } from "vitest";

import {
  finalizeCoachResponseText,
  inferCoachConfidenceFromText,
  textAlreadyAdmitsUncertainty,
} from "./coach-response-finalizer";

describe("inferCoachConfidenceFromText", () => {
  it("returns low confidence when text already admits uncertainty", () => {
    expect(inferCoachConfidenceFromText("I'm not entirely sure about this session.")).toBe(60);
    expect(inferCoachConfidenceFromText("Low confidence due to missing data.")).toBe(60);
  });

  it("returns default coach confidence for normal answers", () => {
    expect(inferCoachConfidenceFromText("Warm-up 15 min easy. Main set 4x5 min.")).toBe(80);
  });
});

describe("textAlreadyAdmitsUncertainty", () => {
  it("detects uncertainty phrasing", () => {
    expect(textAlreadyAdmitsUncertainty("My confidence is around 60%.")).toBe(true);
    expect(textAlreadyAdmitsUncertainty("I'm not entirely sure.")).toBe(true);
  });

  it("ignores normal coach answers", () => {
    expect(textAlreadyAdmitsUncertainty("Warm-up 15 min easy.")).toBe(false);
  });
});

describe("finalizeCoachResponseText", () => {
  it("sanitizes junk and appends uncertainty once", () => {
    const result = finalizeCoachResponseText({
      text: `Easy run today.
This is because the recent signals and plan summary in your context.`,
      confidence: 60,
    });
    expect(result).toContain("Easy run today.");
    expect(result).not.toContain("recent signals and plan summary");
    expect(result).toContain("my confidence is around 60%");
  });

  it("does not duplicate uncertainty copy", () => {
    const result = finalizeCoachResponseText({
      text: "I'm not entirely sure - my confidence is around 60%.",
      confidence: 60,
    });
    expect(result.match(/my confidence is around 60%/g)).toHaveLength(1);
  });

  it("applies confidence guardrail for overconfident low-confidence text", () => {
    const result = finalizeCoachResponseText({
      text: "This will definitely work for sure.",
      confidence: 60,
      sanitize: false,
    });
    expect(result).not.toContain("definitely");
    expect(result).not.toContain("for sure");
    expect(result).toContain("likely");
  });
});
