import { describe, it, expect } from "vitest";
import { mapSubscriptionToUpsertData } from "./subscription-mapper";
import type Stripe from "stripe";

function createMockSubscription(overrides: Partial<{
  id: string;
  status: string;
  current_period_start: number;
  current_period_end: number;
  canceled_at: number | null;
  ended_at: number | null;
  trial_end: number | null;
  cancel_at_period_end: boolean;
  price: { id: string; product: string };
}> = {}): Stripe.Subscription {
  const now = Math.floor(Date.now() / 1000);
  return {
    id: "sub_test",
    object: "subscription",
    status: "active",
    current_period_start: now - 86400 * 7,
    current_period_end: now + 86400 * 23,
    canceled_at: null,
    ended_at: null,
    trial_end: null,
    cancel_at_period_end: false,
    items: {
      object: "list",
      data: [
        {
          id: "si_test",
          object: "subscription_item",
          price: {
            id: "price_test",
            object: "price",
            product: "prod_test",
          } as Stripe.Price,
        } as Stripe.SubscriptionItem,
      ],
      has_more: false,
      url: "",
    },
    customer: "cus_test",
    ...overrides,
  } as unknown as Stripe.Subscription;
}

describe("mapSubscriptionToUpsertData", () => {
  it("maps active subscription to upsert data", () => {
    const sub = createMockSubscription({ status: "active" });
    const result = mapSubscriptionToUpsertData(sub, ["price_test"]);

    expect(result.plan).toBe("pro");
    expect(result.status).toBe("active");
    expect(result.stripePriceId).toBe("price_test");
    expect(result.stripeProductId).toBe("prod_test");
    expect(result.currentPeriodStart).toBeInstanceOf(Date);
    expect(result.currentPeriodEnd).toBeInstanceOf(Date);
    expect(result.cancelAtPeriodEnd).toBe(false);
    expect(result.canceledAt).toBeNull();
    expect(result.endedAt).toBeNull();
    expect(result.trialEnd).toBeNull();
  });

  it("maps trialing subscription", () => {
    const sub = createMockSubscription({ status: "trialing" });
    const result = mapSubscriptionToUpsertData(sub, []);

    expect(result.status).toBe("trialing");
  });

  it("maps canceled subscription", () => {
    const now = Math.floor(Date.now() / 1000);
    const sub = createMockSubscription({
      status: "canceled",
      canceled_at: now,
      ended_at: now,
    });
    const result = mapSubscriptionToUpsertData(sub, []);

    expect(result.status).toBe("canceled");
    expect(result.canceledAt).toBeInstanceOf(Date);
    expect(result.endedAt).toBeInstanceOf(Date);
  });

  it("maps cancel_at_period_end", () => {
    const sub = createMockSubscription({ cancel_at_period_end: true });
    const result = mapSubscriptionToUpsertData(sub, []);

    expect(result.cancelAtPeriodEnd).toBe(true);
  });
});
