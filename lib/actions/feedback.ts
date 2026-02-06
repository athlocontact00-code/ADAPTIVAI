"use server";

function legacyFeedbackDisabled(): never {
  throw new Error(
    "Legacy feedback system is disabled. Use lib/actions/workout-feedback.ts instead."
  );
}

// ============================================
// FEEDBACK ACTIONS
// ============================================

export async function getFeedbackForWorkout(workoutId: string) {
  legacyFeedbackDisabled();
}

export async function submitFeedback(
  workoutId: string,
  data: {
    perceivedDifficulty: string;
    vsPlanned: string;
    enjoyment: number;
    painOrDiscomfort?: string;
    comment?: string;
    visibleToAI?: boolean;
    visibleToFuturePlanning?: boolean;
  }
): Promise<{ success: boolean; feedback?: any; error?: string }> {
  legacyFeedbackDisabled();
}

export async function updateFeedbackVisibility(
  feedbackId: string,
  visibleToAI: boolean,
  visibleToFuturePlanning: boolean
): Promise<{ success: boolean; error?: string }> {
  legacyFeedbackDisabled();
}

// ============================================
// AGGREGATION ACTIONS
// ============================================

export async function aggregateWeeklyFeedback(weekStartDate?: Date) {
  legacyFeedbackDisabled();
}

export async function getLatestAggregation() {
  legacyFeedbackDisabled();
}

export async function getRecentFeedback(limit = 10) {
  legacyFeedbackDisabled();
}

// ============================================
// AI CONTEXT HELPERS
// ============================================

export async function getFeedbackContextForAI() {
  legacyFeedbackDisabled();
}

export async function getWorkoutFeedbackHistory(workoutId: string) {
  legacyFeedbackDisabled();
}
