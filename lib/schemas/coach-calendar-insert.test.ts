import { describe, it, expect } from "vitest";
import { parseCalendarInsertFromResponse } from "./coach-calendar-insert";

describe("parseCalendarInsertFromResponse", () => {
  it("extracts payload from <WORKOUT_JSON>...</WORKOUT_JSON> marker", () => {
    const message = `Here is your session.
<WORKOUT_JSON>
{"title":"Easy Run","sport":"RUN","date":"2026-02-10","totalMinutes":45,"descriptionMarkdown":"Warm-up 10 min, main 30 min, cool-down 5 min."}
</WORKOUT_JSON>
Add it to your calendar when ready.`;
    const payload = parseCalendarInsertFromResponse(message);
    expect(payload).not.toBeNull();
    expect(payload?.calendarInsert).toBe(true);
    expect(payload?.mode).toBe("final");
    expect(payload?.items).toHaveLength(1);
    expect(payload?.items[0].title).toBe("Easy Run");
    expect(payload?.items[0].sport).toBe("RUN");
    expect(payload?.items[0].date).toBe("2026-02-10");
    expect(payload?.items[0].durationMin).toBe(45);
    expect(payload?.items[0].descriptionMd).toContain("Warm-up");
  });

  it("extracts from WORKOUT_JSON with minimal fields (defaults duration and description)", () => {
    const message = `Before text
<WORKOUT_JSON>
{"title":"Swim Technique","sport":"SWIM","date":"2026-02-11"}
</WORKOUT_JSON>
After text`;
    const payload = parseCalendarInsertFromResponse(message);
    expect(payload).not.toBeNull();
    expect(payload?.items[0].title).toBe("Swim Technique");
    expect(payload?.items[0].sport).toBe("SWIM");
    expect(payload?.items[0].date).toBe("2026-02-11");
    expect(payload?.items[0].durationMin).toBe(60);
    expect(payload?.items[0].descriptionMd).toBe("Swim Technique");
  });

  it("extracts from fenced json block (calendarInsert format)", () => {
    const message = `Session below.
\`\`\`json
{"calendarInsert":true,"mode":"final","items":[{"date":"2026-02-10","sport":"RUN","title":"Easy Run","durationMin":45,"descriptionMd":"Easy run"}]}
\`\`\``;
    const payload = parseCalendarInsertFromResponse(message);
    expect(payload).not.toBeNull();
    expect(payload?.items[0].title).toBe("Easy Run");
    expect(payload?.items[0].date).toBe("2026-02-10");
  });

  it("returns null when no extractable block", () => {
    expect(parseCalendarInsertFromResponse("Just some text.")).toBeNull();
    expect(parseCalendarInsertFromResponse("Tell me your goal.")).toBeNull();
  });

  it("extracts workout from coach-style response (fallback path: generate then add to calendar)", () => {
    const coachResponse = `Session intent: aerobic base.

**TITLE:** Easy Run
**SPORT:** Run
**TOTAL TIME:** 45 min
...

\`\`\`json
{"calendarInsert":true,"mode":"final","items":[{"date":"2026-02-10","sport":"RUN","title":"Easy Run","durationMin":45,"descriptionMd":"Warm-up 10 min, main 25 min, cool-down 10 min."}]}
\`\`\`
Calendar insert ready.`;
    const payload = parseCalendarInsertFromResponse(coachResponse);
    expect(payload).not.toBeNull();
    expect(payload?.items).toHaveLength(1);
    expect(payload?.items[0].title).toBe("Easy Run");
    expect(payload?.items[0].date).toBe("2026-02-10");
  });
});
