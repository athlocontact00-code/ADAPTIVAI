-- CreateEnum
CREATE TYPE "PreTrainingDecision" AS ENUM ('PROCEED', 'REDUCE_INTENSITY', 'SHORTEN', 'SWAP_RECOVERY', 'REST');

-- CreateEnum
CREATE TYPE "MuscleSoreness" AS ENUM ('NONE', 'MILD', 'MODERATE', 'SEVERE');

-- CreateEnum
CREATE TYPE "PlanRigidity" AS ENUM ('LOCKED_TODAY', 'LOCKED_1_DAY', 'LOCKED_2_DAYS', 'LOCKED_3_DAYS', 'FLEXIBLE_WEEK');

-- CreateEnum
CREATE TYPE "AITonePreference" AS ENUM ('SUPPORTIVE', 'DIRECT', 'COACH');

-- CreateEnum
CREATE TYPE "MemoryLayer" AS ENUM ('SHORT_TERM', 'MID_TERM', 'LONG_TERM');

-- CreateEnum
CREATE TYPE "WarningType" AS ENUM ('BURNOUT_RISK', 'OVERTRAINING', 'LOAD_SPIKE', 'RECOVERY_DEFICIT', 'COMPLIANCE_DROP');

-- CreateEnum
CREATE TYPE "WarningSeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "PerceivedDifficulty" AS ENUM ('EASY', 'OK', 'HARD', 'BRUTAL');

-- CreateEnum
CREATE TYPE "FeltVsPlanned" AS ENUM ('EASIER', 'SAME', 'HARDER');

-- CreateEnum
CREATE TYPE "DiaryVisibility" AS ENUM ('FULL_AI_ACCESS', 'METRICS_ONLY', 'HIDDEN');

-- CreateEnum
CREATE TYPE "MemoryType" AS ENUM ('PSYCHOLOGICAL', 'FATIGUE_RESPONSE', 'PREFERENCE', 'COMMUNICATION', 'OVERRIDE_PATTERN', 'LANGUAGE_PATTERN');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('WORKOUT_TODAY_CHECKIN', 'LOW_READINESS_HARD_DAY', 'DIDNT_LOG_YESTERDAY');

-- CreateEnum
CREATE TYPE "NotificationStatus" AS ENUM ('UNREAD', 'READ', 'DISMISSED');

-- CreateEnum
CREATE TYPE "SeasonPlanRigidity" AS ENUM ('LOCKED', 'SEMI_LOCKED', 'FLEXIBLE');

-- CreateEnum
CREATE TYPE "SeasonMilestoneKind" AS ENUM ('A_RACE', 'B_RACE', 'C_RACE', 'TEST', 'CAMP');

-- CreateEnum
CREATE TYPE "FocusDiscipline" AS ENUM ('SWIM', 'BIKE', 'RUN', 'STRENGTH', 'MIXED');

