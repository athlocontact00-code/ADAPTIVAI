/**
 * Feature gating for Free vs Pro tiers.
 *
 * Free: Dashboard, Today, Calendar, Diary (limited), Check-in, Getting Started, Settings
 * Pro:  AI Coach, Progress/Analytics, Simulator, Season Planner, Digest, Status, unlimited Diary
 *
 * After Pro purchase the entire app unlocks — no partial gating.
 */

export type TierFeature =
  | "dashboard"
  | "today"
  | "calendar"
  | "diary"
  | "checkin"
  | "getting-started"
  | "settings"
  | "coach"
  | "progress"
  | "simulator"
  | "season"
  | "digest"
  | "status";

/** Features available on the Free plan */
const FREE_FEATURES: Set<TierFeature> = new Set([
  "dashboard",
  "today",
  "calendar",
  "diary",
  "checkin",
  "getting-started",
  "settings",
]);

/** All features (Free + Pro-only) */
const ALL_FEATURES: Set<TierFeature> = new Set([
  ...FREE_FEATURES,
  "coach",
  "progress",
  "simulator",
  "season",
  "digest",
  "status",
]);

/** Pro-only features (not in Free) */
export const PRO_ONLY_FEATURES: TierFeature[] = [
  "coach",
  "progress",
  "simulator",
  "season",
  "digest",
  "status",
];

/** Diary entry limit for free users (per month) */
export const FREE_DIARY_LIMIT = 10;

/** Check if a feature is available for a given plan */
export function canAccess(
  plan: "FREE" | "TRIAL" | "PRO",
  feature: TierFeature,
): boolean {
  if (plan === "PRO" || plan === "TRIAL") return true;
  return FREE_FEATURES.has(feature);
}

/** Map a pathname to a TierFeature (returns null for unknown paths) */
export function pathToFeature(pathname: string): TierFeature | null {
  const segment = pathname.replace(/^\//, "").split("/")[0];
  const map: Record<string, TierFeature> = {
    dashboard: "dashboard",
    today: "today",
    calendar: "calendar",
    diary: "diary",
    coach: "coach",
    progress: "progress",
    simulator: "simulator",
    season: "season",
    digest: "digest",
    status: "status",
    settings: "settings",
    "getting-started": "getting-started",
  };
  return map[segment] ?? null;
}

/** Check if a path requires Pro */
export function isProPath(pathname: string): boolean {
  const feature = pathToFeature(pathname);
  if (!feature) return false;
  return !FREE_FEATURES.has(feature);
}

/** Paths that Free users are always allowed to visit */
export const FREE_ALLOWED_PATHS = [
  "/dashboard",
  "/today",
  "/calendar",
  "/diary",
  "/getting-started",
  "/settings",
  "/trial-ended",
];
