import { Profile, Workout, MetricDaily } from "@prisma/client";
import { addDays, getDateKey } from "@/lib/utils";
import type { FeedbackPatterns } from "@/lib/actions/workout-feedback";

export interface AthleteContext {
  profile: Profile | null;
  recentWorkouts: Workout[];
  recentMetrics: MetricDaily[];
  weeklyHoursGoal: number;
  sport: string;
  experienceLevel: string;
  avgCheckInReadiness?: number | null;
  feedbackPatterns?: FeedbackPatterns;
}

export interface PlannedWorkout {
  title: string;
  type: string;
  date: Date;
  durationMin: number;
  intensity: "easy" | "moderate" | "hard" | "recovery";
  aiReason: string;
  aiConfidence: number;
  estimatedTss: number;
}

export interface PlanGenerationResult {
  workouts: PlannedWorkout[];
  startDate: Date;
  endDate: Date;
  summaryMd: string;
  constraints: Record<string, unknown>;
  warnings: string[];
}

const WORKOUT_TEMPLATES: Record<string, Record<string, { title: string; type: string; intensity: "easy" | "moderate" | "hard" | "recovery"; baseDuration: number; tssPerMin: number }>> = {
  running: {
    easy: { title: "Easy Run", type: "run", intensity: "easy", baseDuration: 45, tssPerMin: 0.8 },
    intervals: { title: "Interval Training", type: "run", intensity: "hard", baseDuration: 50, tssPerMin: 1.4 },
    tempo: { title: "Tempo Run", type: "run", intensity: "moderate", baseDuration: 45, tssPerMin: 1.1 },
    long: { title: "Long Run", type: "run", intensity: "easy", baseDuration: 90, tssPerMin: 0.9 },
    recovery: { title: "Recovery Run", type: "run", intensity: "recovery", baseDuration: 30, tssPerMin: 0.5 },
  },
  cycling: {
    easy: { title: "Endurance Ride", type: "bike", intensity: "easy", baseDuration: 60, tssPerMin: 0.7 },
    vo2: { title: "VO2max Intervals", type: "bike", intensity: "hard", baseDuration: 60, tssPerMin: 1.5 },
    threshold: { title: "Threshold Ride", type: "bike", intensity: "moderate", baseDuration: 60, tssPerMin: 1.2 },
    long: { title: "Long Ride", type: "bike", intensity: "easy", baseDuration: 120, tssPerMin: 0.8 },
    recovery: { title: "Recovery Spin", type: "bike", intensity: "recovery", baseDuration: 40, tssPerMin: 0.4 },
  },
  triathlon: {
    easy_run: { title: "Easy Run", type: "run", intensity: "easy", baseDuration: 40, tssPerMin: 0.8 },
    easy_bike: { title: "Endurance Ride", type: "bike", intensity: "easy", baseDuration: 60, tssPerMin: 0.7 },
    swim: { title: "Swim Technique", type: "swim", intensity: "moderate", baseDuration: 45, tssPerMin: 0.9 },
    intervals: { title: "Run Intervals", type: "run", intensity: "hard", baseDuration: 45, tssPerMin: 1.4 },
    long_bike: { title: "Long Ride", type: "bike", intensity: "easy", baseDuration: 90, tssPerMin: 0.8 },
    brick: { title: "Brick (Bike+Run)", type: "bike", intensity: "moderate", baseDuration: 75, tssPerMin: 1.0 },
  },
  swimming: {
    easy: { title: "Easy Swim", type: "swim", intensity: "easy", baseDuration: 45, tssPerMin: 0.7 },
    intervals: { title: "Swim Intervals", type: "swim", intensity: "hard", baseDuration: 50, tssPerMin: 1.3 },
    technique: { title: "Technique Focus", type: "swim", intensity: "moderate", baseDuration: 45, tssPerMin: 0.8 },
    endurance: { title: "Endurance Swim", type: "swim", intensity: "easy", baseDuration: 60, tssPerMin: 0.8 },
  },
  strength: {
    full_body: { title: "Full Body Strength", type: "strength", intensity: "moderate", baseDuration: 45, tssPerMin: 0.9 },
    upper: { title: "Upper Body", type: "strength", intensity: "moderate", baseDuration: 40, tssPerMin: 0.8 },
    lower: { title: "Lower Body", type: "strength", intensity: "moderate", baseDuration: 40, tssPerMin: 0.8 },
    core: { title: "Core & Stability", type: "strength", intensity: "easy", baseDuration: 30, tssPerMin: 0.6 },
  },
};

function getStartDate(): Date {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dayOfWeek = today.getDay();
  
  if (dayOfWeek === 0) {
    return addDays(today, 1);
  }
  return addDays(today, 1);
}

