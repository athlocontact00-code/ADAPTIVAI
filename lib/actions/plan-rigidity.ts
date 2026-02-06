"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { track } from "@/lib/analytics/events";
import { createRequestId, logError, logInfo } from "@/lib/logger";
import {
  type PlanRigiditySetting,
} from "@/lib/services/plan-rigidity.service";

export type { PlanRigiditySetting };

type ProposalStatus = "PENDING" | "ACCEPTED" | "DECLINED";

export type ProposalPatch = {
  workout: {
    id: string;
    update: {
      title?: string;
      type?: string;
      date?: string;
      planned?: boolean;
      completed?: boolean;
      durationMin?: number | null;
      tss?: number | null;
      descriptionMd?: string | null;
      prescriptionJson?: string | null;
      aiGenerated?: boolean;
      aiReason?: string | null;
      aiConfidence?: number | null;
      source?: string | null;
    };
  };
};

type ProfileDelegate = {
  upsert: (args: unknown) => Promise<unknown>;
  findUnique: (args: unknown) => Promise<{ planRigidity?: unknown } | null>;
};

type AuditLogDelegate = {
  create: (args: unknown) => Promise<unknown>;
};

type PlanChangeProposalRow = {
  id: string;
  userId: string;
  workoutId: string | null;
  checkInId: string | null;
  patchJson: string | null;
  status: string;
  sourceType: string;
};

type PlanChangeProposalDelegate = {
  create: (args: unknown) => Promise<{ id: string }>;
  findUnique: (args: unknown) => Promise<PlanChangeProposalRow | null>;
  update: (args: unknown) => Promise<unknown>;
  findMany: (args: unknown) => Promise<Array<{ id: string; summary: string; confidence: number | null; createdAt: Date }>>;
};

type DailyCheckInDelegate = {
  update: (args: unknown) => Promise<unknown>;
};

type WorkoutDelegate = {
  update: (args: unknown) => Promise<unknown>;
};

const planDb = db as unknown as {
  profile: ProfileDelegate;
  auditLog: AuditLogDelegate;
  planChangeProposal: PlanChangeProposalDelegate;
  dailyCheckIn: DailyCheckInDelegate;
  workout: WorkoutDelegate;
};

export async function updatePlanRigidity(
  planRigidity: PlanRigiditySetting
): Promise<{ success: boolean; error?: string }> {
  const requestId = createRequestId();
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: "Unauthorized" };

  try {
    await planDb.profile.upsert({
      where: { userId: session.user.id },
      create: { userId: session.user.id, planRigidity },
      update: { planRigidity },
    });

    await planDb.auditLog.create({
      data: {
        userId: session.user.id,
        actorUserId: session.user.id,
        actionType: "SETTINGS_CHANGED",
        targetType: "SETTINGS",
        targetId: session.user.id,
        summary: "Updated plan rigidity",
        detailsJson: JSON.stringify({ planRigidity }),
      },
    });
  } catch (error) {
    logError("settings.plan_rigidity.update_failed", {
      requestId,
      userId: session.user.id,
      action: "updatePlanRigidity",
      error: error instanceof Error ? error.message : String(error),
    });
    return { success: false, error: "Failed to update setting" };
  }

  revalidatePath("/settings");
  return { success: true };
}

export async function getPlanRigidity(): Promise<PlanRigiditySetting> {
  const session = await auth();
  if (!session?.user?.id) return "LOCKED_1_DAY";

  const profile = await planDb.profile.findUnique({
    where: { userId: session.user.id },
    select: { planRigidity: true },
  });

  const v = String(profile?.planRigidity ?? "LOCKED_1_DAY");
  if (
    v === "LOCKED_TODAY" ||
    v === "LOCKED_1_DAY" ||
    v === "LOCKED_2_DAYS" ||
    v === "LOCKED_3_DAYS" ||
    v === "FLEXIBLE_WEEK"
  ) {
    return v;
  }
  return "LOCKED_1_DAY";
}

// note: sync helpers live in lib/services/plan-rigidity.service.ts

export async function createPlanChangeProposal(params: {
  workoutId?: string;
  checkInId?: string;
  summary: string;
  patch: ProposalPatch;
  confidence?: number;
  sourceType: "DAILY_CHECKIN" | "COACH" | "RULE";
}): Promise<{ success: boolean; proposalId?: string; error?: string }> {
  const requestId = createRequestId();
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: "Unauthorized" };

  let proposalId: string;
  try {
    const proposal = await planDb.planChangeProposal.create({
      data: {
        userId: session.user.id,
        workoutId: params.workoutId ?? null,
        checkInId: params.checkInId ?? null,
        sourceType: params.sourceType,
        summary: params.summary,
        patchJson: JSON.stringify(params.patch),
        confidence: typeof params.confidence === "number" ? params.confidence : null,
        status: "PENDING",
      },
    });
    proposalId = proposal.id;

    await planDb.auditLog.create({
      data: {
        userId: session.user.id,
        actorUserId: session.user.id,
        actionType: "PLAN_CHANGE_PROPOSED",
        targetType: "PLAN",
        targetId: proposalId,
        summary: "Proposed a plan change",
        detailsJson: JSON.stringify({ proposalId, workoutId: params.workoutId, sourceType: params.sourceType }),
      },
    });
  } catch (error) {
    logError("plan_proposal.create.failed", {
      requestId,
      userId: session.user.id,
      action: "createPlanChangeProposal",
      workoutId: params.workoutId,
      error: error instanceof Error ? error.message : String(error),
    });
    return { success: false, error: "Failed to create proposal" };
  }

  revalidatePath("/calendar");
  revalidatePath("/dashboard");

  return { success: true, proposalId };
}

