import { describe, it, expect } from "vitest";
import { getProPriceIdForPlan } from "./checkout-prices";

const env = {
  PRO_PRICE_ID_MONTHLY: "price_monthly",
  PRO_PRICE_ID_YEARLY: "price_yearly",
  STRIPE_PRICE_ID_PRO: "price_stripe_monthly",
  STRIPE_PRICE_ID_PRO_YEAR: "price_stripe_yearly",
};

describe("getProPriceIdForPlan", () => {
  it("returns monthly price for plan month", () => {
    expect(getProPriceIdForPlan("month", undefined, env)).toBe("price_monthly");
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
      /Missing PRO_PRICE_ID_MONTHLY or STRIPE_PRICE_ID_PRO/
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

  it("accepts explicit priceId when no allowed list configured", () => {
    const empty = {};
    expect(getProPriceIdForPlan("month", "any_price", empty)).toBe("any_price");
  });
});
