export type IntensityUnit = "w" | "bpm" | "min/km" | "sec/100m" | "rpe";

export type IntensityRange = {
  min?: number;
  max?: number;
  unit: IntensityUnit;
};

export type Block = {
  id: string;
  reps?: number;
  distanceM?: number;
  durationSec?: number;
  intensityType?: "pace" | "power" | "hr" | "rpe" | "zone";
  intensityLabel?: string;
  intensityRange?: IntensityRange;
  restSec?: number;
  notes?: string;
};

export type SectionType = "warmup" | "main" | "cooldown" | "strength" | "technique";

export type Section = {
  id: string;
  type: SectionType;
  title: string;
  blocks: Block[];
};

export type StructuredWorkoutPlan = {
  version?: number; // 2
  objective?: string;
  sections: Section[];
};
