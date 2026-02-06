/**
 * Season HQ types
 */

export type BlockType = "BASE" | "BUILD" | "PEAK" | "TAPER" | "RECOVERY" | "CUSTOM";
export type FocusDiscipline = "SWIM" | "BIKE" | "RUN" | "STRENGTH" | "MIXED";
export type MilestoneKind = "A_RACE" | "B_RACE" | "C_RACE" | "TEST" | "CAMP";
export type PlanRigidity = "LOCKED" | "SEMI_LOCKED" | "FLEXIBLE";
export type AlertSeverity = "info" | "warn" | "danger";

export interface SeasonConstraints {
  maxWeeklyHours?: number;
  availability?: number[]; // 0-6 Mon-Sun
  intensityLimit?: "Low" | "Normal" | "High";
  injuryNote?: string;
}

export interface DisciplineFocus {
  swim?: number;
  bike?: number;
  run?: number;
  strength?: number;
}

export interface BlockGuardrails {
  maxHardSessionsPerWeek?: number;
  rampRateLimit?: number;
}

export interface SeasonHQ {
  id: string;
  name: string;
  sport: string;
  startDate: Date;
  endDate: Date;
  goalRaceDate: Date | null;
  primaryGoal: string | null;
  planRigidity: PlanRigidity | null;
  constraints: SeasonConstraints | null;
  disciplineFocus: DisciplineFocus | null;
  trainingBlocks: BlockHQ[];
  raceEvents: MilestoneHQ[];
  seasonAlerts?: SeasonAlertHQ[];
}

export interface BlockHQ {
  id: string;
  type: BlockType;
  startDate: Date;
  endDate: Date;
  focus: string | null;
  targetHours: number | null;
  targetHoursMin: number | null;
  targetHoursMax: number | null;
  targetTSSMin: number | null;
  targetTSSMax: number | null;
  focusDiscipline: FocusDiscipline | null;
  focusLabel: string | null;
  intensityCap: number | null;
  guardrails: BlockGuardrails | null;
  blockOrder: number;
}

export interface MilestoneHQ {
  id: string;
  name: string;
  date: Date;
  distance: string | null;
  priority: string;
  kind: MilestoneKind | null;
  goalTime: string | null;
  notes: string | null;
}

export interface SeasonAlertHQ {
  id: string;
  type: string;
  severity: AlertSeverity;
  title: string;
  message: string;
  why: string | null;
  ctaLabel: string | null;
  ctaActionKey: string | null;
  dismissedAt: Date | null;
}

export interface AutoCreateWizardInput {
  // Step 1
  name: string;
  sport: string;
  goalRaceDate: string;
  raceType: string;
  startDate: string;
  // Step 2
  maxWeeklyHours: number;
  availability: number[];
  intensityLimit: "Low" | "Normal" | "High";
  injuryToggle: boolean;
  injuryNote: string;
  // Step 3
  planRigidity: PlanRigidity;
  disciplineFocus: DisciplineFocus;
}
