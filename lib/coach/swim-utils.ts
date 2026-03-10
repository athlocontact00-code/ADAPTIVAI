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

  const distances = [...lower.matchAll(/\b(\d{2,4})\s*m\b/g)]
    .map((match) => ({
      distanceM: parseInt(match[1], 10),
      index: match.index ?? -1,
    }))
    .filter((item) => item.distanceM >= 50 && item.distanceM <= 5000);
  if (distances.length === 0) return null;

  const timeCandidates: Array<{ timeSec: number; index: number }> = [];
  for (const match of t.matchAll(/(\d+)\s*[:m]\s*(\d+)\s*(?:s|sec|min)?/gi)) {
    const min = parseInt(match[1], 10);
    const sec = parseInt(match[2], 10);
    if (sec >= 0 && sec < 60) {
      timeCandidates.push({ timeSec: min * 60 + sec, index: match.index ?? -1 });
    }
  }
  for (const match of t.matchAll(/\b(\d{2,4})\s*(?:s|sec|seconds?)\b/gi)) {
    const timeSec = parseInt(match[1], 10);
    if (timeSec > 0 && timeSec < 7200) {
      timeCandidates.push({ timeSec, index: match.index ?? -1 });
    }
  }

  const prKeywords = /\b(pr|pb|best)\b/i;
  let best: { distanceM: number; timeSec: number; gap: number; hasKeyword: boolean } | null = null;

  for (const time of timeCandidates) {
    for (const distance of distances) {
      const gap = Math.abs(time.index - distance.index);
      if (gap > 24) continue;

      const start = Math.max(0, Math.min(time.index, distance.index) - 8);
      const end = Math.min(lower.length, Math.max(time.index, distance.index) + 24);
      const window = lower.slice(start, end);
      const hasKeyword = prKeywords.test(window);

      if (!hasKeyword && gap > 12) continue;

      if (
        !best ||
        Number(hasKeyword) > Number(best.hasKeyword) ||
        (hasKeyword === best.hasKeyword && gap < best.gap)
      ) {
        best = {
          distanceM: distance.distanceM,
          timeSec: time.timeSec,
          gap,
          hasKeyword,
        };
      }
    }
  }

  if (best) {
    return { distanceM: best.distanceM, timeSec: best.timeSec };
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
  const hasClaimedTotal = getClaimedTotalMeters(descriptionMd) != null;
  const withoutClaimedTotal = descriptionMd
    .replace(/^\s*TOTAL\s*METERS?\s*:\s*\d+\s*$/gim, "")
    .replace(/^\s*TOTAL\s*:\s*\d+\s*m\s*$/gim, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  const computed = parseSwimMetersFromText(withoutClaimedTotal);
  if (computed == null) return descriptionMd;
  const diff = computed - targetMeters;
  if (diff === 0) return descriptionMd;
  const withClaimedTotal = (text: string): string =>
    hasClaimedTotal ? `${text.replace(/\s+$/g, "")}\nTOTAL METERS: ${targetMeters}` : text;

  // Reduce: replace one occurrence to remove exactly diff (no visible "correction" text)
  if (diff > 0 && diff <= 500) {
    let out = withoutClaimedTotal;
    if (diff === 100 && /\d+\s*[x×*]\s*100\s*m?\b/i.test(out)) {
      out = out.replace(/(\d+)\s*[x×*]\s*100\s*m?\b/i, (_, n) => {
        const r = parseInt(n, 10);
        return r > 1 ? `${r - 1}×100m` : `${n}×100m`;
      });
      if (parseSwimMetersFromText(out) === targetMeters) return withClaimedTotal(out);
    }
    if (diff === 200) {
      if (/200\s*m?\b/i.test(out)) {
        out = out.replace(/200\s*m?\b/i, "100m");
        if (parseSwimMetersFromText(out) === targetMeters) return withClaimedTotal(out);
      }
      out = withoutClaimedTotal;
      if (/(\d+)\s*[x×*]\s*100\s*m?\b/i.test(out)) {
        out = out.replace(/(\d+)\s*[x×*]\s*100\s*m?\b/i, (_, n) => {
          const r = parseInt(n, 10);
          return r >= 2 ? `${r - 2}×100m` : `${n}×100m`;
        });
        if (parseSwimMetersFromText(out) === targetMeters) return withClaimedTotal(out);
      }
    }
    if (diff === 400 && /400\s*m?\b/i.test(withoutClaimedTotal)) {
      out = withoutClaimedTotal.replace(/400\s*m?\b/i, "200m");
      if (parseSwimMetersFromText(out) === targetMeters) return withClaimedTotal(out);
    }
  }

  // Add: append one short block
  if (diff < 0 && -diff <= 400) {
    const toAdd = -diff;
    if (toAdd % 50 === 0) {
      const appended = `${withoutClaimedTotal}\n- ${toAdd}m easy`;
      if (parseSwimMetersFromText(appended) === targetMeters) return withClaimedTotal(appended);
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
