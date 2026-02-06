"use server";

import type { CheckInData, PreFlightResult } from "@/lib/services/preflight.service";

function legacyCheckInDisabled(): never {
  throw new Error(
    "Legacy check-in system is disabled. Use lib/actions/daily-checkin.ts (DailyCheckIn) instead."
  );
}

// ============================================
// CHECK-IN ACTIONS
// ============================================

export async function getCheckInForWorkout(workoutId: string) {
  legacyCheckInDisabled();
}

export async function submitCheckIn(
  workoutId: string,
  data: CheckInData
): Promise<{
  success: boolean;
  checkIn?: any;
  preFlightResult?: PreFlightResult;
  error?: string;
}> {
  legacyCheckInDisabled();
}

export async function respondToAIDecision(
  checkInId: string,
  accepted: boolean,
  overrideReason?: string
): Promise<{ success: boolean; error?: string }> {
  legacyCheckInDisabled();
}

export async function applyWorkoutAdaptation(
  workoutId: string,
  adaptation: {
    newDurationMin?: number;
    newType?: string;
    intensityReduction?: number;
  }
): Promise<{ success: boolean; error?: string }> {
  throw new Error("Legacy check-in system is disabled.");
}

// ============================================
// HELPER FUNCTIONS
// ============================================

export async function getTodayWorkoutWithCheckIn() {
  legacyCheckInDisabled();
}

export async function getRecentCheckIns(limit = 7) {
  legacyCheckInDisabled();
}
