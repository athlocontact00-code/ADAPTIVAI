import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export type Entitlements = {
  isPro: boolean;
  plan: "FREE" | "TRIAL" | "PRO";
  status: string | null;
  renewAt: Date | null;
  isTrialActive: boolean;
  trialEndsAt: Date | null;
  trialDaysRemaining: number | null;
  canUseAICoach: boolean;
  canUseSimulator: boolean;
  canUseReports: boolean;
  currentPeriodEnd: Date | null;
};

function parseGraceDays(): number {
  const raw = process.env.BILLING_GRACE_DAYS;
  if (!raw) return 3;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : 3;
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function isAccessEligibleStatus(status: string | null): boolean {
  if (!status) return false;
  return status === "active" || status === "trialing" || status === "past_due";
}

/**
 * Deterministic plan derivation:
 * - If active Stripe subscription (Pro) -> PRO
 * - Else if now < trialEndsAt (app-level trial) -> TRIAL
 * - Else -> FREE
 */
export async function getEntitlements(userId: string): Promise<Entitlements> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      trialStartedAt: true,
      trialEndsAt: true,
    },
  });

  const sub = await db.subscription.findFirst({
    where: { userId },
    orderBy: { updatedAt: "desc" },
    select: {
      plan: true,
      status: true,
      currentPeriodEnd: true,
    },
  });

  const now = new Date();
  const nowMs = now.getTime();

  const trialEndsAt = user?.trialEndsAt ?? null;
  const isTrialActive = Boolean(trialEndsAt && trialEndsAt.getTime() > nowMs);

  const graceDays = parseGraceDays();
  const renewAt = sub?.currentPeriodEnd ?? (isTrialActive ? trialEndsAt : null);
  const accessUntil =
    renewAt && sub?.plan === "pro"
      ? addDays(renewAt, graceDays)
      : renewAt;

  const isPaidPro = Boolean(
    sub?.plan === "pro" &&
      isAccessEligibleStatus(sub.status) &&
      (accessUntil ? accessUntil.getTime() > nowMs : false)
  );

  const plan: "FREE" | "TRIAL" | "PRO" = isPaidPro ? "PRO" : isTrialActive ? "TRIAL" : "FREE";
  const isPro = isPaidPro || isTrialActive;

  const trialDaysRemaining =
    isTrialActive && trialEndsAt
      ? Math.max(0, Math.ceil((trialEndsAt.getTime() - nowMs) / 86400000))
      : null;

  const canUseAICoach = isPro;
  const canUseSimulator = isPaidPro;
  const canUseReports = isPaidPro;

  return {
    isPro,
    plan,
    status: sub?.status ?? (isTrialActive ? "trial" : null),
    renewAt,
    isTrialActive: isTrialActive && !isPaidPro,
    trialEndsAt,
    trialDaysRemaining,
    canUseAICoach,
    canUseSimulator,
    canUseReports,
    currentPeriodEnd: sub?.currentPeriodEnd ?? null,
  };
}

export async function requireUserId(): Promise<string> {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error("Unauthorized");
  }
  return session.user.id;
}

export async function requireProUser(userId: string): Promise<Entitlements> {
  const ent = await getEntitlements(userId);
  if (!ent.isPro) {
    throw new Error("Pro subscription required");
  }
  return ent;
}

export async function requireProSession(): Promise<{ userId: string; entitlements: Entitlements }> {
  const userId = await requireUserId();
  const entitlements = await requireProUser(userId);
  return { userId, entitlements };
}
