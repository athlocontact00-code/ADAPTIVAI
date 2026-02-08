import { describe, it, expect, vi, beforeEach } from "vitest";
import { isProSubscriptionStatus } from "./entitlements-utils";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/db", () => ({
  db: {
    entitlementOverride: { findUnique: vi.fn() },
    user: { findUnique: vi.fn() },
    subscription: { findFirst: vi.fn() },
  },
}));

import { db } from "@/lib/db";
import { getEntitlements } from "./entitlements";

describe("getEntitlements with override", () => {
  beforeEach(() => {
    vi.mocked(db.entitlementOverride.findUnique).mockResolvedValue(null);
    vi.mocked(db.user.findUnique).mockResolvedValue(null);
    vi.mocked(db.subscription.findFirst).mockResolvedValue(null);
  });

  it("returns PRO when active override exists (no expiry)", async () => {
    vi.mocked(db.entitlementOverride.findUnique).mockResolvedValue({
      proEnabled: true,
      expiresAt: null,
    } as never);

    const ent = await getEntitlements("user-1");

    expect(ent.plan).toBe("PRO");
    expect(ent.isPro).toBe(true);
    expect(ent.canUseAICoach).toBe(true);
    expect(ent.status).toBe("override");
  });

  it("returns PRO when override expires in future", async () => {
    const future = new Date(Date.now() + 60 * 60 * 1000);
    vi.mocked(db.entitlementOverride.findUnique).mockResolvedValue({
      proEnabled: true,
      expiresAt: future,
    } as never);

    const ent = await getEntitlements("user-1");

    expect(ent.plan).toBe("PRO");
    expect(ent.isPro).toBe(true);
  });

  it("ignores expired override and falls through to subscription", async () => {
    const past = new Date(Date.now() - 60 * 60 * 1000);
    vi.mocked(db.entitlementOverride.findUnique).mockResolvedValue({
      proEnabled: true,
      expiresAt: past,
    } as never);
    vi.mocked(db.user.findUnique).mockResolvedValue({
      trialStartedAt: null,
      trialEndsAt: null,
    } as never);
    vi.mocked(db.subscription.findFirst).mockResolvedValue(null);

    const ent = await getEntitlements("user-1");

    expect(ent.plan).toBe("FREE");
    expect(ent.isPro).toBe(false);
  });
});

describe("isProSubscriptionStatus", () => {
  it("returns true for active", () => {
    expect(isProSubscriptionStatus("active")).toBe(true);
  });

  it("returns true for trialing", () => {
    expect(isProSubscriptionStatus("trialing")).toBe(true);
  });

  it("returns false for canceled", () => {
    expect(isProSubscriptionStatus("canceled")).toBe(false);
  });

  it("returns false for incomplete", () => {
    expect(isProSubscriptionStatus("incomplete")).toBe(false);
  });

  it("returns false for past_due", () => {
    expect(isProSubscriptionStatus("past_due")).toBe(false);
  });

  it("returns false for null", () => {
    expect(isProSubscriptionStatus(null)).toBe(false);
  });

  it("returns false for empty string", () => {
    expect(isProSubscriptionStatus("")).toBe(false);
  });
});
