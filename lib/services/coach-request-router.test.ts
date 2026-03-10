import { describe, expect, it } from "vitest";

import {
  classifyCoachRequestRoute,
  isAddWorkoutRequest,
  isSevenDayPlanRequest,
  isTodayWorkoutsRequest,
} from "./coach-request-router";

describe("isAddWorkoutRequest", () => {
  it("detects add workout requests with sport or workout noun", () => {
    expect(isAddWorkoutRequest("Add a swim workout for tomorrow")).toBe(true);
    expect(isAddWorkoutRequest("Dodaj trening biegowy")).toBe(true);
  });

  it("ignores vague add requests without workout signal", () => {
    expect(isAddWorkoutRequest("Add this")).toBe(false);
  });
});

describe("isSevenDayPlanRequest", () => {
  it("detects 7 day plan requests", () => {
    expect(isSevenDayPlanRequest("Generate a 7 day plan")).toBe(true);
    expect(isSevenDayPlanRequest("build seven day training plan")).toBe(true);
  });
});

describe("isTodayWorkoutsRequest", () => {
  it("detects list today's workouts intent", () => {
    expect(isTodayWorkoutsRequest("What workouts do I have today?")).toBe(true);
    expect(isTodayWorkoutsRequest("co mam dzisiaj")).toBe(true);
  });

  it("does not treat generation requests as today's workouts listing", () => {
    expect(isTodayWorkoutsRequest("Write me a workout for today")).toBe(false);
  });
});

describe("classifyCoachRequestRoute", () => {
  it("routes add-to-calendar immediately", () => {
    expect(classifyCoachRequestRoute("add to calendar", "ADD_TO_CALENDAR")).toEqual({
      immediateRoute: "ADD_TO_CALENDAR",
      preferBrain: false,
      fallbackRoute: "LLM_CHAT",
    });
  });

  it("prefers brain for generative requests and keeps manual-add fallback", () => {
    expect(classifyCoachRequestRoute("Add a swim workout for tomorrow", "GENERATE")).toEqual({
      immediateRoute: null,
      preferBrain: true,
      fallbackRoute: "MANUAL_ADD_WORKOUT",
    });
  });

  it("routes question-only requests to lightweight fallbacks", () => {
    expect(classifyCoachRequestRoute("What workouts do I have today?", "QUESTION_ONLY")).toEqual({
      immediateRoute: null,
      preferBrain: false,
      fallbackRoute: "TODAY_WORKOUTS",
    });
  });

  it("routes seven-day plan questions correctly", () => {
    expect(classifyCoachRequestRoute("Generate a 7 day plan", "QUESTION_ONLY")).toEqual({
      immediateRoute: null,
      preferBrain: false,
      fallbackRoute: "SEVEN_DAY_PLAN",
    });
  });
});
