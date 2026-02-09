import { describe, it, expect } from "vitest";
import {
  sanitizeCoachText,
  parseWorkoutFromText,
  parsedWorkoutToPayload,
  type ParsedWorkout,
} from "./workout-parser";

describe("sanitizeCoachText", () => {
  it("removes 'This is because the recent signals' and similar junk", () => {
    const input = `Easy run 45 min. Main set: 30 min steady.
This is because the recent signals and plan summary in your context.
Cool-down 5 min.`;
    const out = sanitizeCoachText(input);
    expect(out).not.toContain("This is because the recent signals");
    expect(out).not.toContain("plan summary in your context");
    expect(out).toContain("Easy run 45 min");
    expect(out).toContain("Main set:");
    expect(out).toContain("Cool-down 5 min");
  });

  it("removes standalone 'This is because...' line", () => {
    const input = `Warm-up 10 min. Main 30 min.
This is because we're building base.
Cool-down 5 min.`;
    const out = sanitizeCoachText(input);
    expect(out).not.toMatch(/This is because/);
    expect(out).toContain("Warm-up");
    expect(out).toContain("Cool-down");
  });

  it("collapses 3+ newlines to 2 and trims line endings", () => {
    const input = "Line one.\n\n\n\nLine two.\n  \n  ";
    const out = sanitizeCoachText(input);
    expect(out).toContain("Line one.");
    expect(out).toContain("Line two.");
    expect(out).not.toMatch(/\n{3,}/);
  });

  it("leaves normal workout content unchanged", () => {
    const input = "3 x 400m, 60 min total, RPE 4. Rest 90s between.";
    expect(sanitizeCoachText(input)).toBe(input);
  });
});

describe("parseWorkoutFromText", () => {
  it("parses CALENDAR BLOCK (--- ... ---)", () => {
    const text = `Here is your session.
---
Title: Easy Run
Sport: RUN
Total: 45 min
Goal: Aerobic base
Warm-up:
- 5 min easy
Main set:
- 30 min steady
Cool-down:
- 10 min walk
---
Add to calendar when ready.`;
    const parsed = parseWorkoutFromText(text);
    expect(parsed).not.toBeNull();
    expect((parsed as ParsedWorkout).title).toBe("Easy Run");
    expect((parsed as ParsedWorkout).sport).toBe("RUN");
    expect((parsed as ParsedWorkout).totalMinutes).toBe(45);
    expect((parsed as ParsedWorkout).descriptionMarkdown).toContain("Warm-up");
    expect((parsed as ParsedWorkout).descriptionMarkdown).toContain("Main set");
    expect((parsed as ParsedWorkout).date).toBeDefined();
  });

  it("parses labeled format (TITLE / SPORT / TOTAL TIME / MAIN SET)", () => {
    const text = `TITLE: Tempo Run
SPORT: RUN
TOTAL TIME: 50 min

WARM-UP:
10 min easy

MAIN SET:
4 x 5 min at threshold, 2 min jog rest

COOL-DOWN:
10 min easy`;
    const parsed = parseWorkoutFromText(text);
    expect(parsed).not.toBeNull();
    expect((parsed as ParsedWorkout).title).toBe("Tempo Run");
    expect((parsed as ParsedWorkout).sport).toBe("RUN");
    expect((parsed as ParsedWorkout).totalMinutes).toBe(50);
  });

  it("parses labeled format with TRENING 1: PUSH and SPORT: Strength", () => {
    const text = `**TRENING 1: PUSH (Poniedziałek)**
SPORT: Strength
TOTAL TIME: 60 min

Goal: Upper push.`;
    const parsed = parseWorkoutFromText(text);
    expect(parsed).not.toBeNull();
    expect((parsed as ParsedWorkout).sport).toBe("STRENGTH");
    expect((parsed as ParsedWorkout).totalMinutes).toBe(60);
    expect((parsed as ParsedWorkout).title).toContain("PUSH");
  });

  it("parses heuristic format (sport keyword + numeric markers)", () => {
    const text = "3 x 400m, 60 min total, RPE 4. Rest 90s between. Swim technique focus.";
    const parsed = parseWorkoutFromText(text);
    expect(parsed).not.toBeNull();
    expect((parsed as ParsedWorkout).sport).toBe("SWIM");
    expect((parsed as ParsedWorkout).totalMinutes).toBe(60);
    expect((parsed as ParsedWorkout).title).toBe("Swim Session");
  });

  it("parses heuristic with bike and distance", () => {
    const text = "Bike 90 min, 2x20 min sweet spot. 35 km total.";
    const parsed = parseWorkoutFromText(text);
    expect(parsed).not.toBeNull();
    expect((parsed as ParsedWorkout).sport).toBe("BIKE");
    expect((parsed as ParsedWorkout).totalMinutes).toBe(90);
  });

  it("returns null when no sport or numeric marker", () => {
    expect(parseWorkoutFromText("How are you feeling today?")).toBeNull();
    expect(parseWorkoutFromText("Tell me your goal.")).toBeNull();
  });

  it("sanitizes before parsing (junk removed then parse succeeds)", () => {
    const text = `TITLE: Easy Run
SPORT: RUN
TOTAL TIME: 45 min
Main set 30 min.
This is because the recent signals and plan summary in your context.`;
    const parsed = parseWorkoutFromText(text);
    expect(parsed).not.toBeNull();
    expect((parsed as ParsedWorkout).descriptionMarkdown).not.toContain("This is because");
  });
});

