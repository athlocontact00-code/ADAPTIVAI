export function getDashboardCoachPlannerStatusCopy(params: {
  pendingCount?: number;
  resolvedTitle?: string | null;
  plannerStale?: boolean;
}): {
  title: string;
  description: string;
} {
  if ((params.pendingCount ?? 0) > 0) {
    return {
      title:
        params.pendingCount === 1
          ? "1 coach change waiting"
          : `${params.pendingCount} coach changes waiting`,
      description: "Review the latest coach recommendation before continuing with today's plan.",
    };
  }

  if (params.resolvedTitle?.trim()) {
    return {
      title: "Coach review completed",
      description: params.resolvedTitle.trim(),
    };
  }

  if (params.plannerStale) {
    return {
      title: "Today's guidance needs refresh",
      description: "Your latest check-in or workout change may have affected today's recommendation.",
    };
  }

  return {
    title: "Coach and planner are aligned",
    description: "Review today's guidance or continue refining your plan with Coach.",
  };
}
