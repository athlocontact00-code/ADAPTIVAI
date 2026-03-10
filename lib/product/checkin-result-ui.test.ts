import { describe, expect, it } from "vitest";

import {
  getCheckinResultBannerCopy,
  getCheckinResultFooterMode,
  shouldShowCheckinOverrideReason,
} from "./checkin-result-ui";

describe("checkin result ui helpers", () => {
  it("returns banner copy for auto-applied and undone states", () => {
    expect(getCheckinResultBannerCopy("AUTO_APPLIED")).toMatchObject({
      title: "Changes applied",
      tone: "success",
    });
    expect(getCheckinResultBannerCopy("UNDONE")).toMatchObject({
      title: "Changes undone",
      tone: "muted",
    });
  });

  it("shows override reason only while decision is pending", () => {
    expect(
      shouldShowCheckinOverrideReason({
        recommendation: { changes: { apply: true } } as any,
        autoApplied: false,
      })
    ).toBe(true);
    expect(
      shouldShowCheckinOverrideReason({
        recommendation: { changes: { apply: true } } as any,
        autoApplied: true,
      })
    ).toBe(false);
  });

  it("derives footer mode from analysis and recommendation state", () => {
    expect(
      getCheckinResultFooterMode({
        recommendation: { changes: { apply: true } } as any,
        autoApplied: false,
        proposalId: null,
        analysisStatus: "done",
      })
    ).toBe("DECIDE");
    expect(
      getCheckinResultFooterMode({
        recommendation: { changes: { apply: true } } as any,
        autoApplied: true,
        proposalId: null,
        analysisStatus: "done",
      })
    ).toBe("VIEW_WORKOUT");
    expect(
      getCheckinResultFooterMode({
        recommendation: null,
        autoApplied: false,
        proposalId: null,
        analysisStatus: "error",
      })
    ).toBe("NONE");
  });
});
