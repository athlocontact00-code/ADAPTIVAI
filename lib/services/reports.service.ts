/**
 * Reports Service
 * Generates weekly and monthly training reports with deterministic logic.
 */

export type ReportType = "WEEKLY" | "MONTHLY";

export interface ReportMetrics {
  totalDuration: number; // minutes
  totalTSS: number;
  sessionsCount: number;
  longestSession: number; // minutes
  avgReadiness: number;
  avgCompliance: number;
  intensityDistribution: {
    easy: number;
    moderate: number;
    hard: number;
  };
  fatigueTypes: Record<string, number>;
  complianceScore: number;
  burnoutRisk: number;
}

export interface WeeklyReportData {
  periodStart: Date;
  periodEnd: Date;
  title: string;
  summaryMd: string;
  metrics: ReportMetrics;
}

export interface MonthlyReportData {
  periodStart: Date;
  periodEnd: Date;
  title: string;
  summaryMd: string;
  metrics: ReportMetrics;
  trends: {
    loadChange: number;
    consistencyChange: number;
    readinessChange: number;
  };
}

export interface WorkoutData {
  date: Date;
  durationMin: number | null;
  tss: number | null;
  type: string;
  completed: boolean;
}

export interface MetricData {
  date: Date;
  readinessScore: number | null;
  complianceScore: number | null;
  fatigueType: string | null;
  burnoutRisk: number | null;
  tss: number | null;
}

/**
 * Generate weekly report from workout and metric data
 */
export function generateWeeklyReport(
  workouts: WorkoutData[],
  metrics: MetricData[],
  weekStart: Date
): WeeklyReportData {
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);
  weekEnd.setHours(23, 59, 59, 999);

  // Filter to this week
  const weekWorkouts = workouts.filter(w => {
    const d = new Date(w.date);
    return d >= weekStart && d <= weekEnd && w.completed;
  });

  const weekMetrics = metrics.filter(m => {
    const d = new Date(m.date);
    return d >= weekStart && d <= weekEnd;
  });

  // Calculate metrics
  const totalDuration = weekWorkouts.reduce((sum, w) => sum + (w.durationMin || 0), 0);
  const totalTSS = weekWorkouts.reduce((sum, w) => sum + (w.tss || 0), 0);
  const sessionsCount = weekWorkouts.length;
  const longestSession = Math.max(...weekWorkouts.map(w => w.durationMin || 0), 0);

  // Intensity distribution (heuristic based on TSS per hour)
  const intensityDistribution = { easy: 0, moderate: 0, hard: 0 };
  for (const w of weekWorkouts) {
    if (!w.durationMin || !w.tss) continue;
    const tssPerHour = (w.tss / w.durationMin) * 60;
    if (tssPerHour < 50) intensityDistribution.easy++;
    else if (tssPerHour < 80) intensityDistribution.moderate++;
    else intensityDistribution.hard++;
  }

  // Readiness and compliance averages
  const readinessScores = weekMetrics.filter(m => m.readinessScore != null).map(m => m.readinessScore!);
  const avgReadiness = readinessScores.length > 0 
    ? Math.round(readinessScores.reduce((a, b) => a + b, 0) / readinessScores.length)
    : 0;

  const complianceScores = weekMetrics.filter(m => m.complianceScore != null).map(m => m.complianceScore!);
  const avgCompliance = complianceScores.length > 0
    ? Math.round(complianceScores.reduce((a, b) => a + b, 0) / complianceScores.length)
    : 0;

  // Fatigue types frequency
  const fatigueTypes: Record<string, number> = {};
  for (const m of weekMetrics) {
    if (m.fatigueType && m.fatigueType !== "NONE") {
      fatigueTypes[m.fatigueType] = (fatigueTypes[m.fatigueType] || 0) + 1;
    }
  }

  // Burnout risk (latest)
  const latestBurnout = weekMetrics
    .filter(m => m.burnoutRisk != null)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
  const burnoutRisk = latestBurnout?.burnoutRisk || 0;

  const reportMetrics: ReportMetrics = {
    totalDuration,
    totalTSS,
    sessionsCount,
    longestSession,
    avgReadiness,
    avgCompliance,
    intensityDistribution,
    fatigueTypes,
    complianceScore: avgCompliance,
    burnoutRisk,
  };

  // Generate summary markdown
  const summaryMd = generateWeeklySummaryMd(weekStart, weekEnd, reportMetrics);

  return {
    periodStart: weekStart,
    periodEnd: weekEnd,
    title: `Week of ${formatDateShort(weekStart)}`,
    summaryMd,
    metrics: reportMetrics,
  };
}

