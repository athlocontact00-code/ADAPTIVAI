export function getCoachReviewNextStepCopy(params: {
  isToday: boolean;
  title?: string | null;
}): {
  title: string;
  description: string;
  primaryLabel: string;
  secondaryLabel: string | null;
} {
  return {
    title: params.title?.trim() || "Coach review completed",
    description: params.isToday
      ? "The change is resolved. Check today's guidance or continue refining it in Coach."
      : "The change is resolved. Return to Coach if you want to keep iterating on the plan.",
    primaryLabel: params.isToday ? "Open Today Decision" : "Back to Coach",
    secondaryLabel: params.isToday ? "View on Dashboard" : null,
  };
}
