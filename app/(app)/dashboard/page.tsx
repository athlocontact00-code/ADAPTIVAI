import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getAdaptiveDayPlannerCacheSnapshot } from "@/lib/services/adaptive-day-planner-cache.service";
import { getDashboardMetrics, getUpcomingWorkouts, getRecentWorkouts } from "@/lib/services/metrics";
import { getCoachPendingChangesSummary } from "@/lib/services/coach-pending-changes.service";
import { getResolvedCoachReviewSummary } from "@/lib/services/resolved-coach-review.service";
import { getTodayReadiness, getRiskAssessment, getReadinessTrend } from "@/lib/actions/decision";
import { getPsychologyData } from "@/lib/actions/psychology";
import { needsCheckIn, getTodayCheckIn, getTodayPremiumCheckin } from "@/lib/actions/daily-checkin";
import { getDashboardRetentionSummary } from "@/lib/actions/dashboard-retention";
import { getTodayQuote } from "@/lib/actions/quotes";
import { DashboardClientV2 } from "./dashboard-client-v2";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams?: Promise<{ resolvedSuggestionId?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }
  const resolvedSearchParams = searchParams ? await searchParams : undefined;

  const safe = async <T,>(label: string, p: Promise<T>, fallback: T): Promise<T> => {
    try {
      return await p;
    } catch (err) {
      console.error(`[dashboard] ${label} failed:`, err);
      return fallback;
    }
  };

  // Fetch all data including check-in status
  const [
    metrics,
    upcoming,
    recent,
    readinessResult,
    riskResult,
    trend,
    psychResult,
    checkInStatus,
    todayCheckIn,
    todayPremiumCheckin,
    latestDigest,
    retentionSummary,
    quoteResult,
    todayDecision,
    coachPendingChanges,
    resolvedCoachReview,
  ] = await Promise.all([
    safe(
      "getDashboardMetrics",
      getDashboardMetrics(session.user.id),
      {
        ctl: null,
        atl: null,
        tsb: null,
        readiness: null,
        weeklyHours: null,
        weeklyTSS: null,
        lastWeekHours: null,
        lastWeekTSS: null,
        weeklyHoursDelta: null,
        weeklyTSSDelta: null,
        ctlDelta: null,
        ctlSparkline: [],
        monthlyHours: null,
        workoutsThisWeek: 0,
        chartData: [],
      }
    ),
    safe("getUpcomingWorkouts", getUpcomingWorkouts(session.user.id), []),
    safe("getRecentWorkouts", getRecentWorkouts(session.user.id), []),
    safe("getTodayReadiness", getTodayReadiness(), { success: false, error: "Failed" }),
    safe("getRiskAssessment", getRiskAssessment(), { success: false, error: "Failed" }),
    safe("getReadinessTrend", getReadinessTrend(14), []),
    safe("getPsychologyData", getPsychologyData(), { success: false, error: "Failed" }),
    safe("needsCheckIn", needsCheckIn(), { required: false, workout: null }),
    safe("getTodayCheckIn", getTodayCheckIn(), null),
    safe(
      "getTodayPremiumCheckin",
      getTodayPremiumCheckin(),
      { success: false, status: "pending", data: null, error: "Failed to load check-in" }
    ),
    safe(
      "getLatestDigest",
      db.weeklyDigest.findFirst({
        where: { userId: session.user.id },
        orderBy: { weekStart: "desc" },
      }),
      null
    ),
    safe("getDashboardRetentionSummary", getDashboardRetentionSummary(), {
      nextAction: {
        kind: "PLAN_WORKOUT",
        title: "Plan your next workout",
        subtitle: "Open Calendar to plan your next session.",
      },
      streaks: {
        checkInDayStreak: 0,
        workoutWeekStreak: 0,
        workoutWeekThreshold: 3,
      },
      nudges: {
        showOverrideSignal: false,
        overrideCount7d: 0,
        showPainSignal: false,
        painCount7d: 0,
        canShowNoonCheckInNudge: false,
      },
    }),
    safe("getTodayQuote", getTodayQuote(), null),
    safe(
      "getAdaptiveDayPlannerCacheSnapshot",
      getAdaptiveDayPlannerCacheSnapshot(session.user.id, new Date(new Date().setHours(0, 0, 0, 0))),
      { payload: null, stale: false, staleReason: null, changedAt: null }
    ),
    safe(
      "getCoachPendingChangesSummary",
      getCoachPendingChangesSummary(session.user.id, new Date(new Date().setHours(0, 0, 0, 0))),
      null
    ),
    safe(
      "getResolvedCoachReviewSummary",
      typeof resolvedSearchParams?.resolvedSuggestionId === "string" && resolvedSearchParams.resolvedSuggestionId.length > 0
        ? getResolvedCoachReviewSummary(session.user.id, resolvedSearchParams.resolvedSuggestionId)
        : Promise.resolve(null),
      null
    ),
  ]);

  return (
    <DashboardClientV2
      metrics={metrics}
      quote={quoteResult}
      upcomingWorkouts={upcoming}
      recentWorkouts={recent}
      readinessData={readinessResult.success ? readinessResult.data : null}
      riskData={riskResult.success ? riskResult.data : null}
      readinessTrend={trend}
      psychologyData={psychResult.success ? psychResult.data : null}
      checkInRequired={checkInStatus.required}
      checkInWorkout={checkInStatus.workout}
      todayCheckIn={todayCheckIn ? {
        id: todayCheckIn.id,
        aiDecision: todayCheckIn.aiDecision,
        aiExplanation: todayCheckIn.aiExplanation,
        userAccepted: todayCheckIn.userAccepted,
      } : null}
      premiumCheckin={todayPremiumCheckin}
      initialTodayDecision={
        todayDecision.payload
          ? {
              decision: todayDecision.payload,
              cached: true,
              stale: todayDecision.stale,
              staleReason: todayDecision.staleReason,
              changedAt: todayDecision.changedAt,
              date: new Date(new Date().setHours(0, 0, 0, 0)).toISOString(),
            }
          : null
      }
      coachPendingChanges={coachPendingChanges}
      resolvedCoachReview={resolvedCoachReview}
      retentionSummary={retentionSummary}
      latestDigest={
        latestDigest
          ? {
              id: latestDigest.id,
              weekStart: latestDigest.weekStart.toISOString(),
              weekEnd: latestDigest.weekEnd.toISOString(),
              subject: latestDigest.subject,
              text: latestDigest.text,
              data: latestDigest.data,
            }
          : null
      }
    />
  );
}
