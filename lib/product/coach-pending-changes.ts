export type CoachPendingChangeSummary = {
  count: number;
  primaryTitle: string;
  primarySummary: string;
  scopes: string[];
  primarySuggestionId: string;
  contextDate: string;
  reviewHref: string;
  calendarHref: string | null;
};

type CoachPendingChangeInput = {
  id: string;
  title: string;
  summary: string;
  scope: string;
  contextDate: string;
  payload?: unknown;
};

export function summarizeCoachPendingChanges(
  items: ReadonlyArray<CoachPendingChangeInput>
): CoachPendingChangeSummary | null {
  if (items.length === 0) return null;

  const scopes = Array.from(
    new Set(
      items
        .map((item) => normalizeCoachPendingScope(item.scope))
        .filter((value): value is string => value !== null)
    )
  );

  return {
    count: items.length,
    primaryTitle: items[0]?.title?.trim() || "Coach recommendation",
    primarySummary:
      items[0]?.summary?.trim() || "Coach has a suggested adjustment ready for your review.",
    scopes,
    primarySuggestionId: items[0]?.id ?? "",
    contextDate: items[0]?.contextDate ?? "",
    reviewHref: buildCoachPendingChangesReviewHref({
      suggestionId: items[0]?.id ?? "",
      contextDate: items[0]?.contextDate ?? "",
    }),
    calendarHref: getCoachSuggestionCalendarHref(items[0]?.payload, items[0]?.contextDate, {
      suggestionId: items[0]?.id ?? "",
      contextDate: items[0]?.contextDate ?? "",
    }),
  };
}

export function normalizeCoachPendingScope(scope: string | null | undefined): string | null {
  const normalized = String(scope ?? "").trim().toLowerCase();
  if (!normalized) return null;
  if (normalized === "today") return "Today";
  if (normalized === "week") return "This week";
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

export function getCoachPendingChangesTitle(count: number): string {
  return count === 1 ? "Coach has 1 pending change" : `Coach has ${count} pending changes`;
}

export function buildCoachPendingChangesReviewHref(params: {
  suggestionId: string;
  contextDate: string;
}): string {
  const searchParams = new URLSearchParams({
    suggestionId: params.suggestionId,
    contextDate: params.contextDate,
  });
  return `/coach?${searchParams.toString()}`;
}

function appendCoachSuggestionReviewParams(
  href: string,
  params?: { suggestionId?: string | null; contextDate?: string | null }
): string {
  if (!params?.suggestionId || !isLocalDateString(params.contextDate)) return href;
  const url = new URL(href, "https://adaptivai.local");
  url.searchParams.set("suggestionId", params.suggestionId);
  url.searchParams.set("contextDate", params.contextDate);
  return `${url.pathname}${url.search}`;
}

function buildCalendarDateHref(
  date: string,
  params?: { suggestionId?: string | null; contextDate?: string | null }
): string {
  return appendCoachSuggestionReviewParams(
    `/calendar?date=${encodeURIComponent(date)}`,
    params
  );
}

function isLocalDateString(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export function getCoachSuggestionCalendarHref(
  payload: unknown,
  fallbackDate?: string | null,
  params?: { suggestionId?: string | null; contextDate?: string | null }
): string | null {
  if (!payload || typeof payload !== "object") return null;

  const kind = typeof (payload as { kind?: unknown }).kind === "string"
    ? (payload as { kind: string }).kind
    : null;

  if (!kind) return null;

  if ((kind === "adjustWorkout" || kind === "moveWorkout") && typeof (payload as { workoutId?: unknown }).workoutId === "string") {
    return appendCoachSuggestionReviewParams(
      `/calendar?workoutId=${encodeURIComponent((payload as { workoutId: string }).workoutId)}`,
      params
    );
  }

  if (kind === "swapWorkouts" && typeof (payload as { fromWorkoutId?: unknown }).fromWorkoutId === "string") {
    return appendCoachSuggestionReviewParams(
      `/calendar?workoutId=${encodeURIComponent((payload as { fromWorkoutId: string }).fromWorkoutId)}`,
      params
    );
  }

  if (
    (kind === "swapWorkouts" || kind === "moveWorkout") &&
    isLocalDateString((payload as { toDate?: unknown }).toDate)
  ) {
    return buildCalendarDateHref((payload as { toDate: string }).toDate, params);
  }

  if (kind === "addRecoveryDay" && isLocalDateString((payload as { date?: unknown }).date)) {
    return buildCalendarDateHref((payload as { date: string }).date, params);
  }

  if (kind === "rebalanceWeek" && Array.isArray((payload as { changes?: unknown[] }).changes)) {
    const firstWorkoutId = (payload as { changes: Array<{ workoutId?: unknown }> }).changes.find(
      (change) => typeof change?.workoutId === "string"
    )?.workoutId;

    if (typeof firstWorkoutId === "string") {
      return appendCoachSuggestionReviewParams(
        `/calendar?workoutId=${encodeURIComponent(firstWorkoutId)}`,
        params
      );
    }
  }

  return isLocalDateString(fallbackDate) ? buildCalendarDateHref(fallbackDate, params) : null;
}
