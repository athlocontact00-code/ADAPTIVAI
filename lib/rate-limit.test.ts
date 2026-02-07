import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { rateLimit, getClientIp } from "./rate-limit";

describe("rateLimit", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("allows first request within limit", () => {
    const result = rateLimit({
      key: "test-key-1",
      limit: 5,
      windowMs: 60_000,
    });
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(4);
    expect(result.resetAt).toBeGreaterThan(Date.now());
  });

  it("allows requests within limit", () => {
    const key = "test-key-2";
    for (let i = 0; i < 3; i++) {
      const result = rateLimit({ key, limit: 5, windowMs: 60_000 });
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(4 - i);
    }
  });

  it("denies when limit exceeded", () => {
    const key = "test-key-3";
    for (let i = 0; i < 5; i++) {
      rateLimit({ key, limit: 5, windowMs: 60_000 });
    }
    const result = rateLimit({ key, limit: 5, windowMs: 60_000 });
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
  });

  it("resets after window expires", () => {
    const key = "test-key-4";
    rateLimit({ key, limit: 2, windowMs: 60_000 });
    rateLimit({ key, limit: 2, windowMs: 60_000 }); // at limit
    const denied = rateLimit({ key, limit: 2, windowMs: 60_000 });
    expect(denied.allowed).toBe(false);

    vi.advanceTimersByTime(61_000); // past window
    const allowed = rateLimit({ key, limit: 2, windowMs: 60_000 });
    expect(allowed.allowed).toBe(true);
    expect(allowed.remaining).toBe(1);
  });
});

describe("getClientIp", () => {
  it("returns first x-forwarded-for when present", () => {
    const req = new Request("https://example.com", {
      headers: { "x-forwarded-for": "1.2.3.4, 5.6.7.8" },
    });
    expect(getClientIp(req)).toBe("1.2.3.4");
  });

  it("returns x-real-ip when x-forwarded-for absent", () => {
    const req = new Request("https://example.com", {
      headers: { "x-real-ip": "9.9.9.9" },
    });
    expect(getClientIp(req)).toBe("9.9.9.9");
  });

  it("returns unknown when no IP headers", () => {
    const req = new Request("https://example.com");
    expect(getClientIp(req)).toBe("unknown");
  });
});
