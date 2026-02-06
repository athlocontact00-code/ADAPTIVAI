-- CreateTable
CREATE TABLE "coach_athlete_links" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "coachUserId" TEXT NOT NULL,
    "athleteUserId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "inviteCode" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "activatedAt" DATETIME,
    CONSTRAINT "coach_athlete_links_coachUserId_fkey" FOREIGN KEY ("coachUserId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "coach_athlete_links_athleteUserId_fkey" FOREIGN KEY ("athleteUserId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "coach_comments" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "authorUserId" TEXT NOT NULL,
    "athleteUserId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "targetDate" DATETIME NOT NULL,
    "workoutId" TEXT,
    "diaryEntryId" TEXT,
    "content" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "coach_comments_authorUserId_fkey" FOREIGN KEY ("authorUserId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "coach_comments_athleteUserId_fkey" FOREIGN KEY ("athleteUserId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "actorUserId" TEXT,
    "actionType" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT,
    "summary" TEXT NOT NULL,
    "detailsJson" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "audit_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "audit_logs_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
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
    "role" TEXT NOT NULL DEFAULT 'ATHLETE',
    "onboardingDone" BOOLEAN NOT NULL DEFAULT false,
    "explainLevel" TEXT NOT NULL DEFAULT 'standard',
    "identityMode" TEXT NOT NULL DEFAULT 'competitive',
    "lastCoachCommentSeenAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_users" ("createdAt", "email", "explainLevel", "id", "identityMode", "image", "name", "onboardingDone", "passwordHash", "updatedAt") SELECT "createdAt", "email", "explainLevel", "id", "identityMode", "image", "name", "onboardingDone", "passwordHash", "updatedAt" FROM "users";
DROP TABLE "users";
ALTER TABLE "new_users" RENAME TO "users";
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "coach_athlete_links_inviteCode_key" ON "coach_athlete_links"("inviteCode");

-- CreateIndex
CREATE INDEX "coach_athlete_links_coachUserId_idx" ON "coach_athlete_links"("coachUserId");

-- CreateIndex
CREATE INDEX "coach_athlete_links_athleteUserId_idx" ON "coach_athlete_links"("athleteUserId");

-- CreateIndex
CREATE INDEX "coach_athlete_links_inviteCode_idx" ON "coach_athlete_links"("inviteCode");

-- CreateIndex
CREATE UNIQUE INDEX "coach_athlete_links_coachUserId_athleteUserId_key" ON "coach_athlete_links"("coachUserId", "athleteUserId");

-- CreateIndex
CREATE INDEX "coach_comments_athleteUserId_idx" ON "coach_comments"("athleteUserId");

-- CreateIndex
CREATE INDEX "coach_comments_authorUserId_idx" ON "coach_comments"("authorUserId");

-- CreateIndex
CREATE INDEX "coach_comments_targetDate_idx" ON "coach_comments"("targetDate");

-- CreateIndex
CREATE INDEX "audit_logs_userId_idx" ON "audit_logs"("userId");

-- CreateIndex
CREATE INDEX "audit_logs_actorUserId_idx" ON "audit_logs"("actorUserId");

-- CreateIndex
CREATE INDEX "audit_logs_createdAt_idx" ON "audit_logs"("createdAt");
