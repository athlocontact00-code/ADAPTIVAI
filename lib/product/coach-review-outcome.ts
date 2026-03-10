export function getCoachReviewApplyToast(params?: { proposalCreated?: boolean }): string {
  if (params?.proposalCreated) return "Proposal created";
  return "Coach change applied";
}

export function getCoachReviewDismissToast(): string {
  return "Coach review dismissed";
}

export function getCoachReviewManualResolutionToast(): string {
  return "Coach review updated";
}
