import { describe, it, expect } from "vitest";
import { isProSubscriptionStatus } from "./entitlements-utils";

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
