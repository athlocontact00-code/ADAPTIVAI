import type { StructuredWorkoutPlan, Section, SectionType, Block } from "./types";

const SECTION_KEYWORDS: Record<SectionType, RegExp> = {
  warmup: /(?:warm-?up|warm up|wu|warmup)/i,
  main: /(?:main set|main|workout|ms|mainset)/i,
  cooldown: /(?:cool-?down|cool down|cd|cooldown)/i,
  strength: /(?:strength|weights|gym)/i,
  technique: /(?:technique|drill|skill)/i,
};

export function parseTextToStructured(text: string): StructuredWorkoutPlan | null {
  if (!text || text.trim().length === 0) return null;

  const normalized = text.replace(/\r\n/g, "\n");
  const rawLines = normalized
    .split(/\n+/)
    .map((l) => l.trim())
    .filter(Boolean);

  if (rawLines.length === 0) return null;

  let objective: string | undefined;
  const lines = rawLines.slice();
  const objectiveMatch = lines[0]?.match(/^(?:objective|goal|cel)\s*[:\-]\s*(.+)$/i);
  if (objectiveMatch?.[1]) {
    const v = objectiveMatch[1].trim();
    if (v.length > 0) objective = v;
    lines.shift();
  }

  const sections: Section[] = [];
  let current: Section | null = null;

  for (const line of lines) {
    const header = detectSectionHeader(line);
    if (header) {
      current = { id: randomId(), type: header.type, title: header.title, blocks: [] };
      sections.push(current);
      continue;
    }

    // If line starts with bullet/numbering -> block
    if (isBullet(line)) {
      if (!current) {
        current = { id: randomId(), type: "main", title: "Main set", blocks: [] };
        sections.push(current);
      }
      const b = parseLineToBlock(stripBulletPrefix(line));
      current.blocks.push(b);
      continue;
    }

    // Fallback: treat as notes in current or new main
    if (!current) {
      current = { id: randomId(), type: "main", title: "Main set", blocks: [] };
      sections.push(current);
    }
    // If it looks like an interval line, parse it as a block anyway.
    const maybeInterval = /(\d+\s*(?:x|×)\s*\d+)|(\d{1,2}:\d{2})|(\b\d+(?:\.\d+)?\s*(?:km|m|min|s)\b)/i.test(
      line
    );
    current.blocks.push(maybeInterval ? parseLineToBlock(line) : { id: randomId(), notes: line });
  }

  const plan: StructuredWorkoutPlan = { version: 2, objective, sections };
  return plan;
}

function parseLineToBlock(line: string): Block {
  // MVP heuristics: parse basic reps/distance/duration/rest/intensity.
  const raw = line.trim();
  const b: Block = { id: randomId(), notes: raw };

  // Reps: "6x", "6 x", "6×"
  const repsMatch = raw.match(/\b(\d+)\s*(?:x|×)\b/i);
  if (repsMatch?.[1]) {
    const n = parseInt(repsMatch[1], 10);
    if (Number.isFinite(n) && n > 0) b.reps = n;
  }

  // Distance: "400m", "1 km", "0.8km"
  const distMatch = raw.match(/\b(\d+(?:[.,]\d+)?)\s*(km|m)\b/i);
  if (distMatch?.[1] && distMatch?.[2]) {
    const v = parseFloat(distMatch[1].replace(",", "."));
    if (Number.isFinite(v) && v > 0) {
      b.distanceM = /km/i.test(distMatch[2]) ? Math.round(v * 1000) : Math.round(v);
    }
  }

  // Duration: "10 min", "45min", "1:30" (not pace like "/km")
  const duration = parseDurationSec(raw);
  if (duration != null) b.durationSec = duration;

  // Rest: "rest 60s", "RI 1:00", "recovery 2 min"
  const rest = parseRestSec(raw);
  if (rest != null) b.restSec = rest;

  // Intensity: zone / rpe / hr / power / pace labels
  const intensity = parseIntensity(raw);
  if (intensity) {
    b.intensityType = intensity.type;
    if (intensity.label) b.intensityLabel = intensity.label;
    if (intensity.range) b.intensityRange = intensity.range;
  }

  return b;
}

function randomId(): string {
  const c = globalThis.crypto as unknown as undefined | { randomUUID?: () => string };
  return c?.randomUUID?.() ?? `id_${Math.random().toString(36).slice(2, 10)}`;
}

function isBullet(line: string): boolean {
  const l = line.trimStart();
  return /^[-*•]\s+/.test(l) || /^\d+\.\s+/.test(l);
}

function stripBulletPrefix(line: string): string {
  return line.replace(/^\s*(?:[-*•]\s+|\d+\.\s+)/, "").trim();
}

