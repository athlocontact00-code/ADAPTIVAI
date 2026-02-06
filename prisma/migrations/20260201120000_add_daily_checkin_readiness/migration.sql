-- ============================================
-- Migration: add_daily_checkin_readiness
-- Purpose: Store deterministic readiness scores for daily check-ins
-- ============================================

ALTER TABLE "daily_checkins" ADD COLUMN "readinessScore" INTEGER;
