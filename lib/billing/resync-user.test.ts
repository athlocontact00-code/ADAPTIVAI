import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
  db: {
    user: { findUnique: vi.fn() },
    subscription: { findFirst: vi.fn() },
  },
}));
vi.mock("@/lib/stripe", () => ({
  getStripeClient: vi.fn(() => {
    throw new Error("STRIPE_SECRET_KEY not set");
  }),
}));
vi.mock("@/lib/billing/entitlements", () => ({
  getEntitlements: vi.fn(() =>
    Promise.resolve({
      plan: "FREE" as const,
      isPro: false,
      status: null,
      currentPeriodEnd: null,
    })
  ),
}));
vi.mock("@/lib/logger", () => ({ logInfo: vi.fn() }));

import { db } from "@/lib/db";
import { getEntitlements } from "@/lib/billing/entitlements";
import { resyncUserBilling } from "./resync-user";

describe("resyncUserBilling", () => {
  beforeEach(() => {
    vi.mocked(db.user.findUnique).mockResolvedValue(null);
    vi.mocked(db.subscription.findFirst).mockResolvedValue(null);
  });

  it("returns error when user not found", async () => {
    vi.mocked(db.user.findUnique).mockResolvedValue(null);

    const result = await resyncUserBilling("nonexistent");

    expect(result.ok).toBe(false);
    expect(result.ok === false && result.error).toBe("User not found");
  });

  it("returns entitlements when user has no stripe customer", async () => {
    vi.mocked(db.user.findUnique).mockResolvedValue({
      id: "user-1",
      email: "u@example.com",
      stripeCustomerId: null,
    } as never);

    const result = await resyncUserBilling("user-1");

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.resyncedUserId).toBe("user-1");
      expect(result.subscriptionStatus).toBeNull();
      expect(result.entitlements.plan).toBe("FREE");
    }
    expect(getEntitlements).toHaveBeenCalledWith("user-1");
  });
});