function detectSectionHeader(line: string): null | { type: SectionType; title: string } {
  const raw = line.trim();
  if (!raw) return null;

  const md = raw.match(/^#{1,3}\s+(.+?)\s*$/);
  const candidate = md?.[1] ? md[1].trim() : raw;

  // Only treat as header when line is "header-like".
  const headerLike =
    !!md ||
    /^[A-Za-ząćęłńóśżźĄĆĘŁŃÓŚŻŹ][A-Za-z0-9ąćęłńóśżźĄĆĘŁŃÓŚŻŹ\s/()+.-]{1,28}:?$/.test(raw) ||
    /:$/i.test(raw) ||
    /^(WU|MS|CD)$/i.test(raw);
  if (!headerLike) return null;

  const cleaned = candidate.replace(/[:\-]+$/, "").trim();
  if (!cleaned) return null;

  let matched: SectionType | null = null;
  for (const t of Object.keys(SECTION_KEYWORDS) as SectionType[]) {
    if (SECTION_KEYWORDS[t].test(cleaned)) {
      matched = t;
      break;
    }
  }
  if (!matched) return null;

  const title = normalizeSectionTitle(cleaned, matched);
  return { type: matched, title };
}

function normalizeSectionTitle(rawTitle: string, type: SectionType): string {
  const t = rawTitle.replace(/^#{1,3}\s+/, "").replace(/[:\-]+$/, "").trim();
  if (t.length > 0 && t.length <= 40) {
    // Common normalizations
    const lower = t.toLowerCase();
    if (type === "warmup") return "Warm-up";
    if (type === "cooldown") return "Cool-down";
    if (type === "main") return lower.includes("main") ? "Main set" : "Main set";
    if (type === "strength") return "Strength";
    if (type === "technique") return "Technique";
    return t;
  }
  if (type === "warmup") return "Warm-up";
  if (type === "cooldown") return "Cool-down";
  if (type === "strength") return "Strength";
  if (type === "technique") return "Technique";
  return "Main set";
}

function parseDurationSec(text: string): number | null {
  const s = text.toLowerCase();

  // Avoid interpreting pace like "4:20/km" as a duration.
  const looksLikePace = /\/\s*(?:km|100m)\b/.test(s);

  const h = s.match(/\b(\d+(?:[.,]\d+)?)\s*h\b/);
  if (h?.[1]) {
    const v = parseFloat(h[1].replace(",", "."));
    if (Number.isFinite(v) && v > 0) return Math.round(v * 3600);
  }

  const min = s.match(/\b(\d{1,3})\s*(?:min|mins|m)\b/);
  if (min?.[1]) {
    const v = parseInt(min[1], 10);
    if (Number.isFinite(v) && v > 0) return v * 60;
  }

  const sec = s.match(/\b(\d{1,4})\s*(?:sec|secs|s)\b/);
  if (sec?.[1]) {
    const v = parseInt(sec[1], 10);
    if (Number.isFinite(v) && v > 0) return v;
  }

  if (!looksLikePace) {
    const mmss = s.match(/\b(\d{1,2}):(\d{2})\b/);
    if (mmss?.[1] && mmss?.[2]) {
      const m = parseInt(mmss[1], 10);
      const r = parseInt(mmss[2], 10);
      if (Number.isFinite(m) && Number.isFinite(r) && m >= 0 && r >= 0 && r < 60) return m * 60 + r;
    }
  }

  return null;
}

function parseRestSec(text: string): number | null {
  const s = text.toLowerCase();
  const m = s.match(/\b(?:rest|ri|recovery)\s*(\d{1,2}:\d{2}|\d{1,3})\s*(s|sec|secs|m|min|mins)?\b/i);
  if (!m?.[1]) return null;
  const raw = m[1];
  const unit = m[2]?.toLowerCase() ?? null;

  if (raw.includes(":")) {
    const [mm, ss] = raw.split(":");
    const mi = parseInt(mm, 10);
    const se = parseInt(ss, 10);
    if (Number.isFinite(mi) && Number.isFinite(se) && se >= 0 && se < 60) return mi * 60 + se;
    return null;
  }

  const n = parseInt(raw, 10);
  if (!Number.isFinite(n) || n <= 0) return null;
  if (unit === "m" || unit === "min" || unit === "mins") return n * 60;
  return n;
}

function parseIntensity(
  text: string
): null | {
  type: Block["intensityType"];
  label?: string;
  range?: Block["intensityRange"];
} {
  const s = text.trim();

  const zone = s.match(/\b(?:z|zone)\s*([1-5])\b/i);
  if (zone?.[1]) return { type: "zone", label: `Z${zone[1]}` };

  const rpe = s.match(/\b(?:rpe)\s*(\d{1,2})(?:\s*[-–]\s*(\d{1,2}))?\b/i) ?? s.match(/\b(\d{1,2})\s*\/\s*10\b/i);
  if (rpe?.[1]) {
    const min = parseInt(rpe[1], 10);
    const max = rpe[2] ? parseInt(rpe[2], 10) : undefined;
    if (Number.isFinite(min)) {
      return {
        type: "rpe",
        range: { unit: "rpe", min, max: Number.isFinite(max) ? max : undefined },
      };
    }
  }

  const hr = s.match(/\b(\d{2,3})\s*(?:-|–|to)\s*(\d{2,3})\s*(?:bpm)?\b/i);
  if (hr?.[1] && hr?.[2]) {
    const min = parseInt(hr[1], 10);
    const max = parseInt(hr[2], 10);
    if (Number.isFinite(min) && Number.isFinite(max)) return { type: "hr", range: { unit: "bpm", min, max } };
  }

  const pwr = s.match(/\b(\d{2,4})\s*(?:-|–|to)\s*(\d{2,4})\s*w\b/i);
  if (pwr?.[1] && pwr?.[2]) {
    const min = parseInt(pwr[1], 10);
    const max = parseInt(pwr[2], 10);
    if (Number.isFinite(min) && Number.isFinite(max)) return { type: "power", range: { unit: "w", min, max } };
  }

  const pace = s.match(/\b(\d{1,2}:\d{2})\s*(?:-|–|to)\s*(\d{1,2}:\d{2})\s*\/\s*km\b/i);
  if (pace?.[1] && pace?.[2]) return { type: "pace", label: `${pace[1]}–${pace[2]}/km` };

  const swimPace = s.match(/\b(\d{1,2}:\d{2})\s*(?:-|–|to)\s*(\d{1,2}:\d{2})\s*\/\s*100m\b/i);
  if (swimPace?.[1] && swimPace?.[2]) return { type: "pace", label: `${swimPace[1]}–${swimPace[2]}/100m` };

  return null;
}
