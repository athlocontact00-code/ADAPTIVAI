-- AlterTable
ALTER TABLE "metrics_daily" ADD COLUMN "burnoutDriversJson" TEXT;
ALTER TABLE "metrics_daily" ADD COLUMN "burnoutRisk" INTEGER;
ALTER TABLE "metrics_daily" ADD COLUMN "burnoutStatus" TEXT;
ALTER TABLE "metrics_daily" ADD COLUMN "completedWorkouts" INTEGER;
ALTER TABLE "metrics_daily" ADD COLUMN "complianceReasonsJson" TEXT;
ALTER TABLE "metrics_daily" ADD COLUMN "complianceScore" INTEGER;
ALTER TABLE "metrics_daily" ADD COLUMN "complianceStatus" TEXT;
ALTER TABLE "metrics_daily" ADD COLUMN "currentStreak" INTEGER;
ALTER TABLE "metrics_daily" ADD COLUMN "plannedWorkouts" INTEGER;

-- CreateTable
CREATE TABLE "daily_insights" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "insightText" TEXT NOT NULL,
    "insightType" TEXT NOT NULL,
    "driversJson" TEXT,
    "dismissed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "daily_insights_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_users" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT,
    "image" TEXT,
    "onboardingDone" BOOLEAN NOT NULL DEFAULT false,
    "explainLevel" TEXT NOT NULL DEFAULT 'standard',
    "identityMode" TEXT NOT NULL DEFAULT 'competitive',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_users" ("createdAt", "email", "explainLevel", "id", "image", "name", "onboardingDone", "passwordHash", "updatedAt") SELECT "createdAt", "email", "explainLevel", "id", "image", "name", "onboardingDone", "passwordHash", "updatedAt" FROM "users";
DROP TABLE "users";
ALTER TABLE "new_users" RENAME TO "users";
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "daily_insights_userId_date_key" ON "daily_insights"("userId", "date");
