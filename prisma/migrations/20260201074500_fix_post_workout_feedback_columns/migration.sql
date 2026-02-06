-- RedefineTables
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
    CONSTRAINT "post_workout_feedback_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

INSERT INTO "new_post_workout_feedback" (
  "id",
  "userId",
  "workoutId",
  "perceivedDifficulty",
  "vsPlanned",
  "enjoyment",
  "painOrDiscomfort",
  "comment",
  "visibleToAI",
  "visibleToFuturePlanning",
  "createdAt",
  "updatedAt"
)
SELECT
  "id",
  "userId",
  "workoutId",
  "perceivedDifficulty",
  "vsPlanned",
  "enjoyment",
  "painOrDiscomfort",
  "comment",
  "visibleToAI",
  "visibleToFuturePlanning",
  "createdAt",
  "createdAt"
FROM "post_workout_feedback";

DROP TABLE "post_workout_feedback";
ALTER TABLE "new_post_workout_feedback" RENAME TO "post_workout_feedback";

CREATE UNIQUE INDEX "post_workout_feedback_workoutId_key" ON "post_workout_feedback"("workoutId");
CREATE INDEX "post_workout_feedback_userId_idx" ON "post_workout_feedback"("userId");
CREATE INDEX "post_workout_feedback_workoutId_idx" ON "post_workout_feedback"("workoutId");
CREATE INDEX "post_workout_feedback_createdAt_idx" ON "post_workout_feedback"("createdAt");

PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
