import React from "react";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getAdaptiveDayPlannerCacheSnapshot } from "@/lib/services/adaptive-day-planner-cache.service";
import { getCoachPendingChangesSummary } from "@/lib/services/coach-pending-changes.service";
import { buildCoachPendingChangesReviewHref } from "@/lib/product/coach-pending-changes";
import { addDays, startOfWeek } from "@/lib/utils";
import { CalendarClient } from "./calendar-client";

export default async function CalendarPage({
  searchParams,
}: {
  searchParams?: Promise<{ workoutId?: string; proposalId?: string; date?: string; suggestionId?: string; contextDate?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const requestedDate =
    typeof resolvedSearchParams?.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(resolvedSearchParams.date)
      ? new Date(`${resolvedSearchParams.date}T12:00:00`)
      : today;
  requestedDate.setHours(0, 0, 0, 0);
  const monthStart = new Date(requestedDate.getFullYear(), requestedDate.getMonth(), 1);
  monthStart.setHours(0, 0, 0, 0);

  const gridStart = startOfWeek(monthStart);
  const gridEndExclusive = addDays(gridStart, 42);

  const workouts = await db.workout.findMany({
    where: {
      userId: session.user.id,
      date: {
        gte: gridStart,
        lt: gridEndExclusive,
      },
    },
    orderBy: [{ date: "asc" }, { createdAt: "asc" }],
  });

  const feedbackRows =
    workouts.length > 0
      ? await db.postWorkoutFeedback.findMany({
          where: {
            userId: session.user.id,
            workoutId: { in: workouts.map((w) => w.id) },
          },
          select: { workoutId: true },
        })
      : [];

  const feedbackWorkoutIds = feedbackRows.map((r) => String(r.workoutId));

  const checkInDb = db as unknown as {
    dailyCheckIn: {
      findMany: (args: {
        where: {
          userId: string;
          date: {
            gte: Date;
            lt: Date;
          };
        };
        orderBy: { date: "asc" | "desc" };
        select: {
          id: true;
          date: true;
          readinessScore: true;
          aiDecision: true;
          aiConfidence: true;
          workoutId: true;
          userAccepted: true;
        };
      }) => Promise<
        Array<{
          id: string;
          date: Date;
          readinessScore: number | null;
          aiDecision: string | null;
          aiConfidence: number | null;
          workoutId: string | null;
          userAccepted: boolean | null;
        }>
      >;
    };
  };

  const checkIns = await checkInDb.dailyCheckIn.findMany({
    where: {
      userId: session.user.id,
      date: {
        gte: gridStart,
        lt: gridEndExclusive,
      },
    },
    orderBy: { date: "asc" },
    select: {
      id: true,
      date: true,
      readinessScore: true,
      aiDecision: true,
      aiConfidence: true,
      workoutId: true,
      userAccepted: true,
    },
  });

  const initialTodayDecision = await getAdaptiveDayPlannerCacheSnapshot(session.user.id, today);
  const coachPendingChanges = await getCoachPendingChangesSummary(session.user.id, today);
  const initialCoachSuggestionReview =
    typeof resolvedSearchParams?.suggestionId === "string" && resolvedSearchParams.suggestionId.length > 0
      ? await db.coachSuggestion.findFirst({
          where: {
            id: resolvedSearchParams.suggestionId,
            userId: session.user.id,
            status: "PENDING",
          },
          select: { id: true, title: true, summary: true, contextDate: true },
        })
      : null;
  const initialProposalReview =
    typeof resolvedSearchParams?.proposalId === "string" && resolvedSearchParams.proposalId.length > 0
      ? await db.planChangeProposal.findFirst({
          where: {
            id: resolvedSearchParams.proposalId,
            userId: session.user.id,
            status: "PENDING",
          },
          select: { id: true, workoutId: true, summary: true },
        })
      : null;

  const initialOpenWorkoutIdFromProposal =
    initialProposalReview?.workoutId ?? null;
  const initialOpenWorkoutId =
    typeof resolvedSearchParams?.workoutId === "string" && resolvedSearchParams.workoutId.length > 0
      ? resolvedSearchParams.workoutId
      : initialOpenWorkoutIdFromProposal;

  return (
    <CalendarClient
      userId={session.user.id}
      initialWorkouts={workouts}
      initialCheckIns={checkIns}
      initialFeedbackWorkoutIds={feedbackWorkoutIds}
      initialMonthDate={monthStart}
      initialSelectedDate={requestedDate}
      initialOpenWorkoutId={initialOpenWorkoutId}
      initialCoachSuggestionReview={
        initialCoachSuggestionReview
          ? {
              suggestionId: initialCoachSuggestionReview.id,
              contextDate: initialCoachSuggestionReview.contextDate.toISOString().slice(0, 10),
              title: initialCoachSuggestionReview.title,
              summary: initialCoachSuggestionReview.summary,
              reviewHref: buildCoachPendingChangesReviewHref({
                suggestionId: initialCoachSuggestionReview.id,
                contextDate: initialCoachSuggestionReview.contextDate.toISOString().slice(0, 10),
              }),
            }
          : null
      }
      initialProposalReview={
        initialProposalReview
          ? {
              proposalId: initialProposalReview.id,
              summary: initialProposalReview.summary,
            }
          : null
      }
      initialTodayDecision={
        initialTodayDecision.payload
          ? {
              decision: initialTodayDecision.payload,
              cached: true,
              stale: initialTodayDecision.stale,
              staleReason: initialTodayDecision.staleReason,
              changedAt: initialTodayDecision.changedAt,
              date: today.toISOString(),
            }
          : null
      }
      coachPendingChanges={coachPendingChanges}
    />
  );
}
