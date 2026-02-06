/**
 * Profile types for athlete identity, availability, preferences, guardrails.
 */

export type DayOfWeek = 0 | 1 | 2 | 3 | 4 | 5 | 6; // Sun-Sat
export type PreferredTime = "morning" | "evening" | "any";
export type TrainingStyle = "volume_first" | "balanced" | "intensity_first";
export type SurfacePreference = "road" | "trail" | "treadmill";
export type SwimPreference = "pool" | "open_water" | "both";

export interface AvailabilityData {
  daysAvailable?: DayOfWeek[];
  maxMinutesPerDay?: number;
  preferredTime?: PreferredTime;
  restDaysPreference?: number; // 0-2
  atLeastOneRestDayPerWeek?: boolean;
}

export interface PreferencesData {
  trainingStyle?: TrainingStyle;
  hardSessionsPerWeek?: 1 | 2 | 3;
  surfacePreference?: SurfacePreference[];
  swimPreference?: SwimPreference;
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

export const AVAILABILITY_PRESETS = [30, 45, 60, 90, 120] as const;
export const BIRTH_YEAR_MIN = 1930;
export const BIRTH_YEAR_MAX = 2015;
export const RAMP_RATE_MIN = 5;
export const RAMP_RATE_MAX = 30;
export const AVATAR_MAX_SIZE_BYTES = 5 * 1024 * 1024;
export const AVATAR_ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];
