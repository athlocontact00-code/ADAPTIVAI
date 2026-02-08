import {
  PrismaClient,
  DiaryVisibility,
  PerceivedDifficulty,
  FeltVsPlanned,
  MuscleSoreness as PrismaMuscleSoreness,
} from "@prisma/client";
import { hash } from "bcryptjs";
import {
  calculateReadinessScore,
  mapScoreToDecision,
  type MuscleSoreness as ServiceMuscleSoreness,
} from "../lib/services/daily-checkin.service";
import { QUOTES } from "./quotes-data";

const prisma = new PrismaClient();

const workoutTypes = ["run", "bike", "swim", "strength", "other"];

function randomBetween(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function formatLocalDateInput(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

async function main() {
  console.log("🌱 Starting seed...");

  // Quotes: upsert so seed is idempotent and safe to run on production
  console.log("📝 Seeding quotes (upsert)...");
  for (const q of QUOTES) {
    await prisma.quote.upsert({
      where: {
        text_author: { text: q.text, author: q.author },
      },
      create: {
        text: q.text,
        author: q.author,
        category: q.category,
        source: q.source ?? null,
        tone: q.tone ?? null,
      },
      update: {},
    });
  }
  console.log(`✅ Upserted ${QUOTES.length} motivational quotes`);

  const isProduction = process.env.NODE_ENV === "production";
  if (isProduction) {
    console.log("⏭️ Production: skipping demo user and demo data.");
    console.log("\n🎉 Quote seed completed.");
    return;
  }

  // Create demo user
  console.log("👤 Creating demo user...");
  const existingUser = await prisma.user.findUnique({
    where: { email: "demo@adaptivai.app" },
  });

  if (existingUser) {
    await prisma.generatedReport.deleteMany({ where: { userId: existingUser.id } });
    await prisma.journalInsight.deleteMany({ where: { userId: existingUser.id } });
    await prisma.metricDaily.deleteMany({ where: { userId: existingUser.id } });
    await prisma.diaryEntry.deleteMany({ where: { userId: existingUser.id } });
    await prisma.workout.deleteMany({ where: { userId: existingUser.id } });
    await prisma.profile.deleteMany({ where: { userId: existingUser.id } });
    await prisma.user.delete({ where: { id: existingUser.id } });
  }

  const passwordHash = await hash("Demo1234!", 12);
  const user = await prisma.user.create({
    data: {
      email: "demo@adaptivai.app",
      name: "Demo Athlete",
      passwordHash,
      onboardingDone: true,
    },
  });

  // Create profile
  await prisma.profile.create({
    data: {
      userId: user.id,
      sportPrimary: "running",
      experienceLevel: "intermediate",
      weeklyHoursGoal: 8,
      restingHR: 55,
      maxHR: 185,
      ftp: 250,
      weight: 70,
      height: 175,
      zone1Min: 100,
      zone1Max: 120,
      zone2Min: 120,
      zone2Max: 140,
      zone3Min: 140,
      zone3Max: 160,
      zone4Min: 160,
      zone4Max: 175,
      zone5Min: 175,
      zone5Max: 185,
    },
  });
  console.log("✅ Created demo user: demo@adaptivai.app / Demo1234!");

  // Create workouts - 30 completed + 14 planned
  console.log("🏃 Creating workouts...");
  const today = new Date();
  today.setHours(12, 0, 0, 0);

  const workouts = [];

  // Past workouts (30 days of completed workouts)
  for (let i = 30; i >= 1; i--) {
    const date = addDays(today, -i);
    const hasWorkout = Math.random() > 0.3; // 70% chance of workout

    if (hasWorkout) {
      const type = workoutTypes[randomBetween(0, 3)];
      const duration = randomBetween(30, 120);
      const tss = Math.round(duration * (0.5 + Math.random() * 0.5));

      workouts.push({
        userId: user.id,
        title: `${type.charAt(0).toUpperCase() + type.slice(1)} - ${date.toLocaleDateString("en-US", { weekday: "short" })}`,
        type,
        date,
        planned: false,
        completed: true,
        durationMin: duration,
        distanceKm: type === "run" ? Math.round(duration / 6 * 10) / 10 : type === "bike" ? Math.round(duration / 3 * 10) / 10 : null,
        avgHR: randomBetween(130, 165),
        maxHR: randomBetween(165, 185),
        tss,
        calories: Math.round(duration * 8 + Math.random() * 200),
      });
    }
  }

  // Future planned workouts (14 days) - some AI-generated
  const aiReasons = [
    "Easy effort to start the week",
    "Quality session: high-intensity intervals for speed development",
    "Recovery session after hard day",
    "Moderate intensity: threshold work for lactate clearing",
    "Easy effort before long session",
    "Long session for aerobic development",
    "Strength session for injury prevention",
  ];
  
  for (let i = 1; i <= 14; i++) {
    const date = addDays(today, i);
    const hasWorkout = Math.random() > 0.4; // 60% chance

    if (hasWorkout) {
      const type = workoutTypes[randomBetween(0, 3)];
      const duration = randomBetween(45, 90);
      const isAiGenerated = i <= 7; // First 7 days are AI-generated

      workouts.push({
        userId: user.id,
        title: isAiGenerated 
          ? `${type === "run" ? "Easy Run" : type === "bike" ? "Endurance Ride" : type === "swim" ? "Swim Technique" : "Strength Session"}`
          : `Planned ${type.charAt(0).toUpperCase() + type.slice(1)}`,
        type,
        date,
        planned: true,
        completed: false,
        durationMin: duration,
        tss: isAiGenerated ? Math.round(duration * 0.8) : null,
        aiGenerated: isAiGenerated,
        aiReason: isAiGenerated ? aiReasons[randomBetween(0, aiReasons.length - 1)] : null,
        aiConfidence: isAiGenerated ? randomBetween(80, 95) : null,
        source: isAiGenerated ? "rules" : null,
      });
    }
  }

  await prisma.workout.createMany({ data: workouts });
  console.log(`✅ Created ${workouts.length} workouts (some AI-generated)`);

  // Create 56 days of metrics with readiness, fatigue, and load tracking
  console.log("📊 Creating daily metrics with readiness & fatigue...");
  const metrics = [];
  let ctl = 40;
  let atl = 35;
  const weeklyLoads: number[] = [];

  // Fatigue types to simulate
  const fatigueTypes = ["NONE", "NONE", "NONE", "MUSCULAR", "CNS", "PSYCHOLOGICAL", "METABOLIC"];

  for (let i = 56; i >= 0; i--) {
    const date = addDays(today, -i);
    const dayWorkouts = workouts.filter(
      (w) => w.completed && w.date.toDateString() === date.toDateString()
    );
    const dayTSS = dayWorkouts.reduce((sum, w) => sum + (w.tss || 0), 0);
    const dayDuration = dayWorkouts.reduce((sum, w) => sum + (w.durationMin || 0), 0);

    // CTL = 42-day exponential moving average of TSS
    ctl = ctl + (dayTSS - ctl) / 42;
    // ATL = 7-day exponential moving average of TSS
    atl = atl + (dayTSS - atl) / 7;
    // TSB = CTL - ATL
    const tsb = ctl - atl;
    
    // Track weekly loads for ramp rate calculation
    weeklyLoads.push(dayTSS);
    if (weeklyLoads.length > 14) weeklyLoads.shift();
    
    const currentWeekLoad = weeklyLoads.slice(-7).reduce((a, b) => a + b, 0);
    const prevWeekLoad = weeklyLoads.slice(0, 7).reduce((a, b) => a + b, 0);
    const rampRate = prevWeekLoad > 0 ? ((currentWeekLoad - prevWeekLoad) / prevWeekLoad) * 100 : 0;
    
    // Determine ramp status
    let rampStatus = "SAFE";
    if (rampRate > 22) rampStatus = "DANGER";
    else if (rampRate > 15) rampStatus = "WARNING";

    // Readiness score based on TSB and randomness
    const readinessScore = Math.min(100, Math.max(0, Math.round(50 + tsb * 2 + randomBetween(-10, 10))));
    
    // Determine readiness status
    let readinessStatus: string;
    if (readinessScore >= 70) readinessStatus = "OPTIMAL";
    else if (readinessScore >= 45) readinessStatus = "CAUTION";
    else readinessStatus = "FATIGUED";

    // Simulate fatigue type - more likely when readiness is low
    let fatigueType = "NONE";
    if (readinessScore < 50) {
      // Create CNS fatigue period around day 20-25
      if (i >= 20 && i <= 25) {
        fatigueType = "CNS";
      }
      // Create muscular fatigue period around day 10-15
      else if (i >= 10 && i <= 15) {
        fatigueType = "MUSCULAR";
      }
      // Random fatigue for other low readiness days
      else if (Math.random() > 0.6) {
        fatigueType = fatigueTypes[randomBetween(3, 6)];
      }
    }

    // Create readiness factors
    const factors: Record<string, number> = {};
    if (tsb > 5) factors["training_balance"] = Math.round(tsb * 0.8);
    else if (tsb < -5) factors["training_balance"] = Math.round(tsb * 0.8);
    factors["sleep_quality"] = randomBetween(-8, 8);
    factors["soreness"] = randomBetween(-6, 4);

    // Create fatigue reasons
    const fatigueReasons: Record<string, number> = {};
    if (fatigueType === "CNS") {
      fatigueReasons["Persistent fatigue over multiple days"] = 30;
      fatigueReasons["Poor sleep quality affecting neural recovery"] = 25;
    } else if (fatigueType === "MUSCULAR") {
      fatigueReasons["Significant muscle soreness"] = 35;
      fatigueReasons["High acute training load"] = 25;
    } else if (fatigueType === "PSYCHOLOGICAL") {
      fatigueReasons["Low mood"] = 30;
      fatigueReasons["High stress levels"] = 25;
    }

    // Compliance calculation
    const recentCompleted = workouts.filter(w => {
      const wDate = new Date(w.date);
      const daysDiff = Math.floor((date.getTime() - wDate.getTime()) / (1000 * 60 * 60 * 24));
      return daysDiff >= 0 && daysDiff < 14 && w.completed;
    }).length;
    const recentPlanned = workouts.filter(w => {
      const wDate = new Date(w.date);
      const daysDiff = Math.floor((date.getTime() - wDate.getTime()) / (1000 * 60 * 60 * 24));
      return daysDiff >= 0 && daysDiff < 14 && (w.planned || w.completed);
    }).length;
    const completionRate = recentPlanned > 0 ? Math.round((recentCompleted / recentPlanned) * 100) : 100;
    
    // Simulate compliance variations
    let complianceScore: number;
    let complianceStatus: string;
    
    // Days 5-10 ago: simulate a slipping period
    if (i >= 5 && i <= 10) {
      complianceScore = randomBetween(40, 55);
      complianceStatus = "SLIPPING";
    }
    // Days 18-22 ago: simulate a fragile period
    else if (i >= 18 && i <= 22) {
      complianceScore = randomBetween(25, 40);
      complianceStatus = "FRAGILE";
    } else {
      complianceScore = randomBetween(65, 90);
      complianceStatus = "STRONG";
    }
    
    const currentStreak = i < 3 ? randomBetween(3, 7) : randomBetween(0, 5);
    
    // Burnout calculation
    let burnoutRisk: number;
    let burnoutStatus: string;
    const burnoutDrivers: Record<string, number> = {};
    
    // Days 20-25 ago: high burnout period (matches CNS fatigue)
    if (i >= 20 && i <= 25) {
      burnoutRisk = randomBetween(55, 75);
      burnoutStatus = "HIGH";
      burnoutDrivers["persistent_low_mood"] = 20;
      burnoutDrivers["fatigue_type"] = 20;
      burnoutDrivers["low_compliance"] = 15;
    }
    // Days 10-15 ago: moderate burnout (matches muscular fatigue)
    else if (i >= 10 && i <= 15) {
      burnoutRisk = randomBetween(35, 50);
      burnoutStatus = "MODERATE";
      burnoutDrivers["high_soreness"] = 15;
      burnoutDrivers["slipping_compliance"] = 10;
    } else {
      burnoutRisk = randomBetween(5, 25);
      burnoutStatus = "LOW";
    }

    metrics.push({
      userId: user.id,
      date,
      ctl: Math.round(ctl * 10) / 10,
      atl: Math.round(atl * 10) / 10,
      tsb: Math.round(tsb * 10) / 10,
      tss: dayTSS,
      duration: dayDuration,
      readinessScore,
      readinessStatus,
      readinessFactorsJson: JSON.stringify(factors),
      readinessConfidence: randomBetween(70, 95),
      fatigueType,
      fatigueReasonsJson: Object.keys(fatigueReasons).length > 0 ? JSON.stringify(fatigueReasons) : null,
      weeklyLoad: currentWeekLoad,
      rampRate: Math.round(rampRate * 10) / 10,
      rampStatus,
      complianceScore,
      complianceStatus,
      complianceReasonsJson: JSON.stringify({ completion_rate: completionRate }),
      plannedWorkouts: recentPlanned,
      completedWorkouts: recentCompleted,
      currentStreak,
      burnoutRisk,
      burnoutStatus,
      burnoutDriversJson: Object.keys(burnoutDrivers).length > 0 ? JSON.stringify(burnoutDrivers) : null,
    });
  }

  await prisma.metricDaily.createMany({ data: metrics });
  console.log(`✅ Created ${metrics.length} daily metrics with readiness, fatigue, compliance & burnout`);

  // Create diary entries (14 entries over last 30 days)
  console.log("📓 Creating diary entries...");
  const diaryDates = new Set<string>();
  while (diaryDates.size < 14) {
    const daysAgo = randomBetween(0, 29);
    diaryDates.add(daysAgo.toString());
  }

  const diaryEntries = Array.from(diaryDates).map((daysAgoStr) => {
    const daysAgo = parseInt(daysAgoStr);
    const date = addDays(today, -daysAgo);
    
    // Create patterns for AI to detect
    let mood = randomBetween(2, 5);
    let energy = randomBetween(2, 5);
    let stress = randomBetween(1, 4);
    let motivation = randomBetween(2, 5);
    const sleepQual = randomBetween(2, 5);
    let notes: string | null = null;
    const aiUsedForTraining = daysAgo > 3; // Older entries marked as used
    
    // Days 0-2: Create a negative streak pattern
    if (daysAgo <= 2) {
      mood = randomBetween(1, 2);
      energy = randomBetween(1, 2);
      motivation = randomBetween(1, 2);
      stress = randomBetween(4, 5);
      notes = daysAgo === 0 ? "Really struggling today, feeling overwhelmed" : 
              daysAgo === 1 ? "Not great, work stress carrying over" : 
              "Low energy, didn't sleep well";
    }
    // Days 5-7: Burnout signal pattern
    else if (daysAgo >= 5 && daysAgo <= 7) {
      stress = randomBetween(4, 5);
      energy = randomBetween(1, 2);
      motivation = randomBetween(2, 3);
      notes = "Feeling burnt out, need a break";
    }
    // Days 10-12: Good period
    else if (daysAgo >= 10 && daysAgo <= 12) {
      mood = randomBetween(4, 5);
      energy = randomBetween(4, 5);
      motivation = randomBetween(4, 5);
      stress = randomBetween(1, 2);
      notes = "Great training week!";
    }
    
    // Some entries with different visibility levels
    let visibilityLevel: DiaryVisibility = DiaryVisibility.FULL_AI_ACCESS;
    if (daysAgo === 4) {
      visibilityLevel = DiaryVisibility.METRICS_ONLY;
      notes = "Personal stuff going on, don't want AI to read this";
    }
    if (daysAgo === 8) {
      visibilityLevel = DiaryVisibility.HIDDEN;
      notes = "Private entry";
    }
    
    return {
      userId: user.id,
      date,
      mood,
      energy,
      sleepHrs: 6 + Math.random() * 3,
      sleepQual,
      stress,
      soreness: randomBetween(1, 4),
      motivation,
      notes,
      visibilityLevel,
      aiUsedForTraining,
      aiUsedAt: aiUsedForTraining ? addDays(date, 1) : null,
    };
  });

  await prisma.diaryEntry.createMany({ data: diaryEntries });
  console.log(`✅ Created ${diaryEntries.length} diary entries with AI access controls`);

  // Create a PlanGenerationLog entry
  console.log("🤖 Creating AI plan generation log...");
  const planStartDate = addDays(today, 1);
  const planEndDate = addDays(today, 7);
  
  await prisma.planGenerationLog.create({
    data: {
      userId: user.id,
      startDate: planStartDate,
      endDate: planEndDate,
      summaryMd: `## 7-Day Training Plan

**${planStartDate.toLocaleDateString("en-US", { month: "short", day: "numeric" })} - ${planEndDate.toLocaleDateString("en-US", { month: "short", day: "numeric" })}**

**Sport:** Running | **Total Volume:** 6h 30m | **Est. TSS:** 320

### Workout Schedule

- **Mon:** Easy Run (45min) 🟢
- **Tue:** Interval Training (50min) 🔴
- **Wed:** Recovery Run (30min) 🟢
- **Thu:** Tempo Run (45min) 🟡
- **Fri:** Easy Run (45min) 🟢
- **Sat:** Long Run (90min) 🟢

---
*Generated by AdaptivAI Rules Engine*`,
      constraintsJson: JSON.stringify({
        sport: "running",
        experienceLevel: "intermediate",
        weeklyHoursGoal: 8,
        lastWeekTss: 280,
        targetWeekTss: 308,
        maxAllowedTss: 322,
      }),
      warningsJson: null,
    },
  });
  console.log("✅ Created AI plan generation log");

  // Create a daily insight for today
  console.log("💡 Creating daily insight...");
  await prisma.dailyInsight.create({
    data: {
      userId: user.id,
      date: today,
      insightText: "You're on a 5-day streak! Consistency compounds. You're building something sustainable.",
      insightType: "motivation",
      driversJson: JSON.stringify([
        { factor: "streak", value: 5 },
        { factor: "compliance_status", value: "STRONG" },
      ]),
    },
  });
  console.log("✅ Created daily insight");

  // ============================================
  // PHASE E-1: Season, Blocks, Races, PBs, Injuries, Reports
  // ============================================

  // Create Season (14 weeks leading to goal race)
  console.log("🏆 Creating season and training blocks...");
  const goalRaceDate = addDays(today, 56); // 8 weeks from now
  const seasonStart = addDays(today, -42); // Started 6 weeks ago
  const seasonEnd = addDays(goalRaceDate, 7); // Week after race

  const season = await prisma.season.create({
    data: {
      userId: user.id,
      name: "2026 Half Marathon Prep",
      startDate: seasonStart,
      endDate: seasonEnd,
      primaryGoal: "Sub 1:45 Half Marathon",
    },
  });

  // Create Training Blocks
  const blocks = [
    {
      type: "BASE",
      startDate: seasonStart,
      endDate: addDays(seasonStart, 27), // 4 weeks
      focus: "Aerobic foundation, easy running, consistency",
      targetHours: 6,
    },
    {
      type: "BUILD",
      startDate: addDays(seasonStart, 28),
      endDate: addDays(seasonStart, 48), // 3 weeks
      focus: "Tempo runs, threshold work, race pace intervals",
      targetHours: 8,
    },
    {
      type: "PEAK",
      startDate: addDays(seasonStart, 49),
      endDate: addDays(goalRaceDate, -15), // 2 weeks
      focus: "Race simulation, sharpening, confidence builders",
      targetHours: 9,
    },
    {
      type: "TAPER",
      startDate: addDays(goalRaceDate, -14),
      endDate: addDays(goalRaceDate, -1),
      focus: "Volume reduction, freshness, mental prep",
      targetHours: 4,
    },
    {
      type: "RECOVERY",
      startDate: goalRaceDate,
      endDate: seasonEnd,
      focus: "Active recovery, reflection, next goals",
      targetHours: 3,
    },
  ];

  for (const block of blocks) {
    await prisma.trainingBlock.create({
      data: {
        seasonId: season.id,
        userId: user.id,
        ...block,
      },
    });
  }
  console.log(`✅ Created season with ${blocks.length} training blocks`);

  // Create Races
  console.log("🏁 Creating race events...");
  await prisma.raceEvent.createMany({
    data: [
      {
        seasonId: season.id,
        userId: user.id,
        name: "City Half Marathon",
        date: goalRaceDate,
        distance: "Half Marathon",
        priority: "A",
        goalTime: "1:45:00",
        notes: "Main goal race of the season",
      },
      {
        seasonId: season.id,
        userId: user.id,
        name: "Spring 10K",
        date: addDays(today, 21),
        distance: "10K",
        priority: "B",
        goalTime: "42:00",
        notes: "Tune-up race, test race pace",
      },
    ],
  });
  console.log("✅ Created 2 race events");

  // Create Personal Bests
  console.log("🥇 Creating personal bests...");
  await prisma.personalBest.createMany({
    data: [
      {
        userId: user.id,
        sport: "RUN",
        discipline: "5k",
        valueNumber: 1230, // 20:30
        valueUnit: "s",
        date: addDays(today, -60),
        source: "WORKOUT",
        notes: "Park run PB",
      },
      {
        userId: user.id,
        sport: "RUN",
        discipline: "10k",
        valueNumber: 2640, // 44:00
        valueUnit: "s",
        date: addDays(today, -45),
        source: "WORKOUT",
        notes: "Training race",
      },
      {
        userId: user.id,
        sport: "RUN",
        discipline: "Half Marathon",
        valueNumber: 6300, // 1:45:00
        valueUnit: "s",
        date: addDays(today, -180),
        source: "WORKOUT",
        notes: "Previous season goal race",
      },
      {
        userId: user.id,
        sport: "BIKE",
        discipline: "FTP",
        valueNumber: 245,
        valueUnit: "w",
        date: addDays(today, -30),
        source: "TEST",
        notes: "20min test",
      },
      {
        userId: user.id,
        sport: "STRENGTH",
        discipline: "1RM Squat",
        valueNumber: 100,
        valueUnit: "kg",
        date: addDays(today, -90),
        source: "TEST",
      },
      {
        userId: user.id,
        sport: "SWIM",
        discipline: "400m Freestyle",
        valueNumber: 420, // 7:00
        valueUnit: "s",
        date: addDays(today, -120),
        source: "WORKOUT",
      },
    ],
  });
  console.log("✅ Created 6 personal bests");

  // Create Injury Event (resolved)
  console.log("🩹 Creating injury history...");
  await prisma.injuryEvent.create({
    data: {
      userId: user.id,
      startDate: addDays(today, -75),
      endDate: addDays(today, -60),
      area: "Left knee",
      severity: "MODERATE",
      status: "RESOLVED",
      notes: "IT band syndrome - resolved with PT and foam rolling",
    },
  });
  console.log("✅ Created injury event");

  // Create Weekly Reports (last 6 weeks)
  console.log("📊 Creating weekly reports...");
  await prisma.generatedReport.deleteMany({ where: { userId: user.id } });
  for (let w = 1; w <= 6; w++) {
    const weekStart = addDays(today, -w * 7);
    weekStart.setHours(0, 0, 0, 0);
    const weekEnd = addDays(weekStart, 6);
    weekEnd.setHours(23, 59, 59, 999);

    const totalDuration = 300 + randomBetween(-50, 100);
    const totalTSS = 250 + randomBetween(-50, 100);
    const sessionsCount = randomBetween(4, 6);
    const avgReadiness = randomBetween(55, 85);
    const compliance = randomBetween(70, 95);

    await prisma.generatedReport.create({
      data: {
        userId: user.id,
        type: "WEEKLY",
        periodStart: weekStart,
        periodEnd: weekEnd,
        title: `Week of ${weekStart.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`,
        summaryMd: `## Weekly Summary
**${weekStart.toLocaleDateString("en-US", { month: "short", day: "numeric" })} - ${weekEnd.toLocaleDateString("en-US", { month: "short", day: "numeric" })}**

### Training Volume
- **Duration:** ${Math.floor(totalDuration / 60)}h ${totalDuration % 60}m
- **TSS:** ${totalTSS}
- **Sessions:** ${sessionsCount}

### Recovery & Readiness
- **Avg Readiness:** ${avgReadiness}/100
- **Compliance:** ${compliance}%

### Key Insights
- ${avgReadiness >= 70 ? "Strong readiness this week—good recovery balance" : "Readiness was moderate—monitor fatigue"}
- ${compliance >= 85 ? "Excellent consistency—keep it up" : "Good adherence to plan"}`,
        metricsJson: JSON.stringify({
          totalDuration,
          totalTSS,
          sessionsCount,
          avgReadiness,
          complianceScore: compliance,
        }),
      },
    });
  }
  console.log("✅ Created 6 weekly reports");

  // Create Monthly Reports (last 2 months)
  console.log("📈 Creating monthly reports...");
  for (let m = 1; m <= 2; m++) {
    const monthStart = new Date(today);
    monthStart.setMonth(monthStart.getMonth() - m);
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    
    const monthEnd = new Date(monthStart);
    monthEnd.setMonth(monthEnd.getMonth() + 1);
    monthEnd.setDate(0);
    monthEnd.setHours(23, 59, 59, 999);

    const totalDuration = 1200 + randomBetween(-200, 400);
    const totalTSS = 1000 + randomBetween(-200, 400);
    const sessionsCount = randomBetween(16, 24);
    const avgReadiness = randomBetween(60, 80);
    const compliance = randomBetween(75, 92);

    await prisma.generatedReport.upsert({
      where: {
        userId_type_periodStart: {
          userId: user.id,
          type: "MONTHLY",
          periodStart: monthStart,
        },
      },
      update: {},
      create: {
        userId: user.id,
        type: "MONTHLY",
        periodStart: monthStart,
        periodEnd: monthEnd,
        title: monthStart.toLocaleDateString("en-US", { month: "long", year: "numeric" }),
        summaryMd: `## ${monthStart.toLocaleDateString("en-US", { month: "long", year: "numeric" })} Summary

### Monthly Totals
- **Duration:** ${Math.floor(totalDuration / 60)}h
- **TSS:** ${totalTSS}
- **Sessions:** ${sessionsCount}

### Averages
- **Readiness:** ${avgReadiness}/100
- **Compliance:** ${compliance}%

### Focus Areas for Next Month
- ${m === 1 ? "Continue building aerobic base" : "Transition to race-specific work"}
- Maintain sleep quality for optimal recovery`,
        metricsJson: JSON.stringify({
          totalDuration,
          totalTSS,
          sessionsCount,
          avgReadiness,
          complianceScore: compliance,
        }),
      },
    });
  }
  console.log("✅ Created 2 monthly reports");

  // ============================================
  // PHASE E-2: What-If Simulator Scenarios
  // ============================================
  console.log("🧪 Creating simulation scenarios...");

  // Scenario 1: Aggressive Build (with warnings)
  const aggressiveScenario = await prisma.simulationScenario.create({
    data: {
      userId: user.id,
      name: "Aggressive Build",
      durationWeeks: 8,
      paramsJson: JSON.stringify({
        volumeChange: 25,
        intensityBias: "HIGH",
        recoveryFocus: "NORMAL",
        complianceAssumption: "OPTIMISTIC",
      }),
    },
  });

  // Generate results for aggressive scenario
  const aggressiveResults = [
    { week: 1, ctl: 52, atl: 48, tsb: 4, readiness: 68, burnout: 25, tss: 280, warnings: [] },
    { week: 2, ctl: 55, atl: 52, tsb: 3, readiness: 62, burnout: 35, tss: 310, warnings: ["Week 2: TSS capped from 340 to 310 (ramp limit 10%)"] },
    { week: 3, ctl: 58, atl: 58, tsb: 0, readiness: 55, burnout: 45, tss: 340, warnings: [] },
    { week: 4, ctl: 61, atl: 62, tsb: -1, readiness: 48, burnout: 55, tss: 370, warnings: ["Week 4: Elevated burnout risk (55%). Consider reducing load."] },
    { week: 5, ctl: 64, atl: 68, tsb: -4, readiness: 42, burnout: 65, tss: 400, warnings: ["Week 5: Elevated burnout risk (65%). Consider reducing load."] },
    { week: 6, ctl: 67, atl: 72, tsb: -5, readiness: 38, burnout: 72, tss: 420, warnings: ["Week 6: Elevated burnout risk (72%). Consider reducing load.", "Week 6: TSB critically low (-5). High injury/overtraining risk."] },
    { week: 7, ctl: 69, atl: 75, tsb: -6, readiness: 35, burnout: 78, tss: 440, warnings: ["Week 7: Elevated burnout risk (78%). Consider reducing load."] },
    { week: 8, ctl: 71, atl: 76, tsb: -5, readiness: 38, burnout: 75, tss: 450, warnings: ["Week 8: Elevated burnout risk (75%). Consider reducing load."] },
  ];

  for (const r of aggressiveResults) {
    await prisma.simulationResult.create({
      data: {
        scenarioId: aggressiveScenario.id,
        userId: user.id,
        weekIndex: r.week,
        simulatedCTL: r.ctl,
        simulatedATL: r.atl,
        simulatedTSB: r.tsb,
        simulatedReadinessAvg: r.readiness,
        simulatedBurnoutRisk: r.burnout,
        weeklyTSS: r.tss,
        insightsJson: JSON.stringify([`Week ${r.week}: CTL progressing to ${r.ctl}`]),
        warningsJson: r.warnings.length > 0 ? JSON.stringify(r.warnings) : null,
      },
    });
  }

  // Scenario 2: Balanced Progress (moderate risk)
  const balancedScenario = await prisma.simulationScenario.create({
    data: {
      userId: user.id,
      name: "Balanced Progress",
      durationWeeks: 8,
      paramsJson: JSON.stringify({
        volumeChange: 10,
        intensityBias: "BALANCED",
        recoveryFocus: "NORMAL",
        complianceAssumption: "REALISTIC",
      }),
    },
  });

  const balancedResults = [
    { week: 1, ctl: 51, atl: 45, tsb: 6, readiness: 72, burnout: 20, tss: 260 },
    { week: 2, ctl: 53, atl: 48, tsb: 5, readiness: 70, burnout: 22, tss: 275 },
    { week: 3, ctl: 55, atl: 50, tsb: 5, readiness: 68, burnout: 25, tss: 290 },
    { week: 4, ctl: 57, atl: 52, tsb: 5, readiness: 66, burnout: 28, tss: 305 },
    { week: 5, ctl: 59, atl: 54, tsb: 5, readiness: 65, burnout: 30, tss: 315 },
    { week: 6, ctl: 61, atl: 56, tsb: 5, readiness: 64, burnout: 32, tss: 325 },
    { week: 7, ctl: 62, atl: 57, tsb: 5, readiness: 65, burnout: 30, tss: 330 },
    { week: 8, ctl: 64, atl: 58, tsb: 6, readiness: 68, burnout: 28, tss: 340 },
  ];

  for (const r of balancedResults) {
    await prisma.simulationResult.create({
      data: {
        scenarioId: balancedScenario.id,
        userId: user.id,
        weekIndex: r.week,
        simulatedCTL: r.ctl,
        simulatedATL: r.atl,
        simulatedTSB: r.tsb,
        simulatedReadinessAvg: r.readiness,
        simulatedBurnoutRisk: r.burnout,
        weeklyTSS: r.tss,
        insightsJson: JSON.stringify([`Week ${r.week}: Steady progress, CTL at ${r.ctl}`]),
        warningsJson: null,
      },
    });
  }

  // Scenario 3: Longevity First (safe, low risk)
  const longevityScenario = await prisma.simulationScenario.create({
    data: {
      userId: user.id,
      name: "Longevity First",
      durationWeeks: 12,
      paramsJson: JSON.stringify({
        volumeChange: 0,
        intensityBias: "LOW",
        recoveryFocus: "EXTRA",
        complianceAssumption: "CONSERVATIVE",
      }),
    },
  });

  const longevityResults = [
    { week: 1, ctl: 50, atl: 42, tsb: 8, readiness: 78, burnout: 12 },
    { week: 2, ctl: 50, atl: 43, tsb: 7, readiness: 76, burnout: 14 },
    { week: 3, ctl: 51, atl: 44, tsb: 7, readiness: 75, burnout: 15 },
    { week: 4, ctl: 51, atl: 44, tsb: 7, readiness: 76, burnout: 14 },
    { week: 5, ctl: 52, atl: 45, tsb: 7, readiness: 77, burnout: 13 },
    { week: 6, ctl: 52, atl: 45, tsb: 7, readiness: 78, burnout: 12 },
    { week: 7, ctl: 53, atl: 46, tsb: 7, readiness: 78, burnout: 12 },
    { week: 8, ctl: 53, atl: 46, tsb: 7, readiness: 79, burnout: 11 },
    { week: 9, ctl: 54, atl: 47, tsb: 7, readiness: 79, burnout: 11 },
    { week: 10, ctl: 54, atl: 47, tsb: 7, readiness: 80, burnout: 10 },
    { week: 11, ctl: 55, atl: 48, tsb: 7, readiness: 80, burnout: 10 },
    { week: 12, ctl: 55, atl: 48, tsb: 7, readiness: 81, burnout: 9 },
  ];

  for (const r of longevityResults) {
    await prisma.simulationResult.create({
      data: {
        scenarioId: longevityScenario.id,
        userId: user.id,
        weekIndex: r.week,
        simulatedCTL: r.ctl,
        simulatedATL: r.atl,
        simulatedTSB: r.tsb,
        simulatedReadinessAvg: r.readiness,
        simulatedBurnoutRisk: r.burnout,
        weeklyTSS: 240,
        insightsJson: JSON.stringify([`Week ${r.week}: Sustainable progress, excellent readiness`]),
        warningsJson: null,
      },
    });
  }

  console.log("✅ Created 3 simulation scenarios with results");

  // ============================================
  // ATHLETE SIGNAL ENGINE: Pre-Training Check-Ins
  // ============================================
  console.log("📋 Creating pre-training check-ins...");

  // Get a recent planned workout to attach check-in to
  const recentPlannedWorkout = await prisma.workout.findFirst({
    where: {
      userId: user.id,
      planned: true,
      completed: false,
    },
    orderBy: { date: "desc" },
  });

  if (recentPlannedWorkout) {
    // Create a check-in with AI recommendation
    await prisma.preTrainingCheckIn.create({
      data: {
        userId: user.id,
        workoutId: recentPlannedWorkout.id,
        mood: 3,
        energy: 2, // Low energy triggers AI evaluation
        stress: 4, // High stress
        sorenessAreasJson: JSON.stringify(["hamstring", "lower_back"]),
        notes: "Didn't sleep well last night, feeling a bit off",
        aiDecision: "REDUCE_INTENSITY",
        aiReasonJson: JSON.stringify([
          { factor: "Low energy", impact: "Energy level 2/5 indicates fatigue", weight: 40 },
          { factor: "High stress", impact: "Stress level 4/5 may impair recovery", weight: 35 },
          { factor: "Critical soreness", impact: "Soreness in lower_back requires caution", weight: 20 },
        ]),
        aiConfidence: 85,
        userAccepted: true,
      },
    });

    // Create audit log for the AI adaptation
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        actorUserId: null,
        actionType: "AI_WORKOUT_ADAPTED",
        targetType: "CHECK_IN",
        targetId: recentPlannedWorkout.id,
        summary: `AI recommended: REDUCE_INTENSITY for workout "${recentPlannedWorkout.title}"`,
        detailsJson: JSON.stringify({
          workoutId: recentPlannedWorkout.id,
          workoutTitle: recentPlannedWorkout.title,
          decision: "REDUCE_INTENSITY",
          confidence: 85,
          checkInData: {
            mood: 3,
            energy: 2,
            stress: 4,
            sorenessAreas: ["hamstring", "lower_back"],
          },
        }),
      },
    });
  }

  console.log("✅ Created pre-training check-in with AI recommendation");

  // ============================================
  // POST-TRAINING FEEDBACK SYSTEM
  // ============================================
  console.log("📝 Creating post-workout feedback...");

  // Get completed workouts to attach feedback to
  const completedWorkouts = await prisma.workout.findMany({
    where: {
      userId: user.id,
      completed: true,
    },
    orderBy: { date: "desc" },
    take: 5,
  });

  type SeedFeedbackEntry = {
    perceivedDifficulty: PerceivedDifficulty;
    vsPlanned: FeltVsPlanned;
    enjoyment: number;
    discomfort: PrismaMuscleSoreness;
    mentalState: number;
    painOrDiscomfort: string | null;
    comment: string;
    actualFeel?: number;
    actualAvgHR?: number;
    actualMaxHR?: number;
    actualPaceText?: string;
    actualRpe?: number;
    sessionEquipment?: string;
    sessionTerrain?: string;
    sessionAvailability?: string;
  };

  const feedbackData: SeedFeedbackEntry[] = [
    {
      perceivedDifficulty: PerceivedDifficulty.OK,
      vsPlanned: FeltVsPlanned.SAME,
      enjoyment: 4,
      discomfort: PrismaMuscleSoreness.NONE,
      mentalState: 4,
      painOrDiscomfort: null,
      actualFeel: 4,
      actualAvgHR: 148,
      actualMaxHR: 171,
      actualPaceText: "4:35/km",
      actualRpe: 6,
      sessionEquipment: "Road shoes",
      sessionTerrain: "Flat asphalt",
      sessionAvailability: "Full session",
      comment: "Good session, felt strong throughout.",
    },
    {
      perceivedDifficulty: PerceivedDifficulty.HARD,
      vsPlanned: FeltVsPlanned.HARDER,
      enjoyment: 3,
      discomfort: PrismaMuscleSoreness.MILD,
      mentalState: 3,
      painOrDiscomfort: "Slight tightness in left hamstring",
      actualFeel: 2,
      actualAvgHR: 162,
      actualMaxHR: 182,
      actualPaceText: "4:05/km",
      actualRpe: 9,
      sessionEquipment: "Carbon shoes",
      sessionTerrain: "Track",
      sessionAvailability: "Slept poorly; low energy",
      comment: "Intervals were tougher than expected. Maybe need more recovery.",
    },
    {
      perceivedDifficulty: PerceivedDifficulty.EASY,
      vsPlanned: FeltVsPlanned.EASIER,
      enjoyment: 5,
      discomfort: PrismaMuscleSoreness.NONE,
      mentalState: 5,
      painOrDiscomfort: null,
      actualFeel: 5,
      actualAvgHR: 136,
      actualMaxHR: 154,
      actualPaceText: "5:05/km",
      actualRpe: 3,
      sessionEquipment: "Easy day shoes",
      sessionTerrain: "Park trail",
      sessionAvailability: "Relaxed run; no time pressure",
      comment: "Recovery run felt great. Legs are fresh!",
    },
    {
      perceivedDifficulty: PerceivedDifficulty.BRUTAL,
      vsPlanned: FeltVsPlanned.HARDER,
      enjoyment: 2,
      discomfort: PrismaMuscleSoreness.MODERATE,
      mentalState: 2,
      painOrDiscomfort: "Lower back fatigue, knee discomfort",
      actualFeel: 1,
      actualAvgHR: 168,
      actualMaxHR: 186,
      actualPaceText: "4:20/km",
      actualRpe: 10,
      sessionEquipment: "Old shoes",
      sessionTerrain: "Hilly route + headwind",
      sessionAvailability: "Rushed; limited warm-up",
      comment: "This was way too much. Need to dial back intensity next week.",
    },
    {
      perceivedDifficulty: PerceivedDifficulty.OK,
      vsPlanned: FeltVsPlanned.SAME,
      enjoyment: 4,
      discomfort: PrismaMuscleSoreness.NONE,
      mentalState: 4,
      painOrDiscomfort: null,
      actualFeel: 4,
      actualAvgHR: 152,
      actualMaxHR: 169,
      actualPaceText: "4:45/km",
      actualRpe: 7,
      sessionEquipment: "Road shoes",
      sessionTerrain: "Rolling hills",
      sessionAvailability: "Had 60 minutes only",
      comment: "Solid steady-state session. Hit all targets.",
    },
  ];

  for (let i = 0; i < Math.min(completedWorkouts.length, feedbackData.length); i++) {
    const workout = completedWorkouts[i];
    const feedback = feedbackData[i];

    await prisma.postWorkoutFeedback.create({
      data: {
        userId: user.id,
        workoutId: workout.id,
        perceivedDifficulty: feedback.perceivedDifficulty,
        vsPlanned: feedback.vsPlanned,
        enjoyment: feedback.enjoyment,
        discomfort: feedback.discomfort,
        mentalState: feedback.mentalState,
        painOrDiscomfort: feedback.painOrDiscomfort,
        actualFeel: feedback.actualFeel ?? null,
        actualAvgHR: feedback.actualAvgHR ?? null,
        actualMaxHR: feedback.actualMaxHR ?? null,
        actualPaceText: feedback.actualPaceText ?? null,
        actualRpe: feedback.actualRpe ?? null,
        sessionEquipment: feedback.sessionEquipment ?? null,
        sessionTerrain: feedback.sessionTerrain ?? null,
        sessionAvailability: feedback.sessionAvailability ?? null,
        comment: feedback.comment,
        visibleToAI: true,
        visibleToFuturePlanning: true,
      },
    });
  }

  console.log(`✅ Created ${Math.min(completedWorkouts.length, feedbackData.length)} post-workout feedback entries`);

  // Create a feedback aggregation for the current week
  const weekStart = new Date();
  weekStart.setDate(weekStart.getDate() - weekStart.getDay() + 1); // Monday
  weekStart.setHours(0, 0, 0, 0);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 7);

  await prisma.feedbackAggregation.create({
    data: {
      userId: user.id,
      weekStart,
      weekEnd,
      totalWorkouts: 5,
      feedbackCount: 5,
      avgEnjoyment: 3.6,
      tooHardCount: 2,
      harderThanPlannedCount: 2,
      easierThanPlannedCount: 1,
      painReportedCount: 2,
      intensityAdjustment: -10,
      confidenceImpact: -3,
      toneAdjustment: "CAUTIOUS",
      insightsJson: JSON.stringify([
        "40% of sessions felt too hard - reducing intensity",
        "40% of sessions felt harder than planned - calibration needed",
        "Pain reported in 40% of sessions - prioritizing recovery",
      ]),
    },
  });

  console.log("✅ Created feedback aggregation with AI learning insights");

  // ============================================
  // INTELLIGENT JOURNAL: Insights
  // ============================================
  console.log("🧠 Creating journal insights...");

  // Create a negative streak insight (based on seed data pattern)
  await prisma.journalInsight.create({
    data: {
      userId: user.id,
      type: "NEGATIVE_STREAK",
      severity: "MEDIUM",
      title: "Low mood pattern detected",
      message: "You've had 3 consecutive days with low mood. This is worth paying attention to.",
      suggestion: "Consider a lighter training day or some active recovery. Sometimes a break helps more than pushing through.",
      startDate: addDays(today, -2),
      endDate: today,
      dataPointsJson: JSON.stringify([
        { date: formatLocalDateInput(today), value: 2 },
        { date: formatLocalDateInput(addDays(today, -1)), value: 2 },
        { date: formatLocalDateInput(addDays(today, -2)), value: 1 },
      ]),
    },
  });

  // Create a burnout signal insight
  await prisma.journalInsight.create({
    data: {
      userId: user.id,
      type: "BURNOUT_SIGNAL",
      severity: "HIGH",
      title: "Burnout warning signs",
      message: "3 of your last 7 days show signs of burnout: high stress combined with low energy or motivation.",
      suggestion: "This is your body asking for rest. Consider reducing training volume this week and prioritizing sleep.",
      startDate: addDays(today, -7),
      endDate: addDays(today, -5),
      dataPointsJson: JSON.stringify([
        { date: formatLocalDateInput(addDays(today, -5)), value: 3 },
        { date: formatLocalDateInput(addDays(today, -6)), value: 4 },
        { date: formatLocalDateInput(addDays(today, -7)), value: 3 },
      ]),
    },
  });

  console.log("✅ Created 2 journal insights for pattern detection demo");

  // Create Daily Check-Ins (last 7 days)
  console.log("📋 Creating daily check-ins...");
  await prisma.dailyCheckIn.deleteMany({ where: { userId: user.id } });
  
  for (let d = 7; d >= 1; d--) {
    const checkInDate = addDays(today, -d);
    checkInDate.setHours(0, 0, 0, 0);
    
    // Vary the check-in data to create realistic patterns
    const sleepDuration = 6 + Math.random() * 2.5; // 6-8.5 hours
    const sleepQuality = d > 4 ? randomBetween(2, 4) : randomBetween(3, 5);
    const physicalFatigue = d > 5 ? randomBetween(3, 5) : randomBetween(1, 3);
    const mentalReadiness = randomBetween(2, 5);
    const motivation = d > 4 ? randomBetween(2, 4) : randomBetween(3, 5);
    const stressLevel = d > 5 ? randomBetween(3, 5) : randomBetween(1, 3);
    const sorenessOptions: PrismaMuscleSoreness[] = [
      PrismaMuscleSoreness.NONE,
      PrismaMuscleSoreness.MILD,
      PrismaMuscleSoreness.MODERATE,
      PrismaMuscleSoreness.SEVERE,
    ];
    const muscleSoreness = sorenessOptions[randomBetween(0, d > 5 ? 3 : 2)];
    const readinessScore = calculateReadinessScore({
      sleepDuration,
      sleepQuality,
      physicalFatigue,
      mentalReadiness,
      motivation,
      muscleSoreness: muscleSoreness as unknown as ServiceMuscleSoreness,
      stressLevel,
    });
    const aiDecision = mapScoreToDecision(readinessScore);
    
    await prisma.dailyCheckIn.create({
      data: {
        userId: user.id,
        date: checkInDate,
        sleepDuration: Math.round(sleepDuration * 10) / 10,
        sleepQuality,
        physicalFatigue,
        mentalReadiness,
        motivation,
        muscleSoreness,
        stressLevel,
        readinessScore,
        notes: d === 3 ? "Feeling a bit tired after yesterday's long run" : null,
        mood: mentalReadiness,
        energy: 6 - physicalFatigue,
        aiDecision,
        aiConfidence: randomBetween(75, 95),
        aiExplanation: aiDecision === "PROCEED" 
          ? "You're in good shape for today's workout. Let's make the most of it!"
          : aiDecision === "REDUCE_INTENSITY"
          ? "I'd suggest dialing back the intensity a bit today to respect your body's signals."
          : aiDecision === "SHORTEN"
          ? "Let's make today a shorter session to prevent overreaching."
          : aiDecision === "SWAP_RECOVERY"
          ? "Today might be better as a recovery day. Light activity will help you bounce back faster."
          : "I'm recommending a rest day today. Your body needs recovery.",
        userAccepted: true,
        lockedAt: new Date(),
      },
    });
  }
  console.log("✅ Created 7 daily check-ins with AI decisions");

  console.log("\n🎉 Seed completed successfully!");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("Demo credentials:");
  console.log("  Email: demo@adaptivai.app");
  console.log("  Password: Demo1234!");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
