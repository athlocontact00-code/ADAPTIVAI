-- CreateTable
CREATE TABLE "journal_insights" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "suggestion" TEXT,
    "startDate" DATETIME NOT NULL,
    "endDate" DATETIME NOT NULL,
    "dataPointsJson" TEXT,
    "dismissed" BOOLEAN NOT NULL DEFAULT false,
    "acknowledged" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "journal_insights_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
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
    "aiAccessLevel" TEXT NOT NULL DEFAULT 'FULL',
    "aiUsedForTraining" BOOLEAN NOT NULL DEFAULT false,
    "aiUsedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "diary_entries_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "diary_entries_workoutId_fkey" FOREIGN KEY ("workoutId") REFERENCES "workouts" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_diary_entries" ("createdAt", "date", "energy", "id", "mood", "notes", "sleepHrs", "sleepQual", "soreness", "stress", "updatedAt", "userId", "workoutId") SELECT "createdAt", "date", "energy", "id", "mood", "notes", "sleepHrs", "sleepQual", "soreness", "stress", "updatedAt", "userId", "workoutId" FROM "diary_entries";
DROP TABLE "diary_entries";
ALTER TABLE "new_diary_entries" RENAME TO "diary_entries";
CREATE UNIQUE INDEX "diary_entries_userId_date_key" ON "diary_entries"("userId", "date");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "journal_insights_userId_idx" ON "journal_insights"("userId");

-- CreateIndex
CREATE INDEX "journal_insights_createdAt_idx" ON "journal_insights"("createdAt");
