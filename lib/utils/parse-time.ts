/**
 * Smart time parsing — paste-friendly mm:ss and h:mm:ss
 */

/** Normalize input: remove extra spaces, allow paste formats like "3:30" or "1:45:00" */
export function parseMmSsToSeconds(input: string): number | null {
  const raw = String(input || "")
    .trim()
    .replace(/\s+/g, "");
  if (!raw) return null;

  const parts = raw.split(":").map((p) => p.trim());
  if (parts.length < 2 || parts.length > 3) return null;

  const nums = parts.map((p) => (p.length > 0 && /^\d+$/.test(p) ? Number(p) : NaN));
  if (nums.some((n) => !Number.isFinite(n))) return null;

  const [a, b, c] = nums;
  const hasHours = parts.length === 3;
  const h = hasHours ? a : 0;
  const m = hasHours ? b : a;
  const s = hasHours ? c : b;

  if (h < 0 || m < 0 || s < 0) return null;
  if (s >= 60 || m >= 60) return null;

  const total = h * 3600 + m * 60 + s;
  return total > 0 ? total : 0;
}

export function formatSecondsToMmSs(seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined) return "";
  const s = Math.max(0, Math.round(seconds));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, "0")}`;
}

export function formatSecondsToHmmSs(seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined) return "";
  const s = Math.max(0, Math.round(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  if (h > 0) {
    return `${h}:${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}`;
  }
  return `${m}:${String(r).padStart(2, "0")}`;
}
