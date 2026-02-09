/**
 * Swim prescription utilities: PR parsing, pace derivation, exact total meters enforcement.
 */

import { parseSwimMetersFromText } from "@/lib/utils/swim-meters";

export type SwimPR = {
  distanceM: number;
  timeSec: number;
};

/**
 * Parse swim PR from user input. Patterns: "PR 400m is 4:40", "400m in 4:40", "4:40 for 400m", "400 m - 4 min 40 sec".
 */
export function parseSwimPR(inputText: string): SwimPR | null {
  if (!inputText || typeof inputText !== "string") return null;
  const t = inputText.trim();
  const lower = t.toLowerCase();

  // Distance first: 200m, 400m, 800m, 1500m, etc.
  const distMatch = lower.match(/\b(\d{2,4})\s*m\b/);
  if (!distMatch) return null;
  const distanceM = parseInt(distMatch[1], 10);
  if (distanceM < 50 || distanceM > 5000) return null;

  // Time: 4:40, 4m40s, 4 min 40, 280 sec
  const minSec = t.match(/(\d+)\s*[:m]\s*(\d+)\s*(?:s|sec|min)?/i);
  if (minSec) {
    const min = parseInt(minSec[1], 10);
    const sec = parseInt(minSec[2], 10);
    if (sec >= 0 && sec < 60) {
      return { distanceM, timeSec: min * 60 + sec };
    }
  }
  const secOnly = t.match(/\b(\d{2,4})\s*(?:s|sec|seconds?)\b/i);
  if (secOnly) {
    const timeSec = parseInt(secOnly[1], 10);
    if (timeSec > 0 && timeSec < 7200) return { distanceM, timeSec };
  }
  return null;
}

export type SwimPaces = {
  cssLikePer100Sec: number;
  aerobicPer100Sec: number;
  thresholdPer100Sec: number;
  vo2Per100Sec: number;
};

/**
 * Derive per-100m pace estimates from a PR (e.g. 400m in 4:40 -> ~70s/100m CSS-like).
 */
export function computePaces(pr: SwimPR): SwimPaces {
  const secPer100 = (pr.timeSec / pr.distanceM) * 100;
  return {
    cssLikePer100Sec: Math.round(secPer100 * 10) / 10,
    aerobicPer100Sec: Math.round((secPer100 + 10) * 10) / 10,
    thresholdPer100Sec: Math.round((secPer100 + 3) * 10) / 10,
    vo2Per100Sec: Math.round((secPer100 - 3) * 10) / 10,
  };
}

/**
 * Adjust workout text so that computed total meters equals targetMeters.
 * Does not add visible "correction" or "drop 2x100" — adjusts by modifying one block (e.g. cool-down 200m -> 100m).
 * Returns adjusted description text; if no safe adjustment possible, returns original.
 */
export function ensureExactTotalMeters(
  descriptionMd: string,
  targetMeters: number
): string {
  const computed = parseSwimMetersFromText(descriptionMd);
  if (computed == null) return descriptionMd;
  const diff = computed - targetMeters;
  if (diff === 0) return descriptionMd;

  // Reduce: replace one occurrence to remove exactly diff (no visible "correction" text)
  if (diff > 0 && diff <= 500) {
    let out = descriptionMd;
    if (diff === 100 && /\d+\s*[x×*]\s*100\s*m?\b/i.test(out)) {
      out = out.replace(/(\d+)\s*[x×*]\s*100\s*m?\b/i, (_, n) => {
        const r = parseInt(n, 10);
        return r > 1 ? `${r - 1}×100m` : `${n}×100m`;
      });
      if (parseSwimMetersFromText(out) === targetMeters) return out;
    }
    if (diff === 200) {
      if (/200\s*m?\b/i.test(out)) {
        out = out.replace(/200\s*m?\b/i, "100m");
        if (parseSwimMetersFromText(out) === targetMeters) return out;
      }
      out = descriptionMd;
      if (/(\d+)\s*[x×*]\s*100\s*m?\b/i.test(out)) {
        out = out.replace(/(\d+)\s*[x×*]\s*100\s*m?\b/i, (_, n) => {
          const r = parseInt(n, 10);
          return r >= 2 ? `${r - 2}×100m` : `${n}×100m`;
        });
        if (parseSwimMetersFromText(out) === targetMeters) return out;
      }
    }
    if (diff === 400 && /400\s*m?\b/i.test(descriptionMd)) {
      out = descriptionMd.replace(/400\s*m?\b/i, "200m");
      if (parseSwimMetersFromText(out) === targetMeters) return out;
    }
  }

  // Add: append one short block
  if (diff < 0 && -diff <= 400) {
    const toAdd = -diff;
    if (toAdd % 50 === 0) {
      const appended = `${descriptionMd}\n- ${toAdd}m easy`;
      if (parseSwimMetersFromText(appended) === targetMeters) return appended;
    }
  }

  return descriptionMd;
}

/**
 * Check if description claims a total (e.g. "TOTAL 3000m") and return that number if present.
 */
export function getClaimedTotalMeters(text: string): number | null {
  const m = text.match(/TOTAL\s*METERS?\s*[=:]\s*(\d+)/i) || text.match(/total\s*[=:]\s*(\d+)\s*m/i);
  return m ? parseInt(m[1], 10) : null;
}