/**
 * Generate monthly report
 */
export function generateMonthlyReport(
  workouts: WorkoutData[],
  metrics: MetricData[],
  monthStart: Date,
  previousMonthMetrics?: ReportMetrics
): MonthlyReportData {
  const monthEnd = new Date(monthStart);
  monthEnd.setMonth(monthEnd.getMonth() + 1);
  monthEnd.setDate(0);
  monthEnd.setHours(23, 59, 59, 999);

  // Filter to this month
  const monthWorkouts = workouts.filter(w => {
    const d = new Date(w.date);
    return d >= monthStart && d <= monthEnd && w.completed;
  });

  const monthMetrics = metrics.filter(m => {
    const d = new Date(m.date);
    return d >= monthStart && d <= monthEnd;
  });

  // Calculate metrics (same as weekly)
  const totalDuration = monthWorkouts.reduce((sum, w) => sum + (w.durationMin || 0), 0);
  const totalTSS = monthWorkouts.reduce((sum, w) => sum + (w.tss || 0), 0);
  const sessionsCount = monthWorkouts.length;
  const longestSession = Math.max(...monthWorkouts.map(w => w.durationMin || 0), 0);

  const intensityDistribution = { easy: 0, moderate: 0, hard: 0 };
  for (const w of monthWorkouts) {
    if (!w.durationMin || !w.tss) continue;
    const tssPerHour = (w.tss / w.durationMin) * 60;
    if (tssPerHour < 50) intensityDistribution.easy++;
    else if (tssPerHour < 80) intensityDistribution.moderate++;
    else intensityDistribution.hard++;
  }

  const readinessScores = monthMetrics.filter(m => m.readinessScore != null).map(m => m.readinessScore!);
  const avgReadiness = readinessScores.length > 0
    ? Math.round(readinessScores.reduce((a, b) => a + b, 0) / readinessScores.length)
    : 0;

  const complianceScores = monthMetrics.filter(m => m.complianceScore != null).map(m => m.complianceScore!);
  const avgCompliance = complianceScores.length > 0
    ? Math.round(complianceScores.reduce((a, b) => a + b, 0) / complianceScores.length)
    : 0;

  const fatigueTypes: Record<string, number> = {};
  for (const m of monthMetrics) {
    if (m.fatigueType && m.fatigueType !== "NONE") {
      fatigueTypes[m.fatigueType] = (fatigueTypes[m.fatigueType] || 0) + 1;
    }
  }

  const latestBurnout = monthMetrics
    .filter(m => m.burnoutRisk != null)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
  const burnoutRisk = latestBurnout?.burnoutRisk || 0;

  const reportMetrics: ReportMetrics = {
    totalDuration,
    totalTSS,
    sessionsCount,
    longestSession,
    avgReadiness,
    avgCompliance,
    intensityDistribution,
    fatigueTypes,
    complianceScore: avgCompliance,
    burnoutRisk,
  };

  // Calculate trends vs previous month
  const trends = {
    loadChange: previousMonthMetrics
      ? ((totalTSS - previousMonthMetrics.totalTSS) / (previousMonthMetrics.totalTSS || 1)) * 100
      : 0,
    consistencyChange: previousMonthMetrics
      ? avgCompliance - previousMonthMetrics.avgCompliance
      : 0,
    readinessChange: previousMonthMetrics
      ? avgReadiness - previousMonthMetrics.avgReadiness
      : 0,
  };

  const summaryMd = generateMonthlySummaryMd(monthStart, monthEnd, reportMetrics, trends);

  return {
    periodStart: monthStart,
    periodEnd: monthEnd,
    title: formatMonthYear(monthStart),
    summaryMd,
    metrics: reportMetrics,
    trends,
  };
}

/**
 * Generate weekly summary markdown
 */
