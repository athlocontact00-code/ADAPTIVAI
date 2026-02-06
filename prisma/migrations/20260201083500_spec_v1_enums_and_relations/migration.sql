-- ============================================
-- Migration: spec_v1_enums_and_relations
-- Purpose: Add Prisma enums and relations for Spec v1.0
-- 
-- IMPORTANT: This migration includes orphan cleanup
-- to prevent FK constraint failures.
-- ============================================

-- ============================================
-- STEP 1: ORPHAN CLEANUP (SAFETY)
-- Delete PostWorkoutFeedback rows with invalid workoutId
-- ============================================

DELETE FROM "post_workout_feedback" 
WHERE "workoutId" NOT IN (SELECT "id" FROM "workouts");

-- ============================================
-- STEP 2: ADD NEW COLUMNS TO ai_memories
-- ============================================

-- Add memoryLayer column (SQLite stores enums as TEXT)
ALTER TABLE "ai_memories" ADD COLUMN "memoryLayer" TEXT NOT NULL DEFAULT 'SHORT_TERM';

-- Add sourceIdsJson column for source references
ALTER TABLE "ai_memories" ADD COLUMN "sourceIdsJson" TEXT;

-- Add expiresAt column for decay logic
ALTER TABLE "ai_memories" ADD COLUMN "expiresAt" DATETIME;

-- ============================================
-- STEP 3: CREATE INDEXES FOR ai_memories
-- ============================================

CREATE INDEX "ai_memories_memoryLayer_idx" ON "ai_memories"("memoryLayer");
CREATE INDEX "ai_memories_expiresAt_idx" ON "ai_memories"("expiresAt");
CREATE INDEX "ai_memories_userId_memoryLayer_idx" ON "ai_memories"("userId", "memoryLayer");
CREATE INDEX "ai_memories_userId_memoryType_idx" ON "ai_memories"("userId", "memoryType");

-- ============================================
-- STEP 4: ADD workoutId COLUMN TO ai_warnings
-- (if not exists - for workout relation)
-- ============================================

-- Ensure ai_warnings exists so this migration can apply cleanly to a fresh shadow database.
-- (In some environments ai_warnings may be introduced later; this stub is replaced in STEP 6.)
CREATE TABLE IF NOT EXISTS "ai_warnings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "scenarioId" TEXT,
    "warningType" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "triggerMetricJson" TEXT,
    "targetDate" DATETIME,
    "workoutId" TEXT,
    "acknowledged" BOOLEAN NOT NULL DEFAULT false,
    "acknowledgedAt" DATETIME,
    "dismissed" BOOLEAN NOT NULL DEFAULT false,
    "dismissedAt" DATETIME,
    "confidence" INTEGER NOT NULL DEFAULT 70,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" DATETIME
);

-- Check if ai_warnings table exists and add workoutId if needed
-- SQLite doesn't support IF NOT EXISTS for columns, so we use a safe approach

-- ============================================
-- STEP 5: RECREATE post_workout_feedback WITH FK CONSTRAINT
-- This enforces the 1:1 relation with Workout
-- ============================================

PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;

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
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "post_workout_feedback_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "post_workout_feedback_workoutId_fkey" FOREIGN KEY ("workoutId") REFERENCES "workouts" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

INSERT INTO "new_post_workout_feedback" (
    "id", "userId", "workoutId", "perceivedDifficulty", "vsPlanned",
    "enjoyment", "discomfort", "mentalState", "painOrDiscomfort",
    "comment", "visibleToAI", "visibleToFuturePlanning", "updatedAt", "createdAt"
)
SELECT 
    "id", "userId", "workoutId", "perceivedDifficulty", "vsPlanned",
    "enjoyment", "discomfort", "mentalState", "painOrDiscomfort",
    "comment", "visibleToAI", "visibleToFuturePlanning", "updatedAt", "createdAt"
FROM "post_workout_feedback"
WHERE "workoutId" IN (SELECT "id" FROM "workouts");

DROP TABLE "post_workout_feedback";
ALTER TABLE "new_post_workout_feedback" RENAME TO "post_workout_feedback";

CREATE UNIQUE INDEX "post_workout_feedback_workoutId_key" ON "post_workout_feedback"("workoutId");
CREATE INDEX "post_workout_feedback_userId_idx" ON "post_workout_feedback"("userId");
CREATE INDEX "post_workout_feedback_workoutId_idx" ON "post_workout_feedback"("workoutId");
CREATE INDEX "post_workout_feedback_createdAt_idx" ON "post_workout_feedback"("createdAt");

PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- ============================================
-- STEP 6: UPDATE ai_warnings TABLE
-- Add workout relation
-- ============================================

PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;

CREATE TABLE "new_ai_warnings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "scenarioId" TEXT,
    "warningType" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "triggerMetricJson" TEXT,
    "targetDate" DATETIME,
    "workoutId" TEXT,
    "acknowledged" BOOLEAN NOT NULL DEFAULT false,
    "acknowledgedAt" DATETIME,
    "dismissed" BOOLEAN NOT NULL DEFAULT false,
    "dismissedAt" DATETIME,
    "confidence" INTEGER NOT NULL DEFAULT 70,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" DATETIME,
    CONSTRAINT "ai_warnings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ai_warnings_scenarioId_fkey" FOREIGN KEY ("scenarioId") REFERENCES "simulation_scenarios" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ai_warnings_workoutId_fkey" FOREIGN KEY ("workoutId") REFERENCES "workouts" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

INSERT INTO "new_ai_warnings" (
    "id", "userId", "scenarioId", "warningType", "severity", "title", "message",
    "triggerMetricJson", "targetDate", "workoutId", "acknowledged", "acknowledgedAt",
    "dismissed", "dismissedAt", "confidence", "createdAt", "expiresAt"
)
SELECT 
    "id", "userId", "scenarioId", "warningType", "severity", "title", "message",
    "triggerMetricJson", "targetDate", "workoutId", "acknowledged", "acknowledgedAt",
    "dismissed", "dismissedAt", "confidence", "createdAt", "expiresAt"
FROM "ai_warnings";

DROP TABLE "ai_warnings";
ALTER TABLE "new_ai_warnings" RENAME TO "ai_warnings";

CREATE INDEX "ai_warnings_userId_idx" ON "ai_warnings"("userId");
CREATE INDEX "ai_warnings_scenarioId_idx" ON "ai_warnings"("scenarioId");
CREATE INDEX "ai_warnings_warningType_idx" ON "ai_warnings"("warningType");
CREATE INDEX "ai_warnings_targetDate_idx" ON "ai_warnings"("targetDate");
CREATE INDEX "ai_warnings_workoutId_idx" ON "ai_warnings"("workoutId");

PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- ============================================
-- NOTES:
-- 
-- Enum values are stored as TEXT in SQLite.
-- Prisma validates enum values at the application layer.
-- 
-- Default values applied:
-- - User.tonePreference: 'SUPPORTIVE' (already in schema)
-- - Profile.planRigidity: 'LOCKED_1_DAY' (already in schema)
-- - AIMemory.memoryLayer: 'SHORT_TERM' (added above)
-- - DailyCheckIn.muscleSoreness: 'NONE' (already in schema)
-- - PostWorkoutFeedback.discomfort: 'NONE' (already in schema)
-- ============================================
