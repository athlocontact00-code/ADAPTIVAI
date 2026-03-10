import type { AdaptiveDayPlannerPayload, AdaptiveDayPlannerState, AdaptivePlannerPatchItem } from "@/lib/services/adaptive-day-planner.service";

type BadgeVariant = "default" | "secondary" | "destructive" | "outline" | "success" | "warning" | "danger" | "info" | "muted";

export function getAdaptivePlannerDecisionMeta(
  decision: AdaptiveDayPlannerPayload["decision"] | undefined
): { label: string; variant: BadgeVariant } {
  switch (decision) {
    case "CHECK_IN_FIRST":
      return { label: "Check-in first", variant: "warning" };
    case "DO_THIS_WORKOUT":
      return { label: "Ready", variant: "success" };
    case "ADAPT_SESSION":
      return { label: "Adapt today", variant: "warning" };
    case "RECOVER_AND_REPLAN":
      return { label: "Recover & replan", variant: "danger" };
    case "PLAN_NEXT":
      return { label: "Plan next", variant: "info" };
    default:
      return { label: "Planner", variant: "muted" };
  }
}

export function getAdaptivePlannerStateMeta(
  state: AdaptiveDayPlannerState | undefined
): { label: string; variant: BadgeVariant } {
  switch (state) {
    case "NO_PLAN":
      return { label: "No plan", variant: "muted" };
    case "CHECK_IN_REQUIRED":
      return { label: "Check-in required", variant: "warning" };
    case "READY":
      return { label: "Ready", variant: "success" };
    case "ADAPT":
      return { label: "Adaptation", variant: "warning" };
    case "FEEDBACK_REQUIRED":
      return { label: "Feedback needed", variant: "info" };
    case "COMPLETE":
      return { label: "Complete", variant: "success" };
    default:
      return { label: "Planner", variant: "muted" };
  }
}

export function getAdaptivePlannerPatchMeta(
  change: AdaptivePlannerPatchItem["change"]
): { label: string; variant: BadgeVariant } {
  switch (change) {
    case "KEEP":
      return { label: "Keep", variant: "success" };
    case "ADAPT":
      return { label: "Adapt", variant: "warning" };
    case "RECOVER":
      return { label: "Recover", variant: "danger" };
    case "REVIEW":
      return { label: "Review", variant: "info" };
    default:
      return { label: change, variant: "muted" };
  }
}

export function getAdaptivePlannerPreviewTitle(): string {
  return "Next 72h plan";
}

export function formatAdaptivePlannerGeneratedAt(value: string | null | undefined): string | null {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });
}
