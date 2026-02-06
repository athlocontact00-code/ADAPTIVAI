-- CreateTable
CREATE TABLE "daily_checkins" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "workoutId" TEXT,
    "sleepDuration" REAL NOT NULL,
    "sleepQuality" INTEGER NOT NULL,
    "physicalFatigue" INTEGER NOT NULL,
    "mentalReadiness" INTEGER NOT NULL,
    "motivation" INTEGER NOT NULL,
    "muscleSoreness" TEXT NOT NULL,
    "stressLevel" INTEGER NOT NULL,
    "notes" TEXT,
    "mood" INTEGER,
    "energy" INTEGER,
    "sorenessAreasJson" TEXT,
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

-- CreateIndex
CREATE INDEX "daily_checkins_userId_idx" ON "daily_checkins"("userId");

-- CreateIndex
CREATE INDEX "daily_checkins_date_idx" ON "daily_checkins"("date");

-- CreateIndex
CREATE UNIQUE INDEX "daily_checkins_userId_date_key" ON "daily_checkins"("userId", "date");