-- CreateEnum
CREATE TYPE "PlanChangeProposalStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT,
    "image" TEXT,
    "role" TEXT NOT NULL DEFAULT 'ATHLETE',
    "onboardingDone" BOOLEAN NOT NULL DEFAULT false,
    "explainLevel" TEXT NOT NULL DEFAULT 'standard',
    "identityMode" TEXT NOT NULL DEFAULT 'competitive',
    "tonePreference" "AITonePreference" NOT NULL DEFAULT 'SUPPORTIVE',
    "lastCoachCommentSeenAt" TIMESTAMP(3),
    "stripeCustomerId" TEXT,
    "trialStartedAt" TIMESTAMP(3),
    "trialEndsAt" TIMESTAMP(3),
    "onboardingDismissedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "performance_benchmarks" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "swimCssSecPer100" INTEGER,
    "swim400TimeSec" INTEGER,
    "swim100TimeSec" INTEGER,
    "swim200TimeSec" INTEGER,
    "swim1500TimeSec" INTEGER,
    "run5kTimeSec" INTEGER,
    "run10kTimeSec" INTEGER,
    "runThresholdSecPerKm" INTEGER,
    "runHmTimeSec" INTEGER,
    "runMarathonTimeSec" INTEGER,
    "bikeBest20minWatts" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "performance_benchmarks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscriptions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "plan" TEXT NOT NULL DEFAULT 'pro',
    "status" TEXT NOT NULL DEFAULT 'incomplete',
    "stripeCustomerId" TEXT NOT NULL,
    "stripeSubscriptionId" TEXT NOT NULL,
    "stripePriceId" TEXT,
    "stripeProductId" TEXT,
    "currentPeriodStart" TIMESTAMP(3),
    "currentPeriodEnd" TIMESTAMP(3),
    "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false,
    "canceledAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),
    "trialEnd" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stripe_events" (
    "id" TEXT NOT NULL,
    "stripeEventId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "livemode" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),

    CONSTRAINT "stripe_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "data" TEXT,
    "status" "NotificationStatus" NOT NULL DEFAULT 'UNREAD',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "readAt" TIMESTAMP(3),
    "dismissedAt" TIMESTAMP(3),

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "weekly_digests" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "weekStart" TIMESTAMP(3) NOT NULL,
    "weekEnd" TIMESTAMP(3) NOT NULL,
    "subject" TEXT,
    "html" TEXT,
    "text" TEXT,
    "data" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'created',

    CONSTRAINT "weekly_digests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "today_decisions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "payload" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "today_decisions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "profiles" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "birthDate" TIMESTAMP(3),
    "weight" DOUBLE PRECISION,
    "height" DOUBLE PRECISION,
    "restingHR" INTEGER,
    "maxHR" INTEGER,
    "ftp" INTEGER,
    "weeklyHoursGoal" DOUBLE PRECISION,
    "sportPrimary" TEXT,
    "experienceLevel" TEXT,
    "equipmentNotes" TEXT,
    "terrainNotes" TEXT,
    "availabilityNotes" TEXT,
    "swimPoolLengthM" INTEGER,
    "zone1Min" INTEGER,
    "zone1Max" INTEGER,
    "zone2Min" INTEGER,
    "zone2Max" INTEGER,
    "zone3Min" INTEGER,
    "zone3Max" INTEGER,
    "zone4Min" INTEGER,
    "zone4Max" INTEGER,
    "zone5Min" INTEGER,
    "zone5Max" INTEGER,
    "planRigidity" "PlanRigidity" NOT NULL DEFAULT 'LOCKED_1_DAY',
    "locale" TEXT,
    "club" TEXT,
    "location" TEXT,
    "timezone" TEXT,
    "birthYear" INTEGER,
    "availability" JSONB,
    "preferences" JSONB,
    "guardrails" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workouts" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "planned" BOOLEAN NOT NULL DEFAULT false,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "durationMin" INTEGER,
    "distanceKm" DOUBLE PRECISION,
    "distanceM" INTEGER,
    "avgHR" INTEGER,
    "maxHR" INTEGER,
    "avgPower" INTEGER,
    "tss" INTEGER,
    "calories" INTEGER,
    "elevationM" INTEGER,
    "notes" TEXT,
    "descriptionMd" TEXT,
    "prescriptionJson" TEXT,
    "aiGenerated" BOOLEAN NOT NULL DEFAULT false,
    "aiReason" TEXT,
    "aiConfidence" INTEGER,
    "source" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workouts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "diary_entries" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "mood" INTEGER,
    "energy" INTEGER,
    "sleepHrs" DOUBLE PRECISION,
    "sleepQual" INTEGER,
    "stress" INTEGER,
    "soreness" INTEGER,
    "motivation" INTEGER,
    "notes" TEXT,
    "workoutId" TEXT,
    "visibilityLevel" "DiaryVisibility" NOT NULL DEFAULT 'FULL_AI_ACCESS',
    "aiUsedForTraining" BOOLEAN NOT NULL DEFAULT false,
    "aiUsedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "diary_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "metrics_daily" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "atl" DOUBLE PRECISION,
    "ctl" DOUBLE PRECISION,
    "tsb" DOUBLE PRECISION,
    "tss" INTEGER,
    "duration" INTEGER,
    "distance" DOUBLE PRECISION,
    "readinessScore" INTEGER,
    "readinessStatus" TEXT,
    "readinessFactorsJson" TEXT,
    "readinessConfidence" INTEGER,
    "fatigueType" TEXT,
    "fatigueReasonsJson" TEXT,
    "weeklyLoad" INTEGER,
    "rampRate" DOUBLE PRECISION,
    "rampStatus" TEXT,
    "complianceScore" INTEGER,
    "complianceStatus" TEXT,
    "complianceReasonsJson" TEXT,
    "plannedWorkouts" INTEGER,
    "completedWorkouts" INTEGER,
    "currentStreak" INTEGER,
    "burnoutRisk" INTEGER,
    "burnoutStatus" TEXT,
    "burnoutDriversJson" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "metrics_daily_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quotes" (
    "id" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "author" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "source" TEXT,
    "tone" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "quotes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plan_generation_logs" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "summaryMd" TEXT NOT NULL,
    "constraintsJson" TEXT,
    "warningsJson" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "plan_generation_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "daily_insights" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "insightText" TEXT NOT NULL,
    "insightType" TEXT NOT NULL,
    "driversJson" TEXT,
    "dismissed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "daily_insights_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "seasons" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "primaryGoal" TEXT,
    "sport" TEXT DEFAULT 'Triathlon',
    "goalRaceDate" TIMESTAMP(3),
    "planRigidity" "SeasonPlanRigidity",
    "constraints" TEXT,
    "disciplineFocus" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "seasons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "training_blocks" (
    "id" TEXT NOT NULL,
    "seasonId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "focus" TEXT,
    "targetHours" DOUBLE PRECISION,
    "targetHoursMin" DOUBLE PRECISION,
    "targetHoursMax" DOUBLE PRECISION,
    "targetTSSMin" INTEGER,
    "targetTSSMax" INTEGER,
    "focusDiscipline" "FocusDiscipline",
    "focusLabel" TEXT,
    "intensityCap" DOUBLE PRECISION,
    "guardrails" TEXT,
    "blockOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "training_blocks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "race_events" (
    "id" TEXT NOT NULL,
    "seasonId" TEXT,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "distance" TEXT,
    "priority" TEXT NOT NULL,
    "goalTime" TEXT,
    "notes" TEXT,
    "kind" "SeasonMilestoneKind",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "race_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "season_alerts" (
    "id" TEXT NOT NULL,
    "seasonId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "why" TEXT,
    "ctaLabel" TEXT,
    "ctaActionKey" TEXT,
    "dismissedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "season_alerts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "personal_bests" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sport" TEXT NOT NULL,
    "discipline" TEXT NOT NULL,
    "valueNumber" DOUBLE PRECISION NOT NULL,
    "valueUnit" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "notes" TEXT,
    "source" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "personal_bests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "injury_events" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "area" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "injury_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "generated_reports" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "title" TEXT NOT NULL,
    "summaryMd" TEXT NOT NULL,
    "metricsJson" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "generated_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "analytics_events" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "name" TEXT NOT NULL,
    "requestId" TEXT,
    "route" TEXT,
    "source" TEXT,
    "propertiesJson" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "analytics_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "simulation_scenarios" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "durationWeeks" INTEGER NOT NULL,
    "paramsJson" TEXT NOT NULL,
    "applied" BOOLEAN NOT NULL DEFAULT false,
    "appliedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "simulation_scenarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "simulation_results" (
    "id" TEXT NOT NULL,
    "scenarioId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "weekIndex" INTEGER NOT NULL,
    "simulatedCTL" DOUBLE PRECISION NOT NULL,
    "simulatedATL" DOUBLE PRECISION NOT NULL,
    "simulatedTSB" DOUBLE PRECISION NOT NULL,
    "simulatedReadinessAvg" INTEGER NOT NULL,
    "simulatedBurnoutRisk" INTEGER NOT NULL,
    "weeklyTSS" INTEGER,
    "insightsJson" TEXT,
    "warningsJson" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "simulation_results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "coach_athlete_links" (
    "id" TEXT NOT NULL,
    "coachUserId" TEXT NOT NULL,
    "athleteUserId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "inviteCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "activatedAt" TIMESTAMP(3),

    CONSTRAINT "coach_athlete_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "coach_comments" (
    "id" TEXT NOT NULL,
    "authorUserId" TEXT NOT NULL,
    "athleteUserId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "targetDate" TIMESTAMP(3) NOT NULL,
    "workoutId" TEXT,
    "diaryEntryId" TEXT,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "coach_comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "actorUserId" TEXT,
    "actionType" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT,
    "summary" TEXT NOT NULL,
    "detailsJson" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plan_change_proposals" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "workoutId" TEXT,
    "checkInId" TEXT,
    "sourceType" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "patchJson" TEXT NOT NULL,
    "confidence" INTEGER,
    "status" "PlanChangeProposalStatus" NOT NULL DEFAULT 'PENDING',
    "decidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "plan_change_proposals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "daily_checkins" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "workoutId" TEXT,
    "sleepQuality100" INTEGER,
    "fatigue100" INTEGER,
    "motivation100" INTEGER,
    "soreness100" INTEGER,
    "stress100" INTEGER,
    "readinessScore" INTEGER,
    "topFactor" TEXT,
    "recommendation" TEXT,
    "notes" TEXT,
    "notesVisibility" "DiaryVisibility" NOT NULL DEFAULT 'FULL_AI_ACCESS',
    "sleepDuration" DOUBLE PRECISION,
    "sleepQuality" INTEGER,
    "physicalFatigue" INTEGER,
    "mentalReadiness" INTEGER,
    "motivation" INTEGER,
    "muscleSoreness" "MuscleSoreness" NOT NULL DEFAULT 'NONE',
    "stressLevel" INTEGER,
    "mood" INTEGER,
    "energy" INTEGER,
    "sorenessAreasJson" TEXT,
    "aiDecision" "PreTrainingDecision",
    "aiReasonJson" TEXT,
    "aiConfidence" INTEGER,
    "aiExplanation" TEXT,
    "originalWorkoutJson" TEXT,
    "userAccepted" BOOLEAN,
    "userOverrideReason" TEXT,
    "hasConflict" BOOLEAN NOT NULL DEFAULT false,
    "conflictReason" TEXT,
    "suggestedChange" TEXT,
    "lockedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "daily_checkins_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pre_training_checkins" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "workoutId" TEXT NOT NULL,
    "mood" INTEGER NOT NULL,
    "energy" INTEGER NOT NULL,
    "stress" INTEGER NOT NULL,
    "sorenessAreasJson" TEXT,
    "notes" TEXT,
    "aiDecision" "PreTrainingDecision",
    "aiReasonJson" TEXT,
    "aiConfidence" INTEGER,
    "userAccepted" BOOLEAN,
    "userOverrideReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pre_training_checkins_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "post_workout_feedback" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "workoutId" TEXT NOT NULL,
    "perceivedDifficulty" "PerceivedDifficulty" NOT NULL,
    "vsPlanned" "FeltVsPlanned" NOT NULL,
    "enjoyment" INTEGER NOT NULL,
    "discomfort" "MuscleSoreness" NOT NULL DEFAULT 'NONE',
    "mentalState" INTEGER NOT NULL DEFAULT 3,
    "painOrDiscomfort" TEXT,
    "comment" TEXT,
    "actualAvgHR" INTEGER,
    "actualMaxHR" INTEGER,
    "actualPaceText" TEXT,
    "actualRpe" INTEGER,
    "actualFeel" INTEGER,
    "sessionEquipment" TEXT,
    "sessionTerrain" TEXT,
    "sessionAvailability" TEXT,
    "visibleToAI" BOOLEAN NOT NULL DEFAULT true,
    "visibleToFuturePlanning" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "post_workout_feedback_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "feedback_aggregations" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "weekStart" TIMESTAMP(3) NOT NULL,
    "weekEnd" TIMESTAMP(3) NOT NULL,
    "totalWorkouts" INTEGER NOT NULL,
    "feedbackCount" INTEGER NOT NULL,
    "avgEnjoyment" DOUBLE PRECISION,
    "tooHardCount" INTEGER NOT NULL,
    "harderThanPlannedCount" INTEGER NOT NULL,
    "easierThanPlannedCount" INTEGER NOT NULL,
    "painReportedCount" INTEGER NOT NULL,
    "intensityAdjustment" DOUBLE PRECISION,
    "confidenceImpact" INTEGER,
    "toneAdjustment" TEXT,
    "insightsJson" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "feedback_aggregations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_memories" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "memoryLayer" "MemoryLayer" NOT NULL DEFAULT 'SHORT_TERM',
    "memoryType" "MemoryType" NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "confidence" INTEGER NOT NULL DEFAULT 50,
    "dataPoints" INTEGER NOT NULL DEFAULT 0,
    "sourceIdsJson" TEXT,
    "profileDataJson" TEXT,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 1,
    "supersededBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_memories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_memory_audits" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "memoryType" TEXT,
    "details" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_memory_audits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_warnings" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "scenarioId" TEXT,
    "warningType" "WarningType" NOT NULL,
    "severity" "WarningSeverity" NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "triggerMetricJson" TEXT,
    "targetDate" TIMESTAMP(3),
    "workoutId" TEXT,
    "acknowledged" BOOLEAN NOT NULL DEFAULT false,
    "acknowledgedAt" TIMESTAMP(3),
    "dismissed" BOOLEAN NOT NULL DEFAULT false,
    "dismissedAt" TIMESTAMP(3),
    "confidence" INTEGER NOT NULL DEFAULT 70,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),

    CONSTRAINT "ai_warnings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "journal_insights" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "suggestion" TEXT,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "dataPointsJson" TEXT,
    "dismissed" BOOLEAN NOT NULL DEFAULT false,
    "acknowledged" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "journal_insights_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "coach_suggestions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "contextDate" TIMESTAMP(3) NOT NULL,
    "scope" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "why" TEXT NOT NULL,
    "payload" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "appliedAt" TIMESTAMP(3),
    "dismissedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "coach_suggestions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_stripeCustomerId_key" ON "users"("stripeCustomerId");

-- CreateIndex
CREATE UNIQUE INDEX "performance_benchmarks_userId_key" ON "performance_benchmarks"("userId");

-- CreateIndex
CREATE INDEX "performance_benchmarks_userId_idx" ON "performance_benchmarks"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "subscriptions_stripeSubscriptionId_key" ON "subscriptions"("stripeSubscriptionId");

-- CreateIndex
CREATE INDEX "subscriptions_userId_idx" ON "subscriptions"("userId");

-- CreateIndex
CREATE INDEX "subscriptions_status_idx" ON "subscriptions"("status");

-- CreateIndex
CREATE UNIQUE INDEX "stripe_events_stripeEventId_key" ON "stripe_events"("stripeEventId");

-- CreateIndex
CREATE INDEX "stripe_events_type_idx" ON "stripe_events"("type");

-- CreateIndex
CREATE INDEX "notifications_userId_idx" ON "notifications"("userId");

-- CreateIndex
CREATE INDEX "notifications_userId_status_idx" ON "notifications"("userId", "status");

-- CreateIndex
CREATE INDEX "weekly_digests_userId_idx" ON "weekly_digests"("userId");

-- CreateIndex
CREATE INDEX "today_decisions_userId_idx" ON "today_decisions"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "today_decisions_userId_date_key" ON "today_decisions"("userId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "profiles_userId_key" ON "profiles"("userId");

-- CreateIndex
CREATE INDEX "workouts_userId_date_idx" ON "workouts"("userId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "diary_entries_userId_date_key" ON "diary_entries"("userId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "metrics_daily_userId_date_key" ON "metrics_daily"("userId", "date");

-- CreateIndex
CREATE INDEX "quotes_category_idx" ON "quotes"("category");

-- CreateIndex
CREATE INDEX "quotes_tone_idx" ON "quotes"("tone");

-- CreateIndex
CREATE INDEX "plan_generation_logs_userId_createdAt_idx" ON "plan_generation_logs"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "daily_insights_userId_date_key" ON "daily_insights"("userId", "date");

-- CreateIndex
CREATE INDEX "seasons_userId_idx" ON "seasons"("userId");

-- CreateIndex
CREATE INDEX "training_blocks_userId_idx" ON "training_blocks"("userId");

-- CreateIndex
CREATE INDEX "training_blocks_seasonId_idx" ON "training_blocks"("seasonId");

-- CreateIndex
CREATE INDEX "race_events_userId_idx" ON "race_events"("userId");

-- CreateIndex
CREATE INDEX "season_alerts_seasonId_idx" ON "season_alerts"("seasonId");

-- CreateIndex
CREATE INDEX "personal_bests_userId_idx" ON "personal_bests"("userId");

-- CreateIndex
CREATE INDEX "injury_events_userId_idx" ON "injury_events"("userId");

-- CreateIndex
CREATE INDEX "generated_reports_userId_idx" ON "generated_reports"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "generated_reports_userId_type_periodStart_key" ON "generated_reports"("userId", "type", "periodStart");

-- CreateIndex
CREATE INDEX "analytics_events_userId_createdAt_idx" ON "analytics_events"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "analytics_events_name_createdAt_idx" ON "analytics_events"("name", "createdAt");

-- CreateIndex
CREATE INDEX "analytics_events_requestId_idx" ON "analytics_events"("requestId");

-- CreateIndex
CREATE INDEX "simulation_scenarios_userId_idx" ON "simulation_scenarios"("userId");

-- CreateIndex
CREATE INDEX "simulation_results_userId_idx" ON "simulation_results"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "simulation_results_scenarioId_weekIndex_key" ON "simulation_results"("scenarioId", "weekIndex");

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

-- CreateIndex
CREATE INDEX "plan_change_proposals_userId_idx" ON "plan_change_proposals"("userId");

-- CreateIndex
CREATE INDEX "plan_change_proposals_workoutId_idx" ON "plan_change_proposals"("workoutId");

-- CreateIndex
CREATE INDEX "plan_change_proposals_createdAt_idx" ON "plan_change_proposals"("createdAt");

-- CreateIndex
CREATE INDEX "daily_checkins_userId_idx" ON "daily_checkins"("userId");

-- CreateIndex
CREATE INDEX "daily_checkins_date_idx" ON "daily_checkins"("date");

-- CreateIndex
CREATE UNIQUE INDEX "daily_checkins_userId_date_key" ON "daily_checkins"("userId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "pre_training_checkins_workoutId_key" ON "pre_training_checkins"("workoutId");

-- CreateIndex
CREATE INDEX "pre_training_checkins_userId_idx" ON "pre_training_checkins"("userId");

-- CreateIndex
CREATE INDEX "pre_training_checkins_workoutId_idx" ON "pre_training_checkins"("workoutId");

-- CreateIndex
CREATE UNIQUE INDEX "post_workout_feedback_workoutId_key" ON "post_workout_feedback"("workoutId");

-- CreateIndex
CREATE INDEX "post_workout_feedback_userId_idx" ON "post_workout_feedback"("userId");

-- CreateIndex
CREATE INDEX "post_workout_feedback_workoutId_idx" ON "post_workout_feedback"("workoutId");

-- CreateIndex
CREATE INDEX "post_workout_feedback_createdAt_idx" ON "post_workout_feedback"("createdAt");

-- CreateIndex
CREATE INDEX "feedback_aggregations_userId_idx" ON "feedback_aggregations"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "feedback_aggregations_userId_weekStart_key" ON "feedback_aggregations"("userId", "weekStart");

-- CreateIndex
CREATE INDEX "ai_memories_userId_idx" ON "ai_memories"("userId");

-- CreateIndex
CREATE INDEX "ai_memories_memoryLayer_idx" ON "ai_memories"("memoryLayer");

-- CreateIndex
CREATE INDEX "ai_memories_memoryType_idx" ON "ai_memories"("memoryType");

-- CreateIndex
CREATE INDEX "ai_memories_expiresAt_idx" ON "ai_memories"("expiresAt");

-- CreateIndex
CREATE INDEX "ai_memories_userId_memoryLayer_idx" ON "ai_memories"("userId", "memoryLayer");

-- CreateIndex
CREATE INDEX "ai_memories_userId_memoryType_idx" ON "ai_memories"("userId", "memoryType");

-- CreateIndex
CREATE INDEX "ai_memory_audits_userId_idx" ON "ai_memory_audits"("userId");

-- CreateIndex
CREATE INDEX "ai_warnings_userId_idx" ON "ai_warnings"("userId");

-- CreateIndex
CREATE INDEX "ai_warnings_scenarioId_idx" ON "ai_warnings"("scenarioId");

-- CreateIndex
CREATE INDEX "ai_warnings_warningType_idx" ON "ai_warnings"("warningType");

-- CreateIndex
CREATE INDEX "ai_warnings_targetDate_idx" ON "ai_warnings"("targetDate");

-- CreateIndex
CREATE INDEX "journal_insights_userId_idx" ON "journal_insights"("userId");

-- CreateIndex
CREATE INDEX "journal_insights_createdAt_idx" ON "journal_insights"("createdAt");

-- CreateIndex
CREATE INDEX "coach_suggestions_userId_status_idx" ON "coach_suggestions"("userId", "status");

-- CreateIndex
CREATE INDEX "coach_suggestions_userId_contextDate_idx" ON "coach_suggestions"("userId", "contextDate");

-- AddForeignKey
ALTER TABLE "performance_benchmarks" ADD CONSTRAINT "performance_benchmarks_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "weekly_digests" ADD CONSTRAINT "weekly_digests_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "today_decisions" ADD CONSTRAINT "today_decisions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workouts" ADD CONSTRAINT "workouts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "diary_entries" ADD CONSTRAINT "diary_entries_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "diary_entries" ADD CONSTRAINT "diary_entries_workoutId_fkey" FOREIGN KEY ("workoutId") REFERENCES "workouts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "metrics_daily" ADD CONSTRAINT "metrics_daily_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plan_generation_logs" ADD CONSTRAINT "plan_generation_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_insights" ADD CONSTRAINT "daily_insights_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seasons" ADD CONSTRAINT "seasons_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "training_blocks" ADD CONSTRAINT "training_blocks_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "seasons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "training_blocks" ADD CONSTRAINT "training_blocks_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "race_events" ADD CONSTRAINT "race_events_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "seasons"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "race_events" ADD CONSTRAINT "race_events_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "season_alerts" ADD CONSTRAINT "season_alerts_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "seasons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "personal_bests" ADD CONSTRAINT "personal_bests_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "injury_events" ADD CONSTRAINT "injury_events_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "generated_reports" ADD CONSTRAINT "generated_reports_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "analytics_events" ADD CONSTRAINT "analytics_events_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "simulation_scenarios" ADD CONSTRAINT "simulation_scenarios_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "simulation_results" ADD CONSTRAINT "simulation_results_scenarioId_fkey" FOREIGN KEY ("scenarioId") REFERENCES "simulation_scenarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "simulation_results" ADD CONSTRAINT "simulation_results_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coach_athlete_links" ADD CONSTRAINT "coach_athlete_links_coachUserId_fkey" FOREIGN KEY ("coachUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coach_athlete_links" ADD CONSTRAINT "coach_athlete_links_athleteUserId_fkey" FOREIGN KEY ("athleteUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coach_comments" ADD CONSTRAINT "coach_comments_authorUserId_fkey" FOREIGN KEY ("authorUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coach_comments" ADD CONSTRAINT "coach_comments_athleteUserId_fkey" FOREIGN KEY ("athleteUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plan_change_proposals" ADD CONSTRAINT "plan_change_proposals_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plan_change_proposals" ADD CONSTRAINT "plan_change_proposals_workoutId_fkey" FOREIGN KEY ("workoutId") REFERENCES "workouts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_checkins" ADD CONSTRAINT "daily_checkins_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pre_training_checkins" ADD CONSTRAINT "pre_training_checkins_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "post_workout_feedback" ADD CONSTRAINT "post_workout_feedback_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "post_workout_feedback" ADD CONSTRAINT "post_workout_feedback_workoutId_fkey" FOREIGN KEY ("workoutId") REFERENCES "workouts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feedback_aggregations" ADD CONSTRAINT "feedback_aggregations_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_memories" ADD CONSTRAINT "ai_memories_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_memory_audits" ADD CONSTRAINT "ai_memory_audits_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_warnings" ADD CONSTRAINT "ai_warnings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_warnings" ADD CONSTRAINT "ai_warnings_scenarioId_fkey" FOREIGN KEY ("scenarioId") REFERENCES "simulation_scenarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_warnings" ADD CONSTRAINT "ai_warnings_workoutId_fkey" FOREIGN KEY ("workoutId") REFERENCES "workouts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journal_insights" ADD CONSTRAINT "journal_insights_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coach_suggestions" ADD CONSTRAINT "coach_suggestions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