function calculateLastWeekLoad(workouts: Workout[]): number {
  const today = new Date();
  const sevenDaysAgo = addDays(today, -7);
  
  return workouts
    .filter(w => {
      const workoutDate = new Date(w.date);
      return workoutDate >= sevenDaysAgo && workoutDate < today && w.completed;
    })
    .reduce((sum, w) => sum + (w.tss || Math.round((w.durationMin || 0) * 0.8)), 0);
}

function getTemplatesForSport(sport: string): typeof WORKOUT_TEMPLATES.running {
  const normalizedSport = sport?.toLowerCase() || "running";
  return WORKOUT_TEMPLATES[normalizedSport] || WORKOUT_TEMPLATES.running;
}

function adjustDurationForLevel(baseDuration: number, level: string): number {
  switch (level?.toLowerCase()) {
    case "beginner":
      return Math.round(baseDuration * 0.7);
    case "intermediate":
      return baseDuration;
    case "advanced":
      return Math.round(baseDuration * 1.15);
    case "expert":
      return Math.round(baseDuration * 1.3);
    default:
      return baseDuration;
  }
}

function adjustDurationForGoal(baseDuration: number, weeklyHoursGoal: number): number {
  if (weeklyHoursGoal <= 5) {
    return Math.round(baseDuration * 0.8);
  } else if (weeklyHoursGoal >= 12) {
    return Math.round(baseDuration * 1.2);
  }
  return baseDuration;
}

export function generateWeeklyPlan(context: AthleteContext): PlanGenerationResult {
  const warnings: string[] = [];
  const startDate = getStartDate();
  const endDate = addDays(startDate, 6);
  
  const sport = context.sport || "running";
  const level = context.experienceLevel || "intermediate";
  const weeklyHoursGoal = context.weeklyHoursGoal || 6;
  
  const templates = getTemplatesForSport(sport);
  const lastWeekTss = calculateLastWeekLoad(context.recentWorkouts);
  const readinessPenalty =
    typeof context.avgCheckInReadiness === "number" && context.avgCheckInReadiness < 55 ? 0.9 : 1;
  if (readinessPenalty < 1) {
    warnings.push("Recent check-ins suggest lower readiness; plan has been kept conservative.");
  }

  const tooHardRatio =
    context.feedbackPatterns && context.feedbackPatterns.totalFeedback > 0
      ? context.feedbackPatterns.tooHardCount / context.feedbackPatterns.totalFeedback
      : 0;
  const feedbackPenalty = tooHardRatio >= 0.4 ? 0.9 : 1;
  if (feedbackPenalty < 1) {
    warnings.push("Recent workout feedback indicates sessions felt too hard; plan has been kept conservative.");
  }

  const penalty = readinessPenalty * feedbackPenalty;
  const targetWeekTss = lastWeekTss > 0 ? Math.round(lastWeekTss * 1.1 * penalty) : Math.round(300 * penalty);
  const maxAllowedTss = lastWeekTss > 0 ? Math.round(lastWeekTss * 1.15 * penalty) : Math.round(400 * penalty);
  
  const workouts: PlannedWorkout[] = [];
  let plannedTss = 0;
  
  const weekStructure = getPolarizedWeekStructure(sport, level, weeklyHoursGoal);
  
  for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
    const date = addDays(startDate, dayOffset);
    const dayOfWeek = date.getDay();
    const dayPlan = weekStructure[dayOfWeek];
    
    if (!dayPlan || dayPlan.type === "off") {
      continue;
    }
    
    const workoutKey = dayPlan.workoutKey || "easy";
    const template = templates[workoutKey] || templates.easy || Object.values(templates)[0];
    if (!template) continue;
    
    let duration = adjustDurationForLevel(template.baseDuration, level);
    duration = adjustDurationForGoal(duration, weeklyHoursGoal);
    
    if (dayPlan.durationMultiplier) {
      duration = Math.round(duration * dayPlan.durationMultiplier);
    }
    
    const estimatedTss = Math.round(duration * template.tssPerMin);
    
    if (plannedTss + estimatedTss > maxAllowedTss && workouts.length >= 3) {
      duration = Math.max(20, Math.round(duration * 0.7));
      warnings.push(`Reduced ${template.title} duration to stay within +15% load increase limit`);
    }
    
    plannedTss += Math.round(duration * template.tssPerMin);
    
    workouts.push({
      title: template.title,
      type: template.type,
      date,
      durationMin: duration,
      intensity: template.intensity,
      aiReason: dayPlan.reason,
      aiConfidence: 85,
      estimatedTss: Math.round(duration * template.tssPerMin),
    });
  }
  
  if (plannedTss > maxAllowedTss && lastWeekTss > 0) {
    warnings.push(`Weekly load (${plannedTss} TSS) exceeds recommended +15% increase. Consider reducing intensity.`);
  }
  
  const summaryMd = generateSummaryMarkdown(workouts, sport, startDate, endDate, warnings);
  
  return {
    workouts,
    startDate,
    endDate,
    summaryMd,
    constraints: {
      sport,
      experienceLevel: level,
      weeklyHoursGoal,
      lastWeekTss,
      targetWeekTss,
      maxAllowedTss,
    },
    warnings,
  };
}

