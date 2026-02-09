import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  getSubscriptionIdFromInvoice,
  resolveSubscriptionFromInvoice,
} from "./webhook-invoice";
import type Stripe from "stripe";

describe("getSubscriptionIdFromInvoice", () => {
  it("returns subscription id when invoice.subscription is string", () => {
    const invoice = { subscription: "sub_123" } as unknown as Stripe.Invoice;
    expect(getSubscriptionIdFromInvoice(invoice)).toBe("sub_123");
  });

  it("returns subscription id when invoice.subscription is expanded object", () => {
    const invoice = {
      subscription: { id: "sub_expanded" },
    } as unknown as Stripe.Invoice;
    expect(getSubscriptionIdFromInvoice(invoice)).toBe("sub_expanded");
  });

  it("returns subscription id from first line item when subscription not on invoice", () => {
    const invoice = {
      subscription: null,
      lines: {
        data: [{ subscription: "sub_from_line" }],
      },
    } as unknown as Stripe.Invoice;
    expect(getSubscriptionIdFromInvoice(invoice)).toBe("sub_from_line");
  });

  it("returns null when no subscription anywhere", () => {
    const invoice = {
      subscription: null,
      lines: { data: [] },
    } as unknown as Stripe.Invoice;
    expect(getSubscriptionIdFromInvoice(invoice)).toBeNull();
  });

  it("returns null when invoice has no lines", () => {
    const invoice = { subscription: null } as unknown as Stripe.Invoice;
    expect(getSubscriptionIdFromInvoice(invoice)).toBeNull();
  });
});

describe("resolveSubscriptionFromInvoice", () => {
  const mockSub = {
    id: "sub_retrieved",
    customer: "cus_1",
    status: "active",
    current_period_end: 2000,
    items: { data: [{ price: { id: "price_1", product: "prod_1" } }] },
    metadata: {},
  } as unknown as Stripe.Subscription;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("retrieves subscription by id when invoice has subscriptionId", async () => {
    const retrieve = vi.fn().mockResolvedValue(mockSub);
    const stripe = {
      subscriptions: { retrieve, list: vi.fn() },
    } as unknown as Stripe;
    const invoice = {
      subscription: "sub_123",
      customer: "cus_1",
    } as unknown as Stripe.Invoice;

    const result = await resolveSubscriptionFromInvoice(stripe, invoice);

    expect(retrieve).toHaveBeenCalledWith("sub_123");
    expect(stripe.subscriptions.list).not.toHaveBeenCalled();
    expect(result).toEqual(mockSub);
  });

  it("falls back to customer subscriptions when invoice has no subscriptionId", async () => {
    const list = vi.fn().mockResolvedValue({
      data: [{ id: "sub_first", current_period_end: 1500 }],
    });
    const retrieve = vi.fn().mockResolvedValue(mockSub);
    const stripe = {
      subscriptions: { retrieve, list },
    } as unknown as Stripe;
    const invoice = {
      subscription: null,
      customer: "cus_1",
      period_end: 1500,
    } as unknown as Stripe.Invoice;

    const result = await resolveSubscriptionFromInvoice(stripe, invoice);

    expect(list).toHaveBeenCalledWith({
      customer: "cus_1",
      status: "all",
      limit: 5,
    });
    expect(retrieve).toHaveBeenCalledWith("sub_first");
    expect(result).toEqual(mockSub);
  });

  it("returns null when customer has no subscriptions", async () => {
    const list = vi.fn().mockResolvedValue({ data: [] });
    const stripe = {
      subscriptions: { retrieve: vi.fn(), list },
    } as unknown as Stripe;
    const invoice = {
      subscription: null,
      customer: "cus_1",
    } as unknown as Stripe.Invoice;

    const result = await resolveSubscriptionFromInvoice(stripe, invoice);

    expect(result).toBeNull();
  });

  it("returns null when invoice has no customer", async () => {
    const stripe = {
      subscriptions: { retrieve: vi.fn(), list: vi.fn() },
    } as unknown as Stripe;
    const invoice = { subscription: null, customer: null } as unknown as Stripe.Invoice;

    const result = await resolveSubscriptionFromInvoice(stripe, invoice);

    expect(result).toBeNull();
  });
});
