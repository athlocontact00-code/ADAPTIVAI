/*
  Warnings:

  - You are about to drop the column `aiAccessLevel` on the `diary_entries` table. All the data in the column will be lost.

*/
-- CreateTable
CREATE TABLE "ai_memories" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "memoryType" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "confidence" INTEGER NOT NULL DEFAULT 50,
    "dataPoints" INTEGER NOT NULL DEFAULT 0,
    "profileDataJson" TEXT,
    "periodStart" DATETIME NOT NULL,
    "periodEnd" DATETIME NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "supersededBy" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ai_memories_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ai_memory_audits" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "memoryType" TEXT,
    "details" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ai_memory_audits_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_diary_entries" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "mood" INTEGER,
    "energy" INTEGER,
    "sleepHrs" REAL,
    "sleepQual" INTEGER,
    "stress" INTEGER,
    "soreness" INTEGER,
    "motivation" INTEGER,
    "notes" TEXT,
    "workoutId" TEXT,
    "visibilityLevel" TEXT NOT NULL DEFAULT 'FULL_AI_ACCESS',
    "aiUsedForTraining" BOOLEAN NOT NULL DEFAULT false,
    "aiUsedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "diary_entries_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "diary_entries_workoutId_fkey" FOREIGN KEY ("workoutId") REFERENCES "workouts" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_diary_entries" ("aiUsedAt", "aiUsedForTraining", "createdAt", "date", "energy", "id", "mood", "motivation", "notes", "sleepHrs", "sleepQual", "soreness", "stress", "updatedAt", "userId", "visibilityLevel", "workoutId") SELECT "aiUsedAt", "aiUsedForTraining", "createdAt", "date", "energy", "id", "mood", "motivation", "notes", "sleepHrs", "sleepQual", "soreness", "stress", "updatedAt", "userId", "visibilityLevel", "workoutId" FROM "diary_entries";
DROP TABLE "diary_entries";
ALTER TABLE "new_diary_entries" RENAME TO "diary_entries";
CREATE UNIQUE INDEX "diary_entries_userId_date_key" ON "diary_entries"("userId", "date");
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
    CONSTRAINT "post_workout_feedback_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_post_workout_feedback" ("comment", "createdAt", "discomfort", "enjoyment", "id", "mentalState", "painOrDiscomfort", "perceivedDifficulty", "updatedAt", "userId", "visibleToAI", "visibleToFuturePlanning", "vsPlanned", "workoutId") SELECT "comment", "createdAt", "discomfort", "enjoyment", "id", "mentalState", "painOrDiscomfort", "perceivedDifficulty", "updatedAt", "userId", "visibleToAI", "visibleToFuturePlanning", "vsPlanned", "workoutId" FROM "post_workout_feedback";
DROP TABLE "post_workout_feedback";
ALTER TABLE "new_post_workout_feedback" RENAME TO "post_workout_feedback";
CREATE UNIQUE INDEX "post_workout_feedback_workoutId_key" ON "post_workout_feedback"("workoutId");
CREATE INDEX "post_workout_feedback_userId_idx" ON "post_workout_feedback"("userId");
CREATE INDEX "post_workout_feedback_workoutId_idx" ON "post_workout_feedback"("workoutId");
CREATE INDEX "post_workout_feedback_createdAt_idx" ON "post_workout_feedback"("createdAt");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "ai_memories_userId_idx" ON "ai_memories"("userId");

-- CreateIndex
CREATE INDEX "ai_memories_memoryType_idx" ON "ai_memories"("memoryType");

-- CreateIndex
CREATE INDEX "ai_memory_audits_userId_idx" ON "ai_memory_audits"("userId");
