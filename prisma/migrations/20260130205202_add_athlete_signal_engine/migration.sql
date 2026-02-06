-- CreateTable
CREATE TABLE "pre_training_checkins" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "workoutId" TEXT NOT NULL,
    "mood" INTEGER NOT NULL,
    "energy" INTEGER NOT NULL,
    "stress" INTEGER NOT NULL,
    "sorenessAreasJson" TEXT,
    "notes" TEXT,
    "aiDecision" TEXT,
    "aiReasonJson" TEXT,
    "aiConfidence" INTEGER,
    "userAccepted" BOOLEAN,
    "userOverrideReason" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "pre_training_checkins_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "pre_training_checkins_workoutId_key" ON "pre_training_checkins"("workoutId");

-- CreateIndex
CREATE INDEX "pre_training_checkins_userId_idx" ON "pre_training_checkins"("userId");

-- CreateIndex
CREATE INDEX "pre_training_checkins_workoutId_idx" ON "pre_training_checkins"("workoutId");
