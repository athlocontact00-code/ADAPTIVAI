/*
  Warnings:

  - A unique constraint covering the columns `[stripeCustomerId]` on the table `users` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "ai_warnings_workoutId_idx";

-- AlterTable
ALTER TABLE "users" ADD COLUMN "stripeCustomerId" TEXT;

-- CreateTable
CREATE TABLE "subscriptions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "plan" TEXT NOT NULL DEFAULT 'pro',
    "status" TEXT NOT NULL DEFAULT 'incomplete',
    "stripeCustomerId" TEXT NOT NULL,
    "stripeSubscriptionId" TEXT NOT NULL,
    "stripePriceId" TEXT,
    "stripeProductId" TEXT,
    "currentPeriodStart" DATETIME,
    "currentPeriodEnd" DATETIME,
    "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false,
    "canceledAt" DATETIME,
    "endedAt" DATETIME,
    "trialEnd" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "subscriptions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "stripe_events" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "stripeEventId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "livemode" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" DATETIME
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_daily_checkins" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "workoutId" TEXT,
    "sleepDuration" REAL NOT NULL,
    "sleepQuality" INTEGER NOT NULL,
    "physicalFatigue" INTEGER NOT NULL,
    "mentalReadiness" INTEGER NOT NULL,
    "motivation" INTEGER NOT NULL,
    "muscleSoreness" TEXT NOT NULL DEFAULT 'NONE',
    "stressLevel" INTEGER NOT NULL,
    "notes" TEXT,
    "mood" INTEGER,
    "energy" INTEGER,
    "sorenessAreasJson" TEXT,
    "readinessScore" INTEGER,
    "aiDecision" TEXT,
    "aiReasonJson" TEXT,
    "aiConfidence" INTEGER,
    "aiExplanation" TEXT,
    "originalWorkoutJson" TEXT,
    "userAccepted" BOOLEAN,
    "userOverrideReason" TEXT,
    "lockedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "daily_checkins_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_daily_checkins" ("aiConfidence", "aiDecision", "aiExplanation", "aiReasonJson", "createdAt", "date", "energy", "id", "lockedAt", "mentalReadiness", "mood", "motivation", "muscleSoreness", "notes", "originalWorkoutJson", "physicalFatigue", "readinessScore", "sleepDuration", "sleepQuality", "sorenessAreasJson", "stressLevel", "updatedAt", "userAccepted", "userId", "userOverrideReason", "workoutId") SELECT "aiConfidence", "aiDecision", "aiExplanation", "aiReasonJson", "createdAt", "date", "energy", "id", "lockedAt", "mentalReadiness", "mood", "motivation", "muscleSoreness", "notes", "originalWorkoutJson", "physicalFatigue", "readinessScore", "sleepDuration", "sleepQuality", "sorenessAreasJson", "stressLevel", "updatedAt", "userAccepted", "userId", "userOverrideReason", "workoutId" FROM "daily_checkins";
DROP TABLE "daily_checkins";
ALTER TABLE "new_daily_checkins" RENAME TO "daily_checkins";
CREATE INDEX "daily_checkins_userId_idx" ON "daily_checkins"("userId");
CREATE INDEX "daily_checkins_date_idx" ON "daily_checkins"("date");
CREATE UNIQUE INDEX "daily_checkins_userId_date_key" ON "daily_checkins"("userId", "date");
CREATE TABLE "new_post_workout_feedback" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "workoutId" TEXT NOT NULL,
    "perceivedDifficulty" TEXT NOT NULL,
    "vsPlanned" TEXT NOT NULL,
    "enjoyment" INTEGER NOT NULL,
    "discomfort" TEXT NOT NULL DEFAULT 'NONE',
    "mentalState" INTEGER NOT NULL DEFAULT 3,
    "painOrDiscomfort" TEXT,
    "comment" TEXT,
    "visibleToAI" BOOLEAN NOT NULL DEFAULT true,
    "visibleToFuturePlanning" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "post_workout_feedback_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "post_workout_feedback_workoutId_fkey" FOREIGN KEY ("workoutId") REFERENCES "workouts" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_post_workout_feedback" ("comment", "createdAt", "discomfort", "enjoyment", "id", "mentalState", "painOrDiscomfort", "perceivedDifficulty", "updatedAt", "userId", "visibleToAI", "visibleToFuturePlanning", "vsPlanned", "workoutId") SELECT "comment", "createdAt", "discomfort", "enjoyment", "id", "mentalState", "painOrDiscomfort", "perceivedDifficulty", "updatedAt", "userId", "visibleToAI", "visibleToFuturePlanning", "vsPlanned", "workoutId" FROM "post_workout_feedback";
DROP TABLE "post_workout_feedback";
ALTER TABLE "new_post_workout_feedback" RENAME TO "post_workout_feedback";
CREATE UNIQUE INDEX "post_workout_feedback_workoutId_key" ON "post_workout_feedback"("workoutId");
CREATE INDEX "post_workout_feedback_userId_idx" ON "post_workout_feedback"("userId");
CREATE INDEX "post_workout_feedback_workoutId_idx" ON "post_workout_feedback"("workoutId");
CREATE INDEX "post_workout_feedback_createdAt_idx" ON "post_workout_feedback"("createdAt");
CREATE TABLE "new_profiles" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "birthDate" DATETIME,
    "weight" REAL,
    "height" REAL,
    "restingHR" INTEGER,
    "maxHR" INTEGER,
    "ftp" INTEGER,
    "weeklyHoursGoal" REAL,
    "sportPrimary" TEXT,
    "experienceLevel" TEXT,
    "zone1Min" INTEGER,
    "zone1Max" INTEGER,
    "zone2Min" INTEGER,
    "zone2Max" INTEGER,
    "zone3Min" INTEGER,
    "zone3Max" INTEGER,
    "zone4Min" INTEGER,
    "zone4Max" INTEGER,
    "zone5Min" INTEGER,
    "zone5Max" INTEGER,
    "planRigidity" TEXT NOT NULL DEFAULT 'LOCKED_1_DAY',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "profiles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_profiles" ("birthDate", "createdAt", "experienceLevel", "ftp", "height", "id", "maxHR", "restingHR", "sportPrimary", "updatedAt", "userId", "weeklyHoursGoal", "weight", "zone1Max", "zone1Min", "zone2Max", "zone2Min", "zone3Max", "zone3Min", "zone4Max", "zone4Min", "zone5Max", "zone5Min") SELECT "birthDate", "createdAt", "experienceLevel", "ftp", "height", "id", "maxHR", "restingHR", "sportPrimary", "updatedAt", "userId", "weeklyHoursGoal", "weight", "zone1Max", "zone1Min", "zone2Max", "zone2Min", "zone3Max", "zone3Min", "zone4Max", "zone4Min", "zone5Max", "zone5Min" FROM "profiles";
DROP TABLE "profiles";
ALTER TABLE "new_profiles" RENAME TO "profiles";
CREATE UNIQUE INDEX "profiles_userId_key" ON "profiles"("userId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "subscriptions_stripeSubscriptionId_key" ON "subscriptions"("stripeSubscriptionId");

-- CreateIndex
CREATE INDEX "subscriptions_userId_idx" ON "subscriptions"("userId");

-- CreateIndex
CREATE INDEX "subscriptions_status_idx" ON "subscriptions"("status");

-- CreateIndex
CREATE UNIQUE INDEX "stripe_events_stripeEventId_key" ON "stripe_events"("stripeEventId");

-- CreateIndex
CREATE INDEX "stripe_events_type_idx" ON "stripe_events"("type");

-- CreateIndex
CREATE UNIQUE INDEX "users_stripeCustomerId_key" ON "users"("stripeCustomerId");
