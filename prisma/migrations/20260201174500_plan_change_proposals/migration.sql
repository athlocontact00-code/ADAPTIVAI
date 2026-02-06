-- ============================================
-- Migration: plan_change_proposals
-- Purpose: Persist plan change proposals for negotiation flow (Phase 2C)
-- Notes:
-- - SQLite stores enums as TEXT; adding PlanRigidity values requires no DDL.
-- ============================================

PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;

CREATE TABLE "plan_change_proposals" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "workoutId" TEXT,
    "checkInId" TEXT,
    "sourceType" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "patchJson" TEXT NOT NULL,
    "confidence" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "decidedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "plan_change_proposals_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "plan_change_proposals_workoutId_fkey" FOREIGN KEY ("workoutId") REFERENCES "workouts" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "plan_change_proposals_userId_idx" ON "plan_change_proposals"("userId");
CREATE INDEX "plan_change_proposals_workoutId_idx" ON "plan_change_proposals"("workoutId");
CREATE INDEX "plan_change_proposals_createdAt_idx" ON "plan_change_proposals"("createdAt");

PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