function generateWeeklySummaryMd(weekStart: Date, weekEnd: Date, metrics: ReportMetrics): string {
  const hours = Math.floor(metrics.totalDuration / 60);
  const mins = metrics.totalDuration % 60;
  const durationStr = hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;

  const longestHours = Math.floor(metrics.longestSession / 60);
  const longestMins = metrics.longestSession % 60;
  const longestStr = longestHours > 0 ? `${longestHours}h ${longestMins}m` : `${longestMins}m`;

  const fatigueList = Object.entries(metrics.fatigueTypes)
    .map(([type, count]) => `${type} (${count}d)`)
    .join(", ") || "None detected";

  // Generate insights
  const insights: string[] = [];
  
  if (metrics.avgReadiness >= 70) {
    insights.push("Strong readiness this week—good recovery balance");
  } else if (metrics.avgReadiness < 50) {
    insights.push("Readiness was low—consider more recovery next week");
  }

  if (metrics.complianceScore >= 80) {
    insights.push("Excellent consistency—keep it up");
  } else if (metrics.complianceScore < 60) {
    insights.push("Consistency dropped—simplify the plan if needed");
  }

  if (metrics.burnoutRisk > 50) {
    insights.push("⚠️ Burnout risk elevated—prioritize rest");
  }

  if (metrics.intensityDistribution.hard > metrics.intensityDistribution.easy) {
    insights.push("High intensity ratio—ensure adequate easy days");
  }

  const insightsMd = insights.length > 0
    ? `### Key Insights\n${insights.map(i => `- ${i}`).join("\n")}`
    : "";

  return `## Weekly Summary
**${formatDateShort(weekStart)} - ${formatDateShort(weekEnd)}**

### Training Volume
- **Duration:** ${durationStr}
- **TSS:** ${metrics.totalTSS}
- **Sessions:** ${metrics.sessionsCount}
- **Longest:** ${longestStr}

### Intensity Distribution
- Easy: ${metrics.intensityDistribution.easy} sessions
- Moderate: ${metrics.intensityDistribution.moderate} sessions
- Hard: ${metrics.intensityDistribution.hard} sessions

### Recovery & Readiness
- **Avg Readiness:** ${metrics.avgReadiness}/100
- **Compliance:** ${metrics.complianceScore}%
- **Fatigue:** ${fatigueList}
- **Burnout Risk:** ${metrics.burnoutRisk}/100

${insightsMd}`;
}

/**
 * Generate monthly summary markdown
 */
function generateMonthlySummaryMd(
  monthStart: Date,
  monthEnd: Date,
  metrics: ReportMetrics,
  trends: { loadChange: number; consistencyChange: number; readinessChange: number }
): string {
  const hours = Math.floor(metrics.totalDuration / 60);
  const durationStr = `${hours}h`;

  const loadTrend = trends.loadChange > 0 ? `↑ ${trends.loadChange.toFixed(0)}%` : trends.loadChange < 0 ? `↓ ${Math.abs(trends.loadChange).toFixed(0)}%` : "→ stable";
  const consistencyTrend = trends.consistencyChange > 0 ? `↑ ${trends.consistencyChange}pts` : trends.consistencyChange < 0 ? `↓ ${Math.abs(trends.consistencyChange)}pts` : "→ stable";
  const readinessTrend = trends.readinessChange > 0 ? `↑ ${trends.readinessChange}pts` : trends.readinessChange < 0 ? `↓ ${Math.abs(trends.readinessChange)}pts` : "→ stable";

  // Generate focus areas
  const focusAreas: string[] = [];
  
  if (trends.loadChange > 15) {
    focusAreas.push("Load increased significantly—monitor recovery closely");
  } else if (trends.loadChange < -15) {
    focusAreas.push("Load decreased—good if planned, check motivation if not");
  }

  if (metrics.avgReadiness < 60) {
    focusAreas.push("Prioritize sleep and recovery protocols");
  }

  if (metrics.complianceScore < 70) {
    focusAreas.push("Simplify training plan to improve adherence");
  }

  if (Object.keys(metrics.fatigueTypes).length > 0) {
    focusAreas.push("Address recurring fatigue patterns");
  }

  const focusMd = focusAreas.length > 0
    ? `### Focus Areas for Next Month\n${focusAreas.map(f => `- ${f}`).join("\n")}`
    : "";

  return `## ${formatMonthYear(monthStart)} Summary

### Monthly Totals
- **Duration:** ${durationStr}
- **TSS:** ${metrics.totalTSS}
- **Sessions:** ${metrics.sessionsCount}

### Trends vs Previous Month
- **Load:** ${loadTrend}
- **Consistency:** ${consistencyTrend}
- **Readiness:** ${readinessTrend}

### Averages
- **Readiness:** ${metrics.avgReadiness}/100
- **Compliance:** ${metrics.complianceScore}%
- **Burnout Risk:** ${metrics.burnoutRisk}/100

${focusMd}`;
}

/**
 * Format date as "Jan 15"
 */
function formatDateShort(date: Date): string {
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/**
 * Format as "January 2026"
 */
function formatMonthYear(date: Date): string {
  return date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

/**
 * Get week start (Monday) for a date
 */
export function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Get month start for a date
 */
export function getMonthStart(date: Date): Date {
  const d = new Date(date);
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d;
}
