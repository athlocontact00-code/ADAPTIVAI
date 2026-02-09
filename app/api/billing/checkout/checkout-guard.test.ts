import { describe, it, expect, vi, beforeEach } from "vitest";

const mockPortalUrl = "https://billing.stripe.com/session/xyz";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/db", () => ({
  db: {
    user: { findUnique: vi.fn() },
  },
}));
vi.mock("@/lib/stripe", () => ({
  getStripeClient: vi.fn(),
}));
vi.mock("@/lib/billing/stripe-customer", () => ({
  ensureStripeCustomerForUser: vi.fn().mockResolvedValue("cus_existing"),
}));
vi.mock("@/lib/billing/entitlements", () => ({
  getEntitlements: vi.fn(),
}));

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getStripeClient } from "@/lib/stripe";
import { getEntitlements } from "@/lib/billing/entitlements";
import { POST } from "./route";

describe("Checkout guard: active subscription", () => {
  beforeEach(() => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: "user-1", email: "u@example.com" },
      expires: "",
    } as never);
    vi.mocked(db.user.findUnique).mockResolvedValue({
      id: "user-1",
      email: "u@example.com",
      stripeCustomerId: "cus_xxx",
    } as never);
    vi.mocked(getEntitlements).mockResolvedValue({
      isPro: true,
      plan: "PRO",
    } as never);
    vi.mocked(getStripeClient).mockReturnValue({
      billingPortal: {
        sessions: {
          create: vi.fn().mockResolvedValue({ url: mockPortalUrl }),
        },
      },
    } as never);
    process.env.APP_URL = "https://app.example.com";
  });

  it("returns 409 with ALREADY_SUBSCRIBED and portalUrl when user has active subscription", async () => {
    const req = new Request("http://localhost/api/billing/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plan: "month" }),
    });

    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(409);
    expect(data.code).toBe("ALREADY_SUBSCRIBED");
    expect(data.portalUrl).toBe(mockPortalUrl);
    expect(data.error).toContain("active subscription");
  });
});
