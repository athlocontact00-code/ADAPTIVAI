export type CalendarProposalReviewContext = {
  proposalId: string;
  summary: string | null;
};

export function shouldShowCalendarProposalReviewContext(params: {
  context: CalendarProposalReviewContext | null;
  proposalLoading: boolean;
  pendingProposalIds: readonly string[];
}): boolean {
  if (!params.context) return false;
  return params.proposalLoading || params.pendingProposalIds.includes(params.context.proposalId);
}

export function clearCalendarProposalReviewContext(
  current: CalendarProposalReviewContext | null,
  decidedProposalId: string
): CalendarProposalReviewContext | null {
  return current?.proposalId === decidedProposalId ? null : current;
}

export function buildCalendarDetailUrl(params: {
  currentUrl: string;
  workoutId?: string | null;
}): string {
  const url = new URL(params.currentUrl);
  url.searchParams.delete("proposalId");
  url.searchParams.delete("suggestionId");
  url.searchParams.delete("contextDate");
  if (params.workoutId && params.workoutId.length > 0) {
    url.searchParams.set("workoutId", params.workoutId);
  } else {
    url.searchParams.delete("workoutId");
  }
  return `${url.pathname}${url.search}${url.hash}`;
}
