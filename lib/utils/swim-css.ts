/**
 * Infer Critical Swim Speed (CSS) from repeat data (e.g. 10×100m with times).
 * CSS ≈ median(repeat pace) + 2–5 sec/100m depending on RPE and rest.
 * Returns sec per 100m or null if insufficient data.
 */
export interface SwimRepeat {
  /** Rep number (1-based). */
  rep?: number;
  /** Distance in meters. */
  distanceM: number;
  /** Time in seconds. */
  timeSec: number;
  /** Rest in seconds (optional). */
  restSec?: number;
}

/**
 * Compute pace in sec per 100m from distance and time.
 */
export function paceSecPer100m(distanceM: number, timeSec: number): number {
  if (distanceM <= 0) return 0;
  return (timeSec / distanceM) * 100;
}

/**
 * Infer CSS (Critical Swim Speed) sec/100m from an array of repeats.
 * Uses median pace of repeats, then adds 2–5 sec based on RPE and rest.
 * Conservative: higher RPE or more rest -> add more seconds.
 */
export function inferCssSecPer100m(
  repeats: SwimRepeat[],
  options?: { rpe?: number; typicalRestSec?: number }
): number | null {
  if (!repeats?.length) return null;

  const paces = repeats
    .filter((r) => r.distanceM > 0 && r.timeSec > 0)
    .map((r) => paceSecPer100m(r.distanceM, r.timeSec));
  if (paces.length < 2) return null;

  const sorted = [...paces].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const medianPace =
    sorted.length % 2 === 0 ? (sorted[mid - 1]! + sorted[mid]!) / 2 : sorted[mid]!;

  // Add 2–5 sec based on RPE (higher RPE = harder = closer to CSS, add less) and rest
  const rpe = options?.rpe ?? 7;
  const rest = options?.typicalRestSec ?? 15;
  let addSec = 4;
  if (rpe >= 8) addSec = 2;
  else if (rpe >= 7) addSec = 3;
  else if (rpe >= 6) addSec = 4;
  else addSec = 5;
  if (rest > 30) addSec += 1;

  return Math.round(medianPace + addSec);
}
