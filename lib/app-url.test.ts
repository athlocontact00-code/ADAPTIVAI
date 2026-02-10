import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { getAppUrl, BILLING_SETTINGS_PATH } from "./app-url";

describe("getAppUrl", () => {
  const origEnv = process.env;

  beforeEach(() => {
    process.env = { ...origEnv };
  });

  afterEach(() => {
    process.env = origEnv;
  });

  it("returns APP_URL when set", () => {
    process.env.APP_URL = "https://www.adaptivai.online";
    process.env.NEXTAUTH_URL = "https://other.example.com";
    expect(getAppUrl()).toBe("https://www.adaptivai.online");
  });

  it("returns NEXTAUTH_URL when APP_URL is not set", () => {
    delete process.env.APP_URL;
    process.env.NEXTAUTH_URL = "https://www.adaptivai.online";
    expect(getAppUrl()).toBe("https://www.adaptivai.online");
  });

  it("falls back to localhost when neither APP_URL nor NEXTAUTH_URL is set", () => {
    delete process.env.APP_URL;
    delete process.env.NEXTAUTH_URL;
    expect(getAppUrl()).toBe("http://localhost:3000");
  });

  it("strips trailing slash from URL", () => {
    process.env.APP_URL = "https://www.adaptivai.online/";
    expect(getAppUrl()).toBe("https://www.adaptivai.online");
  });
});

describe("billing redirect URL building", () => {
  const origEnv = process.env;

  beforeEach(() => {
    process.env = { ...origEnv };
  });

  afterEach(() => {
    process.env = origEnv;
  });

  it("BILLING_SETTINGS_PATH is the settings billing tab", () => {
    expect(BILLING_SETTINGS_PATH).toBe("/settings?tab=billing");
  });

  it("built success_url includes canonical base and billing path", () => {
    process.env.APP_URL = "https://www.adaptivai.online";
    const base = getAppUrl();
    const successUrl = `${base}${BILLING_SETTINGS_PATH}&success=1&session_id={CHECKOUT_SESSION_ID}`;
    expect(successUrl).toContain("https://www.adaptivai.online");
    expect(successUrl).toContain("/settings?tab=billing");
    expect(successUrl).toContain("success=1");
    expect(successUrl).toContain("session_id={CHECKOUT_SESSION_ID}");
  });

  it("built URLs do not use vercel preview URLs when APP_URL is canonical", () => {
    process.env.APP_URL = "https://www.adaptivai.online";
    const base = getAppUrl();
    expect(base).not.toContain("vercel.app");
    const cancelUrl = `${base}${BILLING_SETTINGS_PATH}&canceled=1`;
    expect(cancelUrl).not.toContain("vercel.app");
  });
});
