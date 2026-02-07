import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createRequestId, logError } from "./logger";

describe("createRequestId", () => {
  it("returns a UUID v4 format when crypto.randomUUID available", () => {
    const id = createRequestId();
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
  });

  it("returns unique ids", () => {
    const a = createRequestId();
    const b = createRequestId();
    expect(a).not.toBe(b);
  });
});

describe("logError", () => {
  const originalConsoleError = console.error;

  beforeEach(() => {
    console.error = vi.fn();
  });

  afterEach(() => {
    console.error = originalConsoleError;
  });

  it("logs message and context", () => {
    logError("test.error", { foo: "bar" });
    expect(console.error).toHaveBeenCalledTimes(1);
    const arg = (console.error as ReturnType<typeof vi.fn>).mock.calls[0][0];
    const parsed = JSON.parse(arg);
    expect(parsed.level).toBe("error");
    expect(parsed.message).toBe("test.error");
    expect(parsed.foo).toBe("bar");
  });

  it("includes Error message and stack when err is Error", () => {
    const err = new Error("Something went wrong");
    logError("test.error", { requestId: "abc" }, err);
    const arg = (console.error as ReturnType<typeof vi.fn>).mock.calls[0][0];
    const parsed = JSON.parse(arg);
    expect(parsed.errorMessage).toBe("Something went wrong");
    expect(parsed.errorStack).toBeDefined();
    expect(parsed.errorStack).toContain("Something went wrong");
  });

  it("includes string when err is non-Error", () => {
    logError("test.error", {}, "plain string");
    const arg = (console.error as ReturnType<typeof vi.fn>).mock.calls[0][0];
    const parsed = JSON.parse(arg);
    expect(parsed.errorMessage).toBe("plain string");
  });

  it("omits error fields when err is undefined", () => {
    logError("test.error", {});
    const arg = (console.error as ReturnType<typeof vi.fn>).mock.calls[0][0];
    const parsed = JSON.parse(arg);
    expect(parsed.errorMessage).toBeUndefined();
    expect(parsed.errorStack).toBeUndefined();
  });
});