export async function decidePlanChangeProposal(params: {
  proposalId: string;
  decision: "ACCEPT" | "DECLINE";
}): Promise<{ success: boolean; error?: string }> {
  const requestId = createRequestId();
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: "Unauthorized" };

  logInfo("plan_proposal.decide.started", {
    requestId,
    userId: session.user.id,
    action: "decidePlanChangeProposal",
    proposalId: params.proposalId,
    decision: params.decision,
  });

  const proposal = await planDb.planChangeProposal.findUnique({
    where: { id: params.proposalId },
  });

  if (!proposal || proposal.userId !== session.user.id) {
    return { success: false, error: "Proposal not found" };
  }

  const status: ProposalStatus = params.decision === "ACCEPT" ? "ACCEPTED" : "DECLINED";

  if (proposal.status !== "PENDING") {
    return { success: false, error: "Proposal already decided" };
  }

  // Apply only on ACCEPT
  if (status === "ACCEPTED") {
    const patch = JSON.parse(String(proposal.patchJson ?? "{}")) as ProposalPatch;
    const workoutId = patch?.workout?.id;

    if (!workoutId || workoutId !== proposal.workoutId) {
      return { success: false, error: "Invalid proposal patch" };
    }

    // Ensure ownership
    const workout = await db.workout.findUnique({ where: { id: workoutId } });
    if (!workout || workout.userId !== session.user.id) {
      return { success: false, error: "Workout not found" };
    }

    const data = { ...patch.workout.update } as Record<string, unknown>;
    if (typeof data.date === "string" && data.date.trim().length > 0) {
      const raw = data.date.trim();
      if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
        const [y, m, d] = raw.split("-").map((n) => parseInt(n, 10));
        const dt = new Date(y, m - 1, d);
        dt.setHours(12, 0, 0, 0);
        data.date = dt;
      } else {
        const dt = new Date(raw);
        if (!Number.isNaN(dt.getTime())) data.date = dt;
      }
    }

    await planDb.workout.update({
      where: { id: workoutId },
      data,
    });

    await planDb.auditLog.create({
      data: {
        userId: session.user.id,
        actorUserId: session.user.id,
        actionType: "PLAN_CHANGE_ACCEPTED",
        targetType: "PLAN",
        targetId: proposal.id,
        summary: "Accepted plan change proposal",
        detailsJson: JSON.stringify({ proposalId: proposal.id, workoutId }),
      },
    });

    if (proposal.checkInId) {
      await planDb.dailyCheckIn.update({
        where: { id: proposal.checkInId },
        data: { userAccepted: true, userOverrideReason: null },
      });
    }

    await track({
      name: "plan_proposal_accepted",
      userId: session.user.id,
      requestId,
      route: "/calendar",
      source: "plan_proposal",
      properties: { proposalId: proposal.id, workoutId },
    });
  } else {
    await planDb.auditLog.create({
      data: {
        userId: session.user.id,
        actorUserId: session.user.id,
        actionType: "PLAN_CHANGE_DECLINED",
        targetType: "PLAN",
        targetId: proposal.id,
        summary: "Declined plan change proposal",
        detailsJson: JSON.stringify({ proposalId: proposal.id, workoutId: proposal.workoutId }),
      },
    });

    if (proposal.sourceType === "COACH" && proposal.workoutId) {
      const w = await db.workout.findUnique({ where: { id: proposal.workoutId } });
      if (w && w.userId === session.user.id && !w.planned && !w.completed && w.source === "coach_proposal") {
        await db.workout.delete({ where: { id: w.id } });
      }
    }

    if (proposal.checkInId) {
      await planDb.dailyCheckIn.update({
        where: { id: proposal.checkInId },
        data: { userAccepted: false, userOverrideReason: "Declined plan change proposal" },
      });
    }

    await track({
      name: "plan_proposal_declined",
      userId: session.user.id,
      requestId,
      route: "/calendar",
      source: "plan_proposal",
      properties: { proposalId: proposal.id, workoutId: proposal.workoutId },
    });
  }

  await planDb.planChangeProposal.update({
    where: { id: proposal.id },
    data: { status, decidedAt: new Date() },
  });

  revalidatePath("/calendar");
  revalidatePath("/dashboard");

  logInfo("plan_proposal.decide.succeeded", {
    requestId,
    userId: session.user.id,
    action: "decidePlanChangeProposal",
    proposalId: proposal.id,
    status,
  });
  return { success: true };
}

export async function getPendingProposalsForWorkout(workoutId: string): Promise<
  Array<{ id: string; summary: string; confidence: number | null; createdAt: Date }>
> {
  const session = await auth();
  if (!session?.user?.id) return [];

  const proposals = await planDb.planChangeProposal.findMany({
    where: { userId: session.user.id, workoutId, status: "PENDING" },
    orderBy: { createdAt: "desc" },
    take: 5,
    select: { id: true, summary: true, confidence: true, createdAt: true },
  });

  return proposals;
}

export async function getPlanRigidityForUser(userId: string): Promise<PlanRigiditySetting> {
  const profile = await planDb.profile.findUnique({
    where: { userId },
    select: { planRigidity: true },
  });
  const v = String(profile?.planRigidity ?? "LOCKED_1_DAY");
  if (
    v === "LOCKED_TODAY" ||
    v === "LOCKED_1_DAY" ||
    v === "LOCKED_2_DAYS" ||
    v === "LOCKED_3_DAYS" ||
    v === "FLEXIBLE_WEEK"
  ) {
    return v;
  }
  return "LOCKED_1_DAY";
}
