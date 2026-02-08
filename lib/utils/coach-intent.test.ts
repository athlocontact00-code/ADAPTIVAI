import { describe, it, expect } from "vitest";
import { isSendToCalendarIntent } from "./coach-intent";

describe("isSendToCalendarIntent", () => {
  it("returns true for send/add to calendar phrases", () => {
    expect(isSendToCalendarIntent("send it to calendar")).toBe(true);
    expect(isSendToCalendarIntent("add to calendar")).toBe(true);
    expect(isSendToCalendarIntent("Add it to the calendar")).toBe(true);
  });

  it("returns true for Polish", () => {
    expect(isSendToCalendarIntent("wklej do kalendarza")).toBe(true);
    expect(isSendToCalendarIntent("dodaj do kalendarza")).toBe(true);
  });

  it("returns false for unrelated messages", () => {
    expect(isSendToCalendarIntent("what's the weather?")).toBe(false);
    expect(isSendToCalendarIntent("generate a swim workout")).toBe(false);
  });
});
