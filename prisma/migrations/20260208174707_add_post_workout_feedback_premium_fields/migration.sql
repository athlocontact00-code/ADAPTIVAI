-- CreateEnum
CREATE TYPE "PostWorkoutFeeling" AS ENUM ('GREAT', 'GOOD', 'OK', 'TIRED', 'BAD');

-- CreateEnum
CREATE TYPE "LegsFeel" AS ENUM ('FRESH', 'NORMAL', 'HEAVY', 'SORE');

-- AlterTable
ALTER TABLE "post_workout_feedback" ADD COLUMN     "avgPaceSecPerKm" INTEGER,
ADD COLUMN     "avgPower" INTEGER,
ADD COLUMN     "avgSpeedKph" DOUBLE PRECISION,
ADD COLUMN     "distanceMeters" INTEGER,
ADD COLUMN     "durationMin" INTEGER,
ADD COLUMN     "feeling" "PostWorkoutFeeling",
ADD COLUMN     "intervalsJson" JSONB,
ADD COLUMN     "legs" "LegsFeel",
ADD COLUMN     "swimAvgPaceSecPer100m" INTEGER;
