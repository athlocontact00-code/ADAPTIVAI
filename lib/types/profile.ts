/**
 * Profile types for athlete identity, availability, preferences, guardrails.
 */

export type DayOfWeek = 0 | 1 | 2 | 3 | 4 | 5 | 6; // Sun-Sat
export type PreferredTime = "morning" | "evening" | "any";
export type TrainingStyle = "volume_first" | "balanced" | "intensity_first";
export type SurfacePreference = "road" | "trail" | "treadmill";
export type SwimPreference = "pool" | "open_water" | "both";
/** Swim level for AI Coach pool prescriptions. */
export type SwimLevel = "beginner" | "age_group" | "advanced" | "expert";

export interface AvailabilityData {
  daysAvailable?: DayOfWeek[];
  /** null = no limit (do not cap session duration) */
  maxMinutesPerDay?: number | null;
  preferredTime?: PreferredTime;
  restDaysPreference?: number; // 0-2
  atLeastOneRestDayPerWeek?: boolean;
}

export interface PreferencesData {
  trainingStyle?: TrainingStyle;
  hardSessionsPerWeek?: 1 | 2 | 3;
  surfacePreference?: SurfacePreference[];
  swimPreference?: SwimPreference;
  /** Swim level for pool sessions: beginner | age_group | advanced. Default age_group. */
  swimLevel?: SwimLevel;
  notes?: string;
  enableDailyReminders?: boolean;
  enableLowReadinessAlerts?: boolean;
  enableMissedLogReminder?: boolean;
  enableWeeklyDigest?: boolean;
}

export interface GuardrailsData {
  maxIntensityWhenFatigueHigh?: boolean;
  neverTwoHardRunDaysInRow?: boolean;
  limitWeeklyRampRatePercent?: number; // 10-20
}

/** null = "No limit"; numbers in minutes. Max 180 extends beyond previous 120 cap. */
export const AVAILABILITY_PRESETS = [null, 30, 45, 60, 90, 120, 180] as const;
export type MaxMinutesPreset = (typeof AVAILABILITY_PRESETS)[number];
export const BIRTH_YEAR_MIN = 1930;
export const BIRTH_YEAR_MAX = 2015;
export const RAMP_RATE_MIN = 5;
export const RAMP_RATE_MAX = 30;
export const AVATAR_MAX_SIZE_BYTES = 5 * 1024 * 1024;
export const AVATAR_ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];