describe("parsedWorkoutToPayload", () => {
  it("produces valid CalendarInsertPayload with one item", () => {
    const parsed: ParsedWorkout = {
      title: "Swim Session",
      sport: "SWIM",
      totalMinutes: 60,
      descriptionMarkdown: "Warm-up 200m. Main 8x50m. Cool-down 200m.",
      date: "2026-02-10",
    };
    const payload = parsedWorkoutToPayload(parsed);
    expect(payload.calendarInsert).toBe(true);
    expect(payload.mode).toBe("final");
    expect(payload.items).toHaveLength(1);
    expect(payload.items[0].date).toBe("2026-02-10");
    expect(payload.items[0].sport).toBe("SWIM");
    expect(payload.items[0].title).toBe("Swim Session");
    expect(payload.items[0].durationMin).toBe(60);
    expect(payload.items[0].descriptionMd).toContain("8x50m");
  });

  it("sets totalDistanceMeters for SWIM from intervals in description (6x500m = 3000m)", () => {
    const parsed: ParsedWorkout = {
      title: "Swim 3000m",
      sport: "SWIM",
      totalMinutes: 75,
      descriptionMarkdown: "Main set: 6x500m. Rest 30s.",
      date: "2026-02-10",
    };
    const payload = parsedWorkoutToPayload(parsed);
    expect(payload.items[0].totalDistanceMeters).toBe(3000);
  });
});

describe("parseWorkoutFromText swim total meters", () => {
  it("parses 3000m swim with intervals and payload has totalDistanceMeters 3000", () => {
    const text = `TITLE: Swim session
SPORT: SWIM
TOTAL TIME: 75 min
Main set: 6x500m. Rest 30s.`;
    const parsed = parseWorkoutFromText(text);
    expect(parsed).not.toBeNull();
    expect((parsed as ParsedWorkout).sport).toBe("SWIM");
    const payload = parsedWorkoutToPayload(parsed as ParsedWorkout);
    expect(payload.items[0].totalDistanceMeters).toBe(3000); // 6*500 = 3000
  });
});

describe("parseWorkoutFromText strength includes CORE", () => {
  it("parses strength workout with CORE section", () => {
    const text = `**TRENING: STRENGTH**
SPORT: STRENGTH
TOTAL TIME: 60 min
Warm-up 10 min. Main: 3x10 push-ups. CORE: 12 min planks and dead bug. Cool-down 5 min.`;
    const parsed = parseWorkoutFromText(text);
    expect(parsed).not.toBeNull();
    expect((parsed as ParsedWorkout).sport).toBe("STRENGTH");
    expect((parsed as ParsedWorkout).descriptionMarkdown).toMatch(/CORE/i);
  });

  it("strength calendar block -> add-to-calendar payload (title, sport STRENGTH, totalTime, sections)", () => {
    const text = `---
Title: Strength for Runners (45 min)
Sport: STRENGTH
Total: 45 min

Warm-up:
- 5 min light cardio
- Joint circles

Main set:
- Split squat 3×8 each, RPE 6–7
- Core block 10 min

Cool-down:
- Stretch

Targets:
- RPE 6–7
---
`;
    const parsed = parseWorkoutFromText(text);
    expect(parsed).not.toBeNull();
    expect((parsed as ParsedWorkout).sport).toBe("STRENGTH");
    expect((parsed as ParsedWorkout).totalMinutes).toBe(45);
    expect((parsed as ParsedWorkout).title).toMatch(/Strength/);
    const payload = parsedWorkoutToPayload(parsed as ParsedWorkout);
    expect(payload.items).toHaveLength(1);
    expect(payload.items[0].sport).toBe("STRENGTH");
    expect(payload.items[0].durationMin).toBe(45);
    expect(payload.items[0].descriptionMd).toMatch(/Warm-up|Main|Core|Cool-down/i);
  });
});
