/**
 * Formatting utilities for consistent data display.
 * All helpers handle null/undefined/NaN — never display raw floats or NaN.
 */

export interface FormatNumberOptions {
  decimals?: number;
  trimZeros?: boolean;
}

/**
 * Format number with safe fallbacks. Never returns NaN or long floats.
 */
export function formatNumber(
  value: number | null | undefined,
  options: FormatNumberOptions | number = {}
): string {
  const opts = typeof options === "number" ? { decimals: options } : options;
  const { decimals = 0, trimZeros = false } = opts;
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  const num = Number(value);
  if (!Number.isFinite(num)) return "—";
  let s = num.toFixed(decimals);
  if (trimZeros && decimals > 0) {
    s = s.replace(/\.?0+$/, "");
  }
  return s;
}

/**
 * Format hours (e.g. 0, 0.5, 1.3, 4.4). Max 1 decimal, no trailing .0.
 */
export function formatHours(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  const num = Number(value);
  if (!Number.isFinite(num)) return "—";
  const rounded = Math.round(num * 10) / 10;
  if (Number.isInteger(rounded)) return String(rounded);
  return rounded.toFixed(1).replace(/\.0$/, "") || String(rounded);
}

/**
 * Format TSS as integer.
 */
export function formatTSS(tss: number | null | undefined): string {
  if (tss === null || tss === undefined || Number.isNaN(tss)) return "—";
  const num = Number(tss);
  if (!Number.isFinite(num)) return "—";
  return String(Math.round(num));
}

/**
 * Format percentage. Default: integer + %. Optional decimals for backward compat.
 */
export function formatPercent(
  value: number | null | undefined,
  decimals: number = 0
): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  const num = Number(value);
  if (!Number.isFinite(num)) return "—";
  const percent = num > 1 ? num : num * 100;
  if (decimals === 0) return `${Math.round(percent)}%`;
  return `${percent.toFixed(decimals)}%`;
}

/**
 * Format range "a – b" with optional unit (e.g. "h", "TSS").
 */
export function formatRange(
  a: number | null | undefined,
  b: number | null | undefined,
  unit?: string
): string {
  const fa = formatNumber(a, { decimals: 1, trimZeros: true });
  const fb = formatNumber(b, { decimals: 1, trimZeros: true });
  if (fa === "—" || fb === "—") return "—";
  const u = unit ? ` ${unit}` : "";
  return `${fa}–${fb}${u}`;
}

/**
 * Format duration in hours to "Xh Ym" format
 * @param hours - Duration in hours (e.g., 1.5)
 * @returns Formatted string (e.g., "1h 30m")
 */
export function formatDuration(hours: number | null | undefined): string {
  if (hours === null || hours === undefined) return "—";
  
  const totalMinutes = Math.round(hours * 60);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

/**
 * Format minutes to "Xh Ym" format
 * @param minutes - Duration in minutes
 * @returns Formatted string
 */
export function formatMinutes(minutes: number | null | undefined): string {
  if (minutes === null || minutes === undefined) return "—";
  
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

/**
 * Format sleep duration
 * @param hours - Sleep in hours (e.g., 8.25)
 * @returns Formatted string (e.g., "8h 15m")
 */
export function formatSleep(hours: number | null | undefined): string {
  if (hours === null || hours === undefined) return "—";
  return formatDuration(hours);
}

/**
 * Format distance in km
 * @param km - Distance in kilometers
 * @returns Formatted string (e.g., "10.5 km")
 */
export function formatDistance(km: number | null | undefined): string {
  if (km === null || km === undefined) return "—";
  return `${km.toFixed(1)} km`;
}

/**
 * Format date for display (locale-aware)
 * @param date - Date to format
 * @param options - Intl.DateTimeFormat options
 * @returns Formatted date string
 */
export function formatDate(
  date: Date | string | null | undefined,
  options: Intl.DateTimeFormatOptions = {
    month: "short",
    day: "numeric",
  }
): string {
  if (!date) return "—";
  
  const d = typeof date === "string" ? new Date(date) : date;
  if (isNaN(d.getTime())) return "—";
  
  return d.toLocaleDateString("en-US", options);
}

/**
 * Format date with year
 */
export function formatDateFull(date: Date | string | null | undefined): string {
  return formatDate(date, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/**
 * Format date and time
 */
export function formatDateTime(date: Date | string | null | undefined): string {
  if (!date) return "—";
  
  const d = typeof date === "string" ? new Date(date) : date;
  if (isNaN(d.getTime())) return "—";
  
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/**
 * Format relative time (e.g., "2 days ago", "in 3 hours")
 */
export function formatRelativeTime(date: Date | string | null | undefined): string {
  if (!date) return "—";
  
  const d = typeof date === "string" ? new Date(date) : date;
  if (isNaN(d.getTime())) return "—";
  
  const now = new Date();
  const diffMs = d.getTime() - now.getTime();
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
  const diffHours = Math.round(diffMs / (1000 * 60 * 60));
  const diffMinutes = Math.round(diffMs / (1000 * 60));
  
  if (Math.abs(diffMinutes) < 60) {
    if (diffMinutes === 0) return "now";
    return diffMinutes > 0 ? `in ${diffMinutes}m` : `${Math.abs(diffMinutes)}m ago`;
  }
  
  if (Math.abs(diffHours) < 24) {
    return diffHours > 0 ? `in ${diffHours}h` : `${Math.abs(diffHours)}h ago`;
  }
  
  if (diffDays === 0) return "today";
  if (diffDays === 1) return "tomorrow";
  if (diffDays === -1) return "yesterday";
  
  return diffDays > 0 ? `in ${diffDays} days` : `${Math.abs(diffDays)} days ago`;
}

/**
 * Format weekday
 */
export function formatWeekday(date: Date | string | null | undefined): string {
  if (!date) return "—";
  
  const d = typeof date === "string" ? new Date(date) : date;
  if (isNaN(d.getTime())) return "—";
  
  return d.toLocaleDateString("en-US", { weekday: "short" });
}

/**
 * Format heart rate
 */
export function formatHeartRate(hr: number | null | undefined): string {
  if (hr === null || hr === undefined) return "—";
  return `${Math.round(hr)} bpm`;
}

/**
 * Format power
 */
export function formatPower(watts: number | null | undefined): string {
  if (watts === null || watts === undefined) return "—";
  return `${Math.round(watts)} W`;
}

/**
 * Format pace (min/km)
 */
export function formatPace(minPerKm: number | null | undefined): string {
  if (minPerKm === null || minPerKm === undefined) return "—";
  
  const mins = Math.floor(minPerKm);
  const secs = Math.round((minPerKm - mins) * 60);
  return `${mins}:${secs.toString().padStart(2, "0")} /km`;
}

/**
 * Format rating (1-5) with visual indicator
 */
export function formatRating(rating: number | null | undefined, max: number = 5): string {
  if (rating === null || rating === undefined) return "—";
  return `${rating}/${max}`;
}
