import type { Block, SectionType, StructuredWorkoutPlan } from "./types";

export type FormattedPlanSection = {
  id: string;
  title: string;
  lines: Array<{ kind: "bullet" | "text"; text: string }>;
};

function randomId(): string {
  const c = globalThis.crypto as unknown as undefined | { randomUUID?: () => string };
  return c?.randomUUID?.() ?? `id_${Math.random().toString(36).slice(2, 10)}`;
}

function normalizeNewlines(text: string): string {
  return text.replace(/\r\n/g, "\n").replace(/\t/g, "  ");
}

function isSectionHeaderLine(line: string): { title: string } | null {
  const l = line.trim();
  if (!l) return null;

  const md = l.match(/^#{2,3}\s+(.+?)\s*$/);
  if (md?.[1]) return { title: md[1].trim() };

  const keyword = l
    .replace(/[:\-]+$/, "")
    .trim()
    .toLowerCase();

  const map: Array<[RegExp, string]> = [
    [/(^|\b)(warm-?up|warmup|wu|rozgrzewka)\b/i, "Warm-up"],
    [/(^|\b)(main set|main|ms|część\s*główna|czesc\s*glowna|glowna)\b/i, "Main set"],
    [/(^|\b)(cool-?down|cooldown|cd|schlodzenie|schłodzenie)\b/i, "Cool-down"],
    [/(^|\b)(technique|drill|skill|technika)\b/i, "Technique"],
    [/(^|\b)(strength|weights|gym|siłownia|silownia)\b/i, "Strength"],
  ];

  for (const [re, title] of map) {
    if (re.test(keyword)) return { title };
  }

  // Heuristic: full caps short line -> treat as header.
  if (/^[A-Z0-9][A-Z0-9\s/()+.-]{2,28}$/.test(l)) return { title: l };

  return null;
}

function toBullet(line: string): string | null {
  const l = line.trim();
  if (!l) return null;
  const m = l.match(/^[-*•]\s+(.+)$/);
  if (m?.[1]) return m[1].trim();
  const n = l.match(/^\d+\.\s+(.+)$/);
  if (n?.[1]) return n[1].trim();
  return null;
}

export function formatTextForDisplay(text: string): FormattedPlanSection[] {
  const raw = normalizeNewlines(text || "").trim();
  if (!raw) return [];

  const lines = raw
    .split("\n")
    .map((l) => l.trimEnd())
    .filter((l) => l.trim().length > 0);

  const sections: FormattedPlanSection[] = [];
  let current: FormattedPlanSection | null = null;

  const ensureCurrent = () => {
    if (current) return current;
    current = { id: randomId(), title: "Workout plan", lines: [] };
    sections.push(current);
    return current;
  };

  for (const line of lines) {
    const header = isSectionHeaderLine(line);
    if (header) {
      current = { id: randomId(), title: header.title, lines: [] };
      sections.push(current);
      continue;
    }

    const bullet = toBullet(line);
    if (bullet) {
      ensureCurrent().lines.push({ kind: "bullet", text: bullet });
      continue;
    }

    ensureCurrent().lines.push({ kind: "text", text: line.trim() });
  }

  return sections.filter((s) => s.lines.length > 0);
}

export function exportStructuredToText(plan: StructuredWorkoutPlan): string {
  const parts: string[] = [];

  if (typeof plan.objective === "string" && plan.objective.trim().length > 0) {
    parts.push(`## Objective\n${plan.objective.trim()}`);
  }

  for (const s of plan.sections ?? []) {
    const title = typeof s.title === "string" && s.title.trim().length > 0 ? s.title.trim() : titleForType(s.type);
    const lines: string[] = [];
    for (const b of s.blocks ?? []) {
      const line = formatBlockAsLine(b);
      if (line) lines.push(`- ${line}`);
    }
    if (lines.length === 0) continue;
    parts.push(`## ${title}\n${lines.join("\n")}`);
  }

  return parts.join("\n\n").trim();
}

function titleForType(t: SectionType): string {
  if (t === "warmup") return "Warm-up";
  if (t === "cooldown") return "Cool-down";
  if (t === "strength") return "Strength";
  if (t === "technique") return "Technique";
  return "Main set";
}

export function formatBlockAsLine(b: Block): string | null {
  const main = formatBlockMain(b);
  const meta = formatBlockMeta(b);
  const cue = typeof b.notes === "string" && b.notes.trim().length > 0 ? b.notes.trim() : null;

  const parts: string[] = [];
  if (main) parts.push(main);
  if (meta) parts.push(meta);
  if (cue && cue !== main) parts.push(cue);

  const out = parts.join(" — ").replace(/\s+/g, " ").trim();
  return out.length > 0 ? out : null;
}

function formatBlockMain(b: Block): string | null {
  const reps = typeof b.reps === "number" && b.reps > 0 ? b.reps : null;
  const dist = typeof b.distanceM === "number" && b.distanceM > 0 ? b.distanceM : null;
  const dur = typeof b.durationSec === "number" && b.durationSec > 0 ? b.durationSec : null;

  const base = (() => {
    if (reps && dist) return `${reps}×${formatDistance(dist)}`;
    if (reps && dur) return `${reps}×${formatDuration(dur)}`;
    if (dist) return formatDistance(dist);
    if (dur) return formatDuration(dur);
    return null;
  })();

  return base;
}

function formatBlockMeta(b: Block): string | null {
  const parts: string[] = [];

  const intensity = formatIntensity(b);
  if (intensity) parts.push(intensity);

  const rest = typeof b.restSec === "number" && b.restSec > 0 ? `rest ${formatDuration(b.restSec)}` : null;
  if (rest) parts.push(rest);

  return parts.length > 0 ? parts.join(" • ") : null;
}

function formatIntensity(b: Block): string | null {
  if (typeof b.intensityLabel === "string" && b.intensityLabel.trim().length > 0) {
    return b.intensityLabel.trim();
  }

  const r = b.intensityRange;
  if (!r) return null;

  const min = typeof r.min === "number" ? r.min : null;
  const max = typeof r.max === "number" ? r.max : null;
  const unit = r.unit;

  if (unit === "rpe") {
    if (min != null && max != null) return `RPE ${min}–${max}`;
    if (min != null) return `RPE ${min}`;
    return "RPE";
  }
  if (unit === "w") {
    if (min != null && max != null) return `${min}–${max} W`;
    if (min != null) return `${min} W`;
    return "Power";
  }
  if (unit === "bpm") {
    if (min != null && max != null) return `${min}–${max} bpm`;
    if (min != null) return `${min} bpm`;
    return "HR";
  }
  if (unit === "min/km") {
    if (min != null && max != null) return `${min}–${max} min/km`;
    if (min != null) return `${min} min/km`;
    return "Pace";
  }
  if (unit === "sec/100m") {
    if (min != null && max != null) return `${min}–${max} sec/100m`;
    if (min != null) return `${min} sec/100m`;
    return "Swim pace";
  }

  return null;
}

function formatDistance(m: number): string {
  if (m >= 1000 && m % 100 === 0) return `${Math.round((m / 1000) * 10) / 10} km`;
  if (m >= 1000 && m % 1000 === 0) return `${m / 1000} km`;
  return `${Math.round(m)} m`;
}

function formatDuration(sec: number): string {
  const s = Math.max(0, Math.round(sec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}`;
  return `${m}:${String(r).padStart(2, "0")}`;
}

