import { hash } from "bcryptjs";
import { db } from "@/lib/db";
import {
  calculateReadinessScore,
  mapScoreToDecision,
  type MuscleSoreness,
} from "@/lib/services/daily-checkin.service";

const DECISION_BUCKETS: Array<{
  label: string;
  data: {
    sleepDuration: number;
    sleepQuality: number;
    physicalFatigue: number;
    mentalReadiness: number;
    motivation: number;
    muscleSoreness: MuscleSoreness;
    stressLevel: number;
  };
}> = [
  {
    label: "PROCEED",
    data: {
      sleepDuration: 8,
      sleepQuality: 5,
      physicalFatigue: 1,
      mentalReadiness: 5,
      motivation: 5,
      muscleSoreness: "NONE",
      stressLevel: 1,
    },
  },
  {
    label: "REDUCE_INTENSITY",
    data: {
      sleepDuration: 7,
      sleepQuality: 3,
      physicalFatigue: 3,
      mentalReadiness: 4,
      motivation: 4,
      muscleSoreness: "MILD",
      stressLevel: 2,
    },
  },
  {
    label: "SHORTEN",
    data: {
      sleepDuration: 6,
      sleepQuality: 2,
      physicalFatigue: 4,
      mentalReadiness: 3,
      motivation: 2,
      muscleSoreness: "MODERATE",
      stressLevel: 3,
    },
  },
  {
    label: "SWAP_RECOVERY",
    data: {
      sleepDuration: 5.5,
      sleepQuality: 2,
      physicalFatigue: 4,
      mentalReadiness: 2,
      motivation: 2,
      muscleSoreness: "MODERATE",
      stressLevel: 4,
    },
  },
  {
    label: "REST",
    data: {
      sleepDuration: 4,
      sleepQuality: 1,
      physicalFatigue: 5,
      mentalReadiness: 1,
      motivation: 1,
      muscleSoreness: "SEVERE",
      stressLevel: 5,
    },
  },
];

async function main() {
  const email = `smoke+${Date.now()}@adaptivai.app`;
  const passwordHash = await hash("SmokeTest123!", 10);
  const user = await db.user.create({
    data: {
      email,
      name: "Smoke Test User",
      passwordHash,
    },
  });

  console.log("✔ Created user", email);

  const workout = await db.workout.create({
    data: {
      userId: user.id,
      title: "Smoke-test Run",
      type: "run",
      date: new Date(Date.now() + 24 * 60 * 60 * 1000),
      planned: true,
      completed: false,
    },
  });

  console.log("✔ Created workout", workout.id);

  const feedback = await db.postWorkoutFeedback.create({
    data: {
      userId: user.id,
      workoutId: workout.id,
      perceivedDifficulty: "OK",
      vsPlanned: "SAME",
      enjoyment: 4,
      discomfort: "NONE",
      mentalState: 4,
      comment: "Great session, felt exactly as planned.",
      visibleToAI: true,
      visibleToFuturePlanning: true,
    },
  });

  console.log("✔ Saved post-workout feedback", feedback.id);

  const checkInIds: string[] = [];
  for (let idx = 0; idx < DECISION_BUCKETS.length; idx++) {
    const bucket = DECISION_BUCKETS[idx];
    const timestamp = Date.now() - (idx + 1) * 24 * 60 * 60 * 1000;
    const date = new Date(timestamp);
    date.setUTCHours(0, 0, 0, 0);
    const { data } = bucket;
    const readinessScore = calculateReadinessScore(data);
    const aiDecision = mapScoreToDecision(readinessScore);

    const checkIn = await (db as any).dailyCheckIn.create({
      data: {
        userId: user.id,
        date,
        ...data,
        readinessScore,
        aiDecision,
        aiConfidence: 80,
        aiExplanation: `${bucket.label} signal recorded.`,
        userAccepted: bucket.label !== "SWAP_RECOVERY",
        userOverrideReason: bucket.label === "SWAP_RECOVERY" ? "Smoke override" : null,
      },
    });

    checkInIds.push(checkIn.id);
    console.log(
      `✔ Check-in ${bucket.label}: stored decision=${aiDecision} (score=${readinessScore})`
    );
  }

  const totalCheckIns = await db.dailyCheckIn.count({ where: { userId: user.id } });
  const totalOverrides = await db.dailyCheckIn.count({
    where: { userId: user.id, userAccepted: false, aiDecision: { not: null } },
  });
  const overrideRate = Math.round((totalOverrides / Math.max(1, totalCheckIns)) * 100);
  const overridesByDecision = await db.dailyCheckIn.groupBy({
    by: ["aiDecision"],
    where: { userId: user.id, userAccepted: false, aiDecision: { not: null } },
    _count: { aiDecision: true },
  });

  console.log(
    `✔ Override stats: ${totalOverrides} override(s) out of ${totalCheckIns} check-ins -> ${overrideRate}%`
  );
  console.log(
    "✔ Overrides by decision:",
    overridesByDecision.map((row) => `${row.aiDecision}: ${row._count.aiDecision}`)
  );

  const feedbackRow = await db.postWorkoutFeedback.findUnique({
    where: { workoutId: workout.id },
  });
  if (!feedbackRow) {
    throw new Error("Post-workout feedback disappeared immediately after save.");
  }
  console.log("✔ Feedback persisted and queryable");

  await db.workout.delete({ where: { id: workout.id } });
  const feedbackAfterWorkoutDelete = await db.postWorkoutFeedback.findUnique({
    where: { workoutId: workout.id },
  });
  if (feedbackAfterWorkoutDelete) {
    throw new Error("Feedback still exists after workout delete");
  }
  console.log("✔ Deleting workout cascaded feedback");

  await (db as any).aIMemory.create({
    data: {
      userId: user.id,
      memoryType: "FATIGUE_RESPONSE",
      title: "Smoke memory",
      summary: "Smoke test memory",
      confidence: 90,
      dataPoints: 1,
      periodStart: new Date(),
      periodEnd: new Date(),
    },
  });
  await (db as any).aIWarning.create({
    data: {
      userId: user.id,
      warningType: "BURNOUT_RISK",
      severity: "MEDIUM",
      title: "Smoke warning",
      message: "Simulated burnout warning",
      confidence: 75,
    },
  });

  console.log("✔ Created AI memory and warning");

  await db.user.delete({ where: { id: user.id } });
  const memoryCountAfterDelete = await (db as any).aIMemory.count({ where: { userId: user.id } });
  const warningCountAfterDelete = await (db as any).aIWarning.count({ where: { userId: user.id } });
  if (memoryCountAfterDelete !== 0 || warningCountAfterDelete !== 0) {
    throw new Error("AI memory or warning was not deleted when user was removed");
  }
  console.log("✔ Deleting user cascaded warnings and memories");

  console.log("✅ Smoke test completed successfully.");
}

main()
  .catch((error) => {
    console.error("⚠️ Smoke test failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
