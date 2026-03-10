import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { isProSubscriptionStatus } from "./entitlements-utils";

export { isProSubscriptionStatus };
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
  cancelAtPeriodEnd: boolean;
};

function parseGraceDays(): number {
  const raw = process.env.BILLING_GRACE_DAYS;
  if (!raw) return 3;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : 3;
}

/**
 * Deterministic plan derivation:
 * - If active admin entitlement override (proEnabled, not expired) -> PRO
 * - Else if active Stripe subscription (Pro) -> PRO
 * - Else if now < trialEndsAt (app-level trial) -> TRIAL
 * - Else -> FREE
 */
export async function getEntitlements(userId: string): Promise<Entitlements> {
  // PHASE 6: Mega Viral Update. The app is completely free.
  // Bypass all Stripe subscription checks and grant PRO to everyone.

  // Return mocked infinite entitlement
  return {
    isPro: true,
    plan: "PRO",
    status: "active",
    renewAt: new Date(2100, 1, 1),
    isTrialActive: false,
    trialEndsAt: null,
    trialDaysRemaining: null,
    canUseAICoach: true,
    canUseSimulator: true,
    canUseReports: true,
    currentPeriodEnd: new Date(2100, 1, 1),
    cancelAtPeriodEnd: false,
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
  return ent;
}

export async function requireProSession(): Promise<{ userId: string; entitlements: Entitlements }> {
  const userId = await requireUserId();
  const entitlements = await requireProUser(userId);
  return { userId, entitlements };
}