interface DayPlan {
  type: "workout" | "off";
  workoutKey?: string;
  reason: string;
  durationMultiplier?: number;
}

function getPolarizedWeekStructure(
  sport: string,
  level: string,
  weeklyHoursGoal: number
): Record<number, DayPlan> {
  const includeStrength = sport === "strength" || weeklyHoursGoal >= 8;
  const isTriathlon = sport === "triathlon";
  
  if (isTriathlon) {
    return {
      0: { type: "off", reason: "Rest day for recovery" },
      1: { type: "workout", workoutKey: "easy_run", reason: "Start week with easy aerobic run" },
      2: { type: "workout", workoutKey: "swim", reason: "Swim technique and endurance" },
      3: { type: "workout", workoutKey: "intervals", reason: "Quality session: run intervals for speed" },
      4: { type: "workout", workoutKey: "easy_bike", reason: "Easy bike to maintain cycling fitness" },
      5: { type: "workout", workoutKey: "brick", reason: "Brick workout for race simulation" },
      6: { type: "workout", workoutKey: "long_bike", reason: "Long ride for endurance", durationMultiplier: 1.3 },
    };
  }
  
  const baseStructure: Record<number, DayPlan> = {
    0: { type: "off", reason: "Rest day for full recovery" },
    1: { type: "workout", workoutKey: "easy", reason: "Easy effort to start the week" },
    2: { type: "workout", workoutKey: sport === "cycling" ? "vo2" : "intervals", reason: "Quality session: high-intensity intervals" },
    3: { type: "workout", workoutKey: "recovery", reason: "Recovery session after hard day" },
    4: { type: "workout", workoutKey: sport === "cycling" ? "threshold" : "tempo", reason: "Moderate intensity: threshold/tempo work" },
    5: { type: "workout", workoutKey: "easy", reason: "Easy effort before long session" },
    6: { type: "workout", workoutKey: "long", reason: "Long session for aerobic development", durationMultiplier: 1.2 },
  };
  
  if (includeStrength && sport !== "strength") {
    baseStructure[3] = { type: "workout", workoutKey: "full_body", reason: "Strength session for injury prevention" };
  }
  
  if (level === "beginner") {
    baseStructure[3] = { type: "off", reason: "Extra rest day for recovery (beginner)" };
    baseStructure[5] = { type: "off", reason: "Rest before long session" };
  }
  
  if (weeklyHoursGoal <= 4) {
    baseStructure[1] = { type: "off", reason: "Rest day (reduced volume plan)" };
    baseStructure[5] = { type: "off", reason: "Rest day (reduced volume plan)" };
  }
  
  return baseStructure;
}

function generateSummaryMarkdown(
  workouts: PlannedWorkout[],
  sport: string,
  startDate: Date,
  endDate: Date,
  warnings: string[]
): string {
  const totalDuration = workouts.reduce((sum, w) => sum + w.durationMin, 0);
  const totalTss = workouts.reduce((sum, w) => sum + w.estimatedTss, 0);
  const hours = Math.floor(totalDuration / 60);
  const minutes = totalDuration % 60;
  
  const hardSessions = workouts.filter(w => w.intensity === "hard").length;
  const easySessions = workouts.filter(w => w.intensity === "easy" || w.intensity === "recovery").length;
  
  let md = `## 7-Day Training Plan\n\n`;
  md += `**${startDate.toLocaleDateString("en-US", { month: "short", day: "numeric" })} - ${endDate.toLocaleDateString("en-US", { month: "short", day: "numeric" })}**\n\n`;
  md += `**Sport:** ${sport.charAt(0).toUpperCase() + sport.slice(1)}\n`;
  md += `**Total Volume:** ${hours}h ${minutes}m | **Est. TSS:** ${totalTss}\n`;
  md += `**Structure:** ${hardSessions} quality session(s), ${easySessions} easy/recovery session(s)\n\n`;
  
  md += `### Workout Schedule\n\n`;
  
  for (const workout of workouts) {
    const dayName = workout.date.toLocaleDateString("en-US", { weekday: "short" });
    const intensityBadge = workout.intensity === "hard" ? "🔴" : workout.intensity === "moderate" ? "🟡" : "🟢";
    md += `- **${dayName}:** ${workout.title} (${workout.durationMin}min) ${intensityBadge}\n`;
  }
  
  if (warnings.length > 0) {
    md += `\n### ⚠️ Warnings\n\n`;
    for (const warning of warnings) {
      md += `- ${warning}\n`;
    }
  }
  
  md += `\n---\n*Generated by AdaptivAI Rules Engine*`;
  
  return md;
}
