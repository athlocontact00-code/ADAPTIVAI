import type { CheckInRecommendation } from "@/lib/actions/daily-checkin";

export type CheckinResultResolution = "AUTO_APPLIED" | "UNDONE" | null;

export function getCheckinResultBannerCopy(resolution: CheckinResultResolution): {
  title: string;
  description: string;
  tone: "success" | "muted";
} | null {
  if (resolution === "AUTO_APPLIED") {
    return {
      title: "Changes applied",
      description: "You can undo if this doesn't feel right.",
      tone: "success",
    };
  }
  if (resolution === "UNDONE") {
    return {
      title: "Changes undone",
      description: "The original workout is back. You can apply the recommendation again if needed.",
      tone: "muted",
    };
  }
  return null;
}

export function shouldShowCheckinOverrideReason(params: {
  recommendation: CheckInRecommendation | null;
  autoApplied: boolean;
}): boolean {
  return Boolean(params.recommendation?.changes?.apply && !params.autoApplied);
}

export function getCheckinResultFooterMode(params: {
  recommendation: CheckInRecommendation | null;
  autoApplied: boolean;
  proposalId: string | null;
  analysisStatus: "idle" | "loading" | "error" | "done";
}): "DECIDE" | "VIEW_WORKOUT" | "NONE" {
  if (params.analysisStatus === "error") return "NONE";
  if (params.recommendation?.changes?.apply && !params.autoApplied && !params.proposalId) {
    return "DECIDE";
  }
  return "VIEW_WORKOUT";
}
