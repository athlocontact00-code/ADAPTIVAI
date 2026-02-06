/*
  Warnings:

  - You are about to drop the column `readiness` on the `metrics_daily` table. All the data in the column will be lost.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_metrics_daily" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "atl" REAL,
    "ctl" REAL,
    "tsb" REAL,
    "tss" INTEGER,
    "duration" INTEGER,
    "distance" REAL,
    "readinessScore" INTEGER,
    "readinessStatus" TEXT,
    "readinessFactorsJson" TEXT,
    "readinessConfidence" INTEGER,
    "fatigueType" TEXT,
    "fatigueReasonsJson" TEXT,
    "weeklyLoad" INTEGER,
    "rampRate" REAL,
    "rampStatus" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "metrics_daily_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_metrics_daily" ("atl", "createdAt", "ctl", "date", "distance", "duration", "id", "tsb", "tss", "userId") SELECT "atl", "createdAt", "ctl", "date", "distance", "duration", "id", "tsb", "tss", "userId" FROM "metrics_daily";
DROP TABLE "metrics_daily";
ALTER TABLE "new_metrics_daily" RENAME TO "metrics_daily";
CREATE UNIQUE INDEX "metrics_daily_userId_date_key" ON "metrics_daily"("userId", "date");
CREATE TABLE "new_users" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT,
    "image" TEXT,
    "onboardingDone" BOOLEAN NOT NULL DEFAULT false,
    "explainLevel" TEXT NOT NULL DEFAULT 'standard',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_users" ("createdAt", "email", "id", "image", "name", "onboardingDone", "passwordHash", "updatedAt") SELECT "createdAt", "email", "id", "image", "name", "onboardingDone", "passwordHash", "updatedAt" FROM "users";
DROP TABLE "users";
ALTER TABLE "new_users" RENAME TO "users";
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
