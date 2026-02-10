import { describe, it, expect } from "vitest";
import { getProPriceIdForPlan, normalizePlan } from "./checkout-prices";

const env = {
  PRO_PRICE_ID_MONTHLY: "price_monthly",
  PRO_PRICE_ID_YEARLY: "price_yearly",
  STRIPE_PRICE_ID_PRO: "price_stripe_monthly",
  STRIPE_PRICE_ID_PRO_YEAR: "price_stripe_yearly",
};

describe("normalizePlan", () => {
  it("maps month and monthly to month", () => {
    expect(normalizePlan("month")).toBe("month");
    expect(normalizePlan("monthly")).toBe("month");
    expect(normalizePlan("MONTH")).toBe("month");
    expect(normalizePlan("  monthly  ")).toBe("month");
  });

  it("maps year and yearly to year", () => {
    expect(normalizePlan("year")).toBe("year");
    expect(normalizePlan("yearly")).toBe("year");
    expect(normalizePlan("YEARLY")).toBe("year");
    expect(normalizePlan("  year  ")).toBe("year");
  });

  it("defaults to month for empty, undefined, or invalid", () => {
    expect(normalizePlan("")).toBe("month");
    expect(normalizePlan(undefined)).toBe("month");
    expect(normalizePlan("invalid")).toBe("month");
    expect(normalizePlan("  ")).toBe("month");
  });
});

describe("plan -> price mapping", () => {
  it("monthly plan resolves to monthly price ID (STRIPE_PRICE_ID_PRO first)", () => {
    const plan = normalizePlan("monthly");
    expect(plan).toBe("month");
    const priceId = getProPriceIdForPlan(plan, undefined, env);
    expect(priceId).toBe("price_stripe_monthly");
    expect(priceId.startsWith("price_")).toBe(true);
  });

  it("yearly plan resolves to yearly price ID", () => {
    const plan = normalizePlan("yearly");
    expect(plan).toBe("year");
    const priceId = getProPriceIdForPlan(plan, undefined, env);
    expect(priceId).toBe("price_stripe_yearly");
    expect(priceId.startsWith("price_")).toBe(true);
  });

  it("normalized month uses STRIPE_PRICE_ID_PRO then PRO_PRICE_ID_MONTHLY", () => {
    expect(getProPriceIdForPlan(normalizePlan("month"), undefined, env)).toBe("price_stripe_monthly");
    const e = { ...env, STRIPE_PRICE_ID_PRO: undefined };
    expect(getProPriceIdForPlan(normalizePlan("month"), undefined, e)).toBe("price_monthly");
  });
});

describe("getProPriceIdForPlan", () => {
  it("returns monthly price for plan month (STRIPE_PRICE_ID_PRO preferred)", () => {
    expect(getProPriceIdForPlan("month", undefined, env)).toBe("price_stripe_monthly");
  });

  it("returns yearly price for plan year", () => {
    expect(getProPriceIdForPlan("year", undefined, env)).toBe("price_stripe_yearly");
  });

  it("falls back to STRIPE_PRICE_ID_PRO when PRO_PRICE_ID_MONTHLY missing", () => {
    const e = { ...env, PRO_PRICE_ID_MONTHLY: undefined };
    expect(getProPriceIdForPlan("month", undefined, e)).toBe("price_stripe_monthly");
  });

  it("falls back to PRO_PRICE_ID_YEARLY when STRIPE_PRICE_ID_PRO_YEAR missing", () => {
    const e = { ...env, STRIPE_PRICE_ID_PRO_YEAR: undefined };
    expect(getProPriceIdForPlan("year", undefined, e)).toBe("price_yearly");
  });

  it("throws when monthly price missing", () => {
    const e = { ...env, PRO_PRICE_ID_MONTHLY: undefined, STRIPE_PRICE_ID_PRO: undefined };
    expect(() => getProPriceIdForPlan("month", undefined, e)).toThrow(
      /Missing STRIPE_PRICE_ID_PRO or PRO_PRICE_ID_MONTHLY/
    );
  });

  it("throws when yearly price missing", () => {
    const e = { ...env, STRIPE_PRICE_ID_PRO_YEAR: undefined, PRO_PRICE_ID_YEARLY: undefined };
    expect(() => getProPriceIdForPlan("year", undefined, e)).toThrow(
      /Missing STRIPE_PRICE_ID_PRO_YEAR/
    );
  });

  it("accepts explicit priceId when in allowed list", () => {
    expect(getProPriceIdForPlan("month", "price_monthly", env)).toBe("price_monthly");
  });

  it("throws Invalid priceId when explicit priceId not in allowed list", () => {
    expect(() => getProPriceIdForPlan("month", "price_unknown", env)).toThrow("Invalid priceId");
  });

  it("accepts explicit priceId when no allowed list configured if it starts with price_", () => {
    const empty = {};
    expect(getProPriceIdForPlan("month", "price_123", empty)).toBe("price_123");
  });

  it("throws when only invalid price IDs (prod_) are set for monthly", () => {
    const e = { PRO_PRICE_ID_MONTHLY: "prod_abc123" };
    expect(() => getProPriceIdForPlan("month", undefined, e)).toThrow(/Missing STRIPE_PRICE_ID_PRO or PRO_PRICE_ID_MONTHLY/);
  });

  it("throws when monthly plan would use yearly price ID (misconfiguration)", () => {
    const e = { STRIPE_PRICE_ID_PRO: "price_same", STRIPE_PRICE_ID_PRO_YEAR: "price_same", PRO_PRICE_ID_MONTHLY: undefined, PRO_PRICE_ID_YEARLY: undefined };
    expect(() => getProPriceIdForPlan("month", undefined, e)).toThrow(/Monthly plan is using the yearly price/);
  });
});
