-- CreateTable
CREATE TABLE "post_workout_feedback" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "workoutId" TEXT NOT NULL,
    "perceivedDifficulty" TEXT NOT NULL,
    "vsPlanned" TEXT NOT NULL,
    "enjoyment" INTEGER NOT NULL,
    "painOrDiscomfort" TEXT,
    "comment" TEXT,
    "visibleToAI" BOOLEAN NOT NULL DEFAULT true,
    "visibleToFuturePlanning" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "post_workout_feedback_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "feedback_aggregations" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "weekStart" DATETIME NOT NULL,
    "weekEnd" DATETIME NOT NULL,
    "totalWorkouts" INTEGER NOT NULL,
    "feedbackCount" INTEGER NOT NULL,
    "avgEnjoyment" REAL,
    "tooHardCount" INTEGER NOT NULL,
    "harderThanPlannedCount" INTEGER NOT NULL,
    "easierThanPlannedCount" INTEGER NOT NULL,
    "painReportedCount" INTEGER NOT NULL,
    "intensityAdjustment" REAL,
    "confidenceImpact" INTEGER,
    "toneAdjustment" TEXT,
    "insightsJson" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "feedback_aggregations_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "post_workout_feedback_workoutId_key" ON "post_workout_feedback"("workoutId");

-- CreateIndex
CREATE INDEX "post_workout_feedback_userId_idx" ON "post_workout_feedback"("userId");

-- CreateIndex
CREATE INDEX "post_workout_feedback_workoutId_idx" ON "post_workout_feedback"("workoutId");

-- CreateIndex
CREATE INDEX "post_workout_feedback_createdAt_idx" ON "post_workout_feedback"("createdAt");

-- CreateIndex
CREATE INDEX "feedback_aggregations_userId_idx" ON "feedback_aggregations"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "feedback_aggregations_userId_weekStart_key" ON "feedback_aggregations"("userId", "weekStart");
