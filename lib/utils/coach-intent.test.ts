import { describe, it, expect } from "vitest";
import {
  isSendToCalendarIntent,
  getSportIntentFromMessage,
  extractCoachIntent,
  resolveIntentDate,
} from "./coach-intent";

describe("extractCoachIntent", () => {
  it("sets action ADD_TO_CALENDAR for send/add to calendar (EN and PL)", () => {
    expect(extractCoachIntent("send it to calendar").action).toBe("ADD_TO_CALENDAR");
    expect(extractCoachIntent("add to calendar").action).toBe("ADD_TO_CALENDAR");
    expect(extractCoachIntent("dodaj do kalendarza").action).toBe("ADD_TO_CALENDAR");
    expect(extractCoachIntent("dodaj trening pływacki do kalendarza").action).toBe("ADD_TO_CALENDAR");
  });
  it("extracts sport and date for ADD_TO_CALENDAR", () => {
    const i = extractCoachIntent("add swim to calendar");
    expect(i.action).toBe("ADD_TO_CALENDAR");
    expect(i.sport).toBe("SWIM");
    const j = extractCoachIntent("send tomorrow's workout to calendar");
    expect(j.action).toBe("ADD_TO_CALENDAR");
    expect(j.constraints?.date).toBe(resolveIntentDate("tomorrow"));
  });
  it("sets action MODIFY_WORKOUT for change/skróć/zrób zamiast", () => {
    expect(extractCoachIntent("change tomorrow's workout to shorter").action).toBe("MODIFY_WORKOUT");
    expect(extractCoachIntent("zmień jutrzejszy trening").action).toBe("MODIFY_WORKOUT");
    expect(extractCoachIntent("zrób 3000m zamiast 2000").action).toBe("MODIFY_WORKOUT");
  });
  it("sets action CREATE_WORKOUT and constraints for training request", () => {
    const i = extractCoachIntent("rozpisz trening pływacki 3000m");
    expect(i.action).toBe("CREATE_WORKOUT");
    expect(i.sport).toBe("SWIM");
    expect(i.constraints?.distanceM).toBe(3000);
    const j = extractCoachIntent("60 min run today");
    expect(j.action).toBe("CREATE_WORKOUT");
    expect(j.constraints?.durationMin).toBe(60);
    expect(j.constraints?.date).toBe(resolveIntentDate("today"));
  });
  it("sets flags noGoal and injuryOrFatigue", () => {
    expect(extractCoachIntent("I have no goal, slept well").flags?.noGoal).toBe(true);
    expect(extractCoachIntent("kontuzja kolana").flags?.injuryOrFatigue).toBe(true);
  });
});

describe("getSportIntentFromMessage", () => {
  it("extracts SWIM from EN and PL", () => {
    expect(getSportIntentFromMessage("add swim workout to calendar")).toBe("SWIM");
    expect(getSportIntentFromMessage("dodaj trening pływacki do kalendarza")).toBe("SWIM");
    expect(getSportIntentFromMessage("send my pływanie session to calendar")).toBe("SWIM");
  });
  it("extracts BIKE from EN and PL", () => {
    expect(getSportIntentFromMessage("add bike to calendar")).toBe("BIKE");
    expect(getSportIntentFromMessage("dodaj trening rowerowy do kalendarza")).toBe("BIKE");
  });
  it("extracts RUN from EN and PL", () => {
    expect(getSportIntentFromMessage("add run to calendar")).toBe("RUN");
    expect(getSportIntentFromMessage("dodaj bieg do kalendarza")).toBe("RUN");
  });
  it("extracts STRENGTH from EN and PL", () => {
    expect(getSportIntentFromMessage("add strength workout to calendar")).toBe("STRENGTH");
    expect(getSportIntentFromMessage("dodaj trening siłowy do kalendarza")).toBe("STRENGTH");
    expect(getSportIntentFromMessage("add core to calendar")).toBe("STRENGTH");
  });
  it("returns null when no sport mentioned", () => {
    expect(getSportIntentFromMessage("add to calendar")).toBeNull();
    expect(getSportIntentFromMessage("send it to calendar")).toBeNull();
  });
});

describe("isSendToCalendarIntent", () => {
  it("returns true for send/add to calendar phrases", () => {
    expect(isSendToCalendarIntent("send it to calendar")).toBe(true);
    expect(isSendToCalendarIntent("add to calendar")).toBe(true);
    expect(isSendToCalendarIntent("Add it to the calendar")).toBe(true);
  });

  it("returns true for Polish", () => {
    expect(isSendToCalendarIntent("wklej do kalendarza")).toBe(true);
    expect(isSendToCalendarIntent("dodaj do kalendarza")).toBe(true);
    expect(isSendToCalendarIntent("wrzuć do kalendarza")).toBe(true);
    expect(isSendToCalendarIntent("wrzuć do kalendarza aby zapisać")).toBe(true);
    expect(isSendToCalendarIntent("zapisz do kalendarza")).toBe(true);
    expect(isSendToCalendarIntent("zapisać w kalendarz")).toBe(true);
  });

  it("returns false for unrelated messages", () => {
    expect(isSendToCalendarIntent("what's the weather?")).toBe(false);
    expect(isSendToCalendarIntent("generate a swim workout")).toBe(false);
  });
});
