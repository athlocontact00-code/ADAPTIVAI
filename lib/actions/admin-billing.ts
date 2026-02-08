"use server";

import { auth } from "@/lib/auth";
import { isAdmin } from "@/lib/admin";
import { resyncUserBilling } from "@/lib/billing/resync-user";
import { db } from "@/lib/db";

export type ResyncBillingResult =
  | {
      ok: true;
      resyncedUserId: string;
      subscriptionStatus: string | null;
      plan: string;
      currentPeriodEnd: string | null;
    }
  | { ok: false; error: string };

/** Server action: resync billing for current user or given userId. Admin only. */
export async function resyncBillingAdmin(userId?: string): Promise<ResyncBillingResult> {
  const session = await auth();
  if (!session?.user?.id) {
    return { ok: false, error: "Unauthorized" };
  }
  if (!isAdmin(session)) {
    return { ok: false, error: "Forbidden: admin only" };
  }

  const targetUserId = userId ?? session.user.id;
  const result = await resyncUserBilling(targetUserId);

  if (!result.ok) {
    return { ok: false, error: result.error };
  }

  return {
    ok: true,
    resyncedUserId: result.resyncedUserId,
    subscriptionStatus: result.subscriptionStatus,
    plan: result.entitlements.plan,
    currentPeriodEnd: result.entitlements.currentPeriodEnd?.toISOString() ?? null,
  };
}

/** Server action: return whether current user is admin (for UI). */
export async function getIsAdmin(): Promise<boolean> {
  const session = await auth();
  return isAdmin(session);
}

export type ForceProResult =
  | { ok: true; userId: string; expiresAt: string }
  | { ok: false; error: string };

/** Server action: set entitlement override PRO for 24h. Admin only. */
export async function forceProFor24h(userId?: string): Promise<ForceProResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "Unauthorized" };
  if (!isAdmin(session)) return { ok: false, error: "Forbidden: admin only" };

  const targetUserId = userId ?? session.user.id;
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

  await db.entitlementOverride.upsert({
    where: { userId: targetUserId },
    create: {
      userId: targetUserId,
      proEnabled: true,
      expiresAt,
      reason: "Admin force PRO 24h",
    },
    update: { proEnabled: true, expiresAt, reason: "Admin force PRO 24h" },
  });

  return {
    ok: true,
    userId: targetUserId,
    expiresAt: expiresAt.toISOString(),
  };
}

/** Server action: clear entitlement override for user. Admin only. */
export async function clearEntitlementOverride(userId: string): Promise<{ ok: boolean; error?: string }> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "Unauthorized" };
  if (!isAdmin(session)) return { ok: false, error: "Forbidden: admin only" };

  await db.entitlementOverride.deleteMany({ where: { userId } });
  return { ok: true };
}
