/**
 * Progress Service
 * Handles timeline events, personal bests, and progress tracking.
 */

export type PBSport = "RUN" | "BIKE" | "SWIM" | "STRENGTH";
export type PBSource = "MANUAL" | "WORKOUT" | "TEST";
export type InjurySeverity = "LOW" | "MODERATE" | "HIGH";
export type InjuryStatus = "ACTIVE" | "RESOLVED";

export interface PersonalBestData {
  id: string;
  sport: PBSport;
  discipline: string;
  valueNumber: number;
  valueUnit: string;
  date: Date;
  notes: string | null;
  source: PBSource;
}

export interface InjuryData {
  id: string;
  startDate: Date;
  endDate: Date | null;
  area: string;
  severity: InjurySeverity;
  status: InjuryStatus;
  notes: string | null;
}

export interface TimelineEvent {
  id: string;
  type: "block" | "race" | "injury" | "pb" | "peak_week";
  date: Date;
  endDate?: Date;
  title: string;
  subtitle?: string;
  color: string;
  icon: string;
  discipline?: string;
  seasonId?: string | null;
  seasonName?: string | null;
  indicatorPct?: number; // 0-100 for micro bar (volume/impact)
}

/**
 * Format PB value for display
 */
export function formatPBValue(value: number, unit: string, discipline: string): string {
  if (unit === "s") {
    // Format as time
    if (value >= 3600) {
      const hours = Math.floor(value / 3600);
      const mins = Math.floor((value % 3600) / 60);
      const secs = Math.floor(value % 60);
      return `${hours}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
    } else if (value >= 60) {
      const mins = Math.floor(value / 60);
      const secs = Math.floor(value % 60);
      return `${mins}:${secs.toString().padStart(2, "0")}`;
    }
    return `${value.toFixed(1)}s`;
  }
  
  if (unit === "w") {
    return `${Math.round(value)}W`;
  }
  
  if (unit === "kg") {
    return `${value.toFixed(1)}kg`;
  }
  
  if (unit === "pace") {
    // value is min/km
    const mins = Math.floor(value);
    const secs = Math.round((value - mins) * 60);
    return `${mins}:${secs.toString().padStart(2, "0")}/km`;
  }
  
  if (unit === "m") {
    return `${value.toFixed(2)}m`;
  }
  
  return `${value}`;
}

/**
 * Get sport icon name
 */
export function getSportIcon(sport: PBSport): string {
  switch (sport) {
    case "RUN":
      return "footprints";
    case "BIKE":
      return "bike";
    case "SWIM":
      return "waves";
    case "STRENGTH":
      return "dumbbell";
  }
}

/**
 * Get sport color
 */
export function getSportColor(sport: PBSport): string {
  switch (sport) {
    case "RUN":
      return "text-green-500";
    case "BIKE":
      return "text-orange-500";
    case "SWIM":
      return "text-blue-500";
    case "STRENGTH":
      return "text-purple-500";
  }
}

/**
 * Get injury severity color
 */
export function getInjurySeverityColor(severity: InjurySeverity): string {
  switch (severity) {
    case "LOW":
      return "bg-yellow-500/20 text-yellow-500";
    case "MODERATE":
      return "bg-orange-500/20 text-orange-500";
    case "HIGH":
      return "bg-red-500/20 text-red-500";
  }
}

/**
 * Common running disciplines with expected units
 */
export const runningDisciplines = [
  { name: "5k", unit: "s", description: "5 kilometer time" },
  { name: "10k", unit: "s", description: "10 kilometer time" },
  { name: "Half Marathon", unit: "s", description: "21.1km time" },
  { name: "Marathon", unit: "s", description: "42.2km time" },
  { name: "Mile", unit: "s", description: "1 mile time" },
  { name: "400m", unit: "s", description: "400 meter time" },
  { name: "Threshold Pace", unit: "pace", description: "Lactate threshold pace" },
];

/**
 * Common cycling disciplines
 */
export const cyclingDisciplines = [
  { name: "FTP", unit: "w", description: "Functional Threshold Power" },
  { name: "20min Power", unit: "w", description: "20 minute max power" },
  { name: "5min Power", unit: "w", description: "5 minute max power" },
  { name: "1min Power", unit: "w", description: "1 minute max power" },
  { name: "Sprint Power", unit: "w", description: "Peak sprint power" },
  { name: "40km TT", unit: "s", description: "40km time trial" },
];

/**
 * Common swimming disciplines
 */
export const swimmingDisciplines = [
  { name: "100m Freestyle", unit: "s", description: "100m freestyle time" },
  { name: "400m Freestyle", unit: "s", description: "400m freestyle time" },
  { name: "1500m Freestyle", unit: "s", description: "1500m freestyle time" },
  { name: "CSS Pace", unit: "pace", description: "Critical swim speed" },
];

/**
 * Common strength disciplines
 */
export const strengthDisciplines = [
  { name: "1RM Squat", unit: "kg", description: "1 rep max squat" },
  { name: "1RM Deadlift", unit: "kg", description: "1 rep max deadlift" },
  { name: "1RM Bench Press", unit: "kg", description: "1 rep max bench press" },
  { name: "Pull-ups", unit: "reps", description: "Max pull-ups" },
  { name: "Plank Hold", unit: "s", description: "Max plank hold time" },
];

/**
 * Get disciplines for a sport
 */
export function getDisciplinesForSport(sport: PBSport): { name: string; unit: string; description: string }[] {
  switch (sport) {
    case "RUN":
      return runningDisciplines;
    case "BIKE":
      return cyclingDisciplines;
    case "SWIM":
      return swimmingDisciplines;
    case "STRENGTH":
      return strengthDisciplines;
  }
}

/**
 * Check if a PB is an improvement over previous
 */
export function isPBImprovement(
  newValue: number,
  oldValue: number,
  unit: string
): boolean {
  // For time-based (lower is better)
  if (unit === "s" || unit === "pace") {
    return newValue < oldValue;
  }
  // For power/weight/reps (higher is better)
  return newValue > oldValue;
}

/**
 * Calculate improvement percentage
 */
export function calculateImprovement(
  newValue: number,
  oldValue: number,
  unit: string
): number {
  if (unit === "s" || unit === "pace") {
    return ((oldValue - newValue) / oldValue) * 100;
  }
  return ((newValue - oldValue) / oldValue) * 100;
}

/**
 * Build timeline events from various data sources
 */
export function buildTimelineEvents(
  blocks: { id: string; type: string; startDate: Date; endDate: Date; focus: string | null }[],
  races: { id: string; name: string; date: Date; priority: string; season?: { id: string; name: string } | null }[],
  injuries: InjuryData[],
  pbs: PersonalBestData[],
  peakWeeks: { date: Date; tss: number }[]
): TimelineEvent[] {
  const events: TimelineEvent[] = [];

  // Add blocks
  for (const block of blocks) {
    events.push({
      id: `block-${block.id}`,
      type: "block",
      date: new Date(block.startDate),
      endDate: new Date(block.endDate),
      title: `${block.type} Block`,
      subtitle: block.focus || undefined,
      color: getBlockTimelineColor(block.type),
      icon: "layers",
      indicatorPct: getBlockImpactPct(block.type),
    });
  }

  // Add races
  for (const race of races) {
    events.push({
      id: `race-${race.id}`,
      type: "race",
      date: new Date(race.date),
      title: race.name,
      subtitle: `Priority ${race.priority}`,
      color: race.priority === "A" ? "red" : race.priority === "B" ? "yellow" : "gray",
      icon: "flag",
      seasonId: race.season?.id ?? null,
      seasonName: race.season?.name ?? null,
      indicatorPct: race.priority === "A" ? 100 : race.priority === "B" ? 66 : 33,
    });
  }

  // Add injuries
  for (const injury of injuries) {
    events.push({
      id: `injury-${injury.id}`,
      type: "injury",
      date: new Date(injury.startDate),
      endDate: injury.endDate ? new Date(injury.endDate) : undefined,
      title: `${injury.area} injury`,
      subtitle: `${injury.severity} severity - ${injury.status}`,
      color: injury.severity === "HIGH" ? "red" : injury.severity === "MODERATE" ? "orange" : "yellow",
      icon: "alert-triangle",
      indicatorPct: injury.severity === "HIGH" ? 100 : injury.severity === "MODERATE" ? 60 : 30,
    });
  }

  // Add PBs
  for (const pb of pbs) {
    events.push({
      id: `pb-${pb.id}`,
      type: "pb",
      date: new Date(pb.date),
      title: `PB: ${pb.discipline}`,
      subtitle: formatPBValue(pb.valueNumber, pb.valueUnit, pb.discipline),
      color: "green",
      icon: "trophy",
      discipline: pb.sport,
    });
  }

  // Add peak weeks
  for (const peak of peakWeeks) {
    events.push({
      id: `peak-${peak.date.toISOString()}`,
      type: "peak_week",
      date: new Date(peak.date),
      title: "Peak Training Week",
      subtitle: `${peak.tss} TSS`,
      color: "purple",
      icon: "trending-up",
      indicatorPct: Math.min(100, Math.round((peak.tss / 400) * 100)),
    });
  }

  // Sort by date descending
  events.sort((a, b) => b.date.getTime() - a.date.getTime());

  return events;
}

function getBlockImpactPct(type: string): number {
  switch (type) {
    case "PEAK": return 100;
    case "BUILD": return 75;
    case "BASE": return 50;
    case "TAPER": return 30;
    case "RECOVERY": return 25;
    default: return 50;
  }
}

function getBlockTimelineColor(type: string): string {
  switch (type) {
    case "BASE":
      return "blue";
    case "BUILD":
      return "orange";
    case "PEAK":
      return "red";
    case "TAPER":
      return "green";
    case "RECOVERY":
      return "purple";
    default:
      return "gray";
  }
}
