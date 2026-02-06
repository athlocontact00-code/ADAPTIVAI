-- AlterTable
ALTER TABLE "post_workout_feedback" ADD COLUMN "actualAvgHR" INTEGER;
ALTER TABLE "post_workout_feedback" ADD COLUMN "actualMaxHR" INTEGER;
ALTER TABLE "post_workout_feedback" ADD COLUMN "actualPaceText" TEXT;
ALTER TABLE "post_workout_feedback" ADD COLUMN "actualRpe" INTEGER;

-- AlterTable
ALTER TABLE "profiles" ADD COLUMN "availabilityNotes" TEXT;
ALTER TABLE "profiles" ADD COLUMN "equipmentNotes" TEXT;
ALTER TABLE "profiles" ADD COLUMN "swimPoolLengthM" INTEGER;
ALTER TABLE "profiles" ADD COLUMN "terrainNotes" TEXT;

-- AlterTable
ALTER TABLE "workouts" ADD COLUMN "descriptionMd" TEXT;
ALTER TABLE "workouts" ADD COLUMN "distanceM" INTEGER;
