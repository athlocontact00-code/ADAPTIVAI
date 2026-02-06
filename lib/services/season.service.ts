/**
 * Season Service
 * Handles season planning, training blocks, and race events.
 */

export type BlockType = "BASE" | "BUILD" | "PEAK" | "TAPER" | "RECOVERY";
export type RacePriority = "A" | "B" | "C";

export interface SeasonData {
  id: string;
  name: string;
  startDate: Date;
  endDate: Date;
  primaryGoal: string | null;
  blocks: BlockData[];
  races: RaceData[];
}

export interface BlockData {
  id: string;
  type: BlockType;
  startDate: Date;
  endDate: Date;
  focus: string | null;
  targetHours: number | null;
}

export interface RaceData {
  id: string;
  name: string;
  date: Date;
  distance: string | null;
  priority: RacePriority;
  goalTime: string | null;
  notes: string | null;
}

export interface AutoSeasonConfig {
  goalDate: Date;
  experienceLevel: string;
  sport: string;
  weeklyHoursGoal: number;
}

/**
 * Generate standard season structure based on goal race date
 */
export function generateSeasonStructure(config: AutoSeasonConfig): {
  name: string;
  startDate: Date;
  endDate: Date;
  primaryGoal: string;
  blocks: Omit<BlockData, "id">[];
} {
  const { goalDate, experienceLevel, sport, weeklyHoursGoal } = config;
  
  // Calculate season length based on experience
  const weeksToGoal = experienceLevel === "beginner" ? 16 : experienceLevel === "intermediate" ? 14 : 12;
  
  const startDate = new Date(goalDate);
  startDate.setDate(startDate.getDate() - weeksToGoal * 7);
  startDate.setHours(0, 0, 0, 0);
  
  const endDate = new Date(goalDate);
  endDate.setDate(endDate.getDate() + 7); // Week after race for recovery
  endDate.setHours(23, 59, 59, 999);

  // Block distribution (percentages of total weeks)
  // BASE: 40-50%, BUILD: 30-35%, PEAK: 10%, TAPER: 10%, RECOVERY: sprinkled
  const blocks: Omit<BlockData, "id">[] = [];
  
  let currentDate = new Date(startDate);
  
  // BASE phase (45% of weeks)
  const baseWeeks = Math.round(weeksToGoal * 0.45);
  const baseEnd = new Date(currentDate);
  baseEnd.setDate(baseEnd.getDate() + baseWeeks * 7 - 1);
  blocks.push({
    type: "BASE",
    startDate: new Date(currentDate),
    endDate: baseEnd,
    focus: "Aerobic foundation, consistency, technique",
    targetHours: weeklyHoursGoal * 0.8,
  });
  currentDate = new Date(baseEnd);
  currentDate.setDate(currentDate.getDate() + 1);

  // BUILD phase (30% of weeks)
  const buildWeeks = Math.round(weeksToGoal * 0.30);
  const buildEnd = new Date(currentDate);
  buildEnd.setDate(buildEnd.getDate() + buildWeeks * 7 - 1);
  blocks.push({
    type: "BUILD",
    startDate: new Date(currentDate),
    endDate: buildEnd,
    focus: "Intensity progression, race-specific work",
    targetHours: weeklyHoursGoal,
  });
  currentDate = new Date(buildEnd);
  currentDate.setDate(currentDate.getDate() + 1);

  // PEAK phase (15% of weeks)
  const peakWeeks = Math.round(weeksToGoal * 0.15);
  const peakEnd = new Date(currentDate);
  peakEnd.setDate(peakEnd.getDate() + peakWeeks * 7 - 1);
  blocks.push({
    type: "PEAK",
    startDate: new Date(currentDate),
    endDate: peakEnd,
    focus: "Race simulation, sharpening",
    targetHours: weeklyHoursGoal * 1.1,
  });
  currentDate = new Date(peakEnd);
  currentDate.setDate(currentDate.getDate() + 1);

  // TAPER phase (10% of weeks, min 1 week)
  const taperWeeks = Math.max(1, Math.round(weeksToGoal * 0.10));
  const taperEnd = new Date(goalDate);
  taperEnd.setDate(taperEnd.getDate() - 1);
  blocks.push({
    type: "TAPER",
    startDate: new Date(currentDate),
    endDate: taperEnd,
    focus: "Volume reduction, freshness, mental prep",
    targetHours: weeklyHoursGoal * 0.5,
  });

  // RECOVERY phase (post-race week)
  const recoveryStart = new Date(goalDate);
  recoveryStart.setDate(recoveryStart.getDate() + 1);
  blocks.push({
    type: "RECOVERY",
    startDate: recoveryStart,
    endDate: new Date(endDate),
    focus: "Active recovery, reflection, next goals",
    targetHours: weeklyHoursGoal * 0.3,
  });

  return {
    name: `${goalDate.getFullYear()} ${sport.charAt(0).toUpperCase() + sport.slice(1)} Season`,
    startDate,
    endDate,
    primaryGoal: `Race day: ${goalDate.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}`,
    blocks,
  };
}

/**
 * Get block type color for UI
 */
export function getBlockColor(type: BlockType): string {
  switch (type) {
    case "BASE":
      return "bg-blue-500/20 text-blue-500 border-blue-500/30";
    case "BUILD":
      return "bg-orange-500/20 text-orange-500 border-orange-500/30";
    case "PEAK":
      return "bg-red-500/20 text-red-500 border-red-500/30";
    case "TAPER":
      return "bg-green-500/20 text-green-500 border-green-500/30";
    case "RECOVERY":
      return "bg-purple-500/20 text-purple-500 border-purple-500/30";
  }
}

/**
 * Get race priority color for UI
 */
export function getRacePriorityColor(priority: RacePriority): string {
  switch (priority) {
    case "A":
      return "bg-red-500 text-white";
    case "B":
      return "bg-yellow-500 text-black";
    case "C":
      return "bg-gray-500 text-white";
  }
}

/**
 * Calculate weeks remaining until race
 */
export function getWeeksUntilRace(raceDate: Date): number {
  const now = new Date();
  const diffMs = raceDate.getTime() - now.getTime();
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24 * 7));
}

/**
 * Get current block for a date
 */
export function getCurrentBlock(blocks: BlockData[], date: Date = new Date()): BlockData | null {
  const d = new Date(date);
  d.setHours(12, 0, 0, 0);
  
  return blocks.find(block => {
    const start = new Date(block.startDate);
    const end = new Date(block.endDate);
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);
    return d >= start && d <= end;
  }) || null;
}

/**
 * Get block for a specific week
 */
export function getBlockForWeek(blocks: BlockData[], weekStart: Date): BlockData | null {
  const midWeek = new Date(weekStart);
  midWeek.setDate(midWeek.getDate() + 3);
  return getCurrentBlock(blocks, midWeek);
}

/**
 * Format block duration
 */
export function formatBlockDuration(startDate: Date, endDate: Date): string {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const weeks = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24 * 7));
  return `${weeks} week${weeks !== 1 ? "s" : ""}`;
}
