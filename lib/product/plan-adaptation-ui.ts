export function getPlanAdaptationOutcomeCopy(params: {
  proposalCreated?: boolean;
}): {
  title: string;
  description: string;
  toast: string;
} {
  if (params.proposalCreated) {
    return {
      title: "Proposal created",
      description: "Review the proposal in Calendar before applying the adaptation.",
      toast: "Proposal created",
    };
  }

  return {
    title: "Adaptation applied",
    description: "Your workout has been updated.",
    toast: "Adaptation applied",
  };
}

export function getPlanAdaptationActionCopy(params: {
  locked?: boolean;
  requiresConfirmation?: boolean;
  hasUpdatedWorkout?: boolean;
}): {
  applyLabel: string;
  applyingLabel: string;
  declineLabel: string;
  decliningLabel: string;
  keepLabel: string;
  viewWorkoutLabel: string;
} {
  return {
    applyLabel: params.locked
      ? "Create proposal"
      : params.requiresConfirmation
        ? "Review adaptation"
        : "Apply adaptation",
    applyingLabel: params.locked ? "Creating proposal..." : "Applying adaptation...",
    declineLabel: "Decline proposal",
    decliningLabel: "Declining proposal...",
    keepLabel: "Keep current workout",
    viewWorkoutLabel: params.hasUpdatedWorkout ? "View adapted workout" : "View workout",
  };
}

export function getPlanAdaptationDecisionToast(decision: "ACCEPT" | "DECLINE"): string {
  return decision === "ACCEPT" ? "Adaptation applied" : "Proposal declined";
}

export function getPlanAdaptationReviewHref(params: {
  proposalId?: string | null;
  workoutId?: string | null;
}): string {
  if (params.proposalId) {
    return `/calendar?proposalId=${encodeURIComponent(params.proposalId)}`;
  }
  if (params.workoutId) {
    return `/calendar?workoutId=${encodeURIComponent(params.workoutId)}`;
  }
  return "/calendar";
}

export function getPlanAdaptationReviewContextCopy(summary?: string | null): {
  title: string;
  description: string;
} {
  return {
    title: "Reviewing proposal",
    description:
      summary?.trim() ||
      "This adaptation needs your review before it can update the workout in Calendar.",
  };
}
