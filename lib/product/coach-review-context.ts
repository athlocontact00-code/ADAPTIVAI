export function clearCoachReviewContextUrl(currentUrl: string): string {
  const url = new URL(currentUrl);
  url.searchParams.delete("suggestionId");
  url.searchParams.delete("contextDate");
  url.searchParams.delete("resolvedSuggestionId");
  url.searchParams.delete("resolvedContextDate");
  return `${url.pathname}${url.search}${url.hash}`;
}

export function buildResolvedCoachReviewUrl(params: {
  suggestionId: string;
  contextDate: string;
}): string {
  const searchParams = new URLSearchParams({
    resolvedSuggestionId: params.suggestionId,
    resolvedContextDate: params.contextDate,
  });
  return `/coach?${searchParams.toString()}`;
}

export function buildResolvedDashboardCoachReviewUrl(params: {
  suggestionId: string;
  contextDate: string;
}): string {
  const searchParams = new URLSearchParams({
    resolvedSuggestionId: params.suggestionId,
    resolvedContextDate: params.contextDate,
  });
  return `/dashboard?${searchParams.toString()}`;
}
