-- CreateTable
CREATE TABLE "plan_generation_logs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "startDate" DATETIME NOT NULL,
    "endDate" DATETIME NOT NULL,
    "summaryMd" TEXT NOT NULL,
    "constraintsJson" TEXT,
    "warningsJson" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "plan_generation_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_workouts" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "planned" BOOLEAN NOT NULL DEFAULT false,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "durationMin" INTEGER,
    "distanceKm" REAL,
    "avgHR" INTEGER,
    "maxHR" INTEGER,
    "avgPower" INTEGER,
    "tss" INTEGER,
    "calories" INTEGER,
    "elevationM" INTEGER,
    "notes" TEXT,
    "aiGenerated" BOOLEAN NOT NULL DEFAULT false,
    "aiReason" TEXT,
    "aiConfidence" INTEGER,
    "source" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "workouts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_workouts" ("avgHR", "avgPower", "calories", "completed", "createdAt", "date", "distanceKm", "durationMin", "elevationM", "id", "maxHR", "notes", "planned", "title", "tss", "type", "updatedAt", "userId") SELECT "avgHR", "avgPower", "calories", "completed", "createdAt", "date", "distanceKm", "durationMin", "elevationM", "id", "maxHR", "notes", "planned", "title", "tss", "type", "updatedAt", "userId" FROM "workouts";
DROP TABLE "workouts";
ALTER TABLE "new_workouts" RENAME TO "workouts";
CREATE INDEX "workouts_userId_date_idx" ON "workouts"("userId", "date");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "plan_generation_logs_userId_createdAt_idx" ON "plan_generation_logs"("userId", "createdAt");
