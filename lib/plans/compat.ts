import type { StructuredWorkoutPlan, SectionType } from "./types";
import { parseTextToStructured } from "./parser";

export type WorkoutPrescriptionV1 = {
  version: 1;
  overview?: { durationMin?: number; intensity?: string };
  warmUp?: { minutes?: number; text?: string };
  mainSet?: { minutes?: number; text?: string };
  coolDown?: { minutes?: number; text?: string };
  targets?: Array<{ label?: string; value?: string }>;
  why?: string;
  contextUsed?: Array<{ label?: string; value?: string }>;
};

export type AnyWorkoutPlanJson =
  | { kind: "structured_v2"; plan: StructuredWorkoutPlan }
  | { kind: "prescription_v1"; plan: WorkoutPrescriptionV1 };

function isRecord(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === "object";
}

function isNotNull<T>(v: T | null | undefined): v is T {
  return v != null;
}

function randomId(): string {
  const c = globalThis.crypto as unknown as undefined | { randomUUID?: () => string };
  return c?.randomUUID?.() ?? `id_${Math.random().toString(36).slice(2, 10)}`;
}

const SECTION_TYPES: SectionType[] = ["warmup", "main", "cooldown", "strength", "technique"];

function toSectionType(v: unknown): SectionType {
  return typeof v === "string" && (SECTION_TYPES as string[]).includes(v) ? (v as SectionType) : "main";
}

export function parseWorkoutPlanJson(raw: string): AnyWorkoutPlanJson | null {
  if (typeof raw !== "string" || raw.trim().length === 0) return null;
  const parsed = safeJsonParse(raw);
  if (!parsed) return null;

  const v = (parsed as Record<string, unknown>).version;
  if (v === 1) {
    const p1 = parseWorkoutPrescriptionV1Object(parsed);
    return p1 ? { kind: "prescription_v1", plan: p1 } : null;
  }

  const v2 = coerceStructuredWorkoutPlan(parsed);
  return v2 ? { kind: "structured_v2", plan: v2 } : null;
}

export function parseStructuredWorkoutPlanJson(raw: string): StructuredWorkoutPlan | null {
  const parsed = safeJsonParse(raw);
  return parsed ? coerceStructuredWorkoutPlan(parsed) : null;
}

export function stringifyStructuredWorkoutPlan(plan: StructuredWorkoutPlan): string {
  const normalized: StructuredWorkoutPlan = {
    version: 2,
    objective: typeof plan.objective === "string" ? plan.objective : undefined,
    sections: Array.isArray(plan.sections) ? plan.sections : [],
  };
  return JSON.stringify(normalized);
}

export function convertPrescriptionV1ToStructured(v1: WorkoutPrescriptionV1): StructuredWorkoutPlan {
  const warm = typeof v1.warmUp?.text === "string" ? v1.warmUp.text : "";
  const main = typeof v1.mainSet?.text === "string" ? v1.mainSet.text : "";
  const cool = typeof v1.coolDown?.text === "string" ? v1.coolDown.text : "";

  const toBullets = (t: string) => {
    const lines = t.replace(/\r\n/g, "\n").split("\n").map((l) => l.trim()).filter(Boolean);
    if (lines.length === 0) return "";
    const allBullets = lines.every((l) => /^[-*•]\s+/.test(l));
    if (allBullets) return lines.join("\n");
    return lines.map((l) => `- ${l.replace(/^[-*•]\s+/, "")}`).join("\n");
  };

  const text = [
    warm.trim().length > 0 ? `Warm-up\n${toBullets(warm)}` : "",
    main.trim().length > 0 ? `Main set\n${toBullets(main)}` : "",
    cool.trim().length > 0 ? `Cool-down\n${toBullets(cool)}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");

  const parsed = parseTextToStructured(text);

  const objective = objectiveFromWhy(typeof v1.why === "string" ? v1.why : null);
  if (parsed) {
    return {
      ...parsed,
      version: 2,
      objective: objective ?? parsed.objective ?? undefined,
    };
  }

  // Fallback if parsing fails (should be rare): coarse blocks.
  return {
    version: 2,
    objective: objective ?? undefined,
    sections: [
      warm.trim()
        ? {
            id: randomId(),
            type: "warmup",
            title: "Warm-up",
            blocks: [{ id: randomId(), notes: warm.trim() }],
          }
        : null,
      main.trim()
        ? {
            id: randomId(),
            type: "main",
            title: "Main set",
            blocks: [{ id: randomId(), notes: main.trim() }],
          }
        : null,
      cool.trim()
        ? {
            id: randomId(),
            type: "cooldown",
            title: "Cool-down",
            blocks: [{ id: randomId(), notes: cool.trim() }],
          }
        : null,
    ].filter(Boolean) as StructuredWorkoutPlan["sections"],
  };
}

export function objectiveFromWhy(why: string | null): string | null {
  if (!why) return null;
  const cleaned = why.replace(/\s+/g, " ").trim();
  if (cleaned.length < 6) return null;
  // Prefer first sentence as a short objective-like summary.
  const firstSentence = cleaned.split(/(?<=[.!?])\s+/).filter(Boolean)[0] ?? cleaned;
  const clipped = firstSentence.length > 140 ? `${firstSentence.slice(0, 137).trim()}…` : firstSentence;
  return clipped;
}

function safeJsonParse(raw: string): unknown | null {
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
}

function parseWorkoutPrescriptionV1Object(obj: unknown): WorkoutPrescriptionV1 | null {
  if (!isRecord(obj)) return null;
  if (obj.version !== 1) return null;

  // We intentionally keep it permissive to avoid breaking existing DB data.
  return obj as WorkoutPrescriptionV1;
}

function coerceStructuredWorkoutPlan(obj: unknown): StructuredWorkoutPlan | null {
  if (!isRecord(obj)) return null;
  if (obj.version === 1) return null;

  const sectionsRaw = obj.sections;
  if (!Array.isArray(sectionsRaw) || sectionsRaw.length === 0) return null;

  const sections = sectionsRaw
    .map((s): StructuredWorkoutPlan["sections"][number] | null => {
      if (!isRecord(s)) return null;
      const blocksRaw = s.blocks;
      const blocks = Array.isArray(blocksRaw)
        ? blocksRaw
            .map((b): StructuredWorkoutPlan["sections"][number]["blocks"][number] | null => {
              if (!isRecord(b)) return null;
              const intensityRangeRaw = b.intensityRange;
              const intensityRange =
                isRecord(intensityRangeRaw) &&
                typeof intensityRangeRaw.unit === "string" &&
                ["w", "bpm", "min/km", "sec/100m", "rpe"].includes(intensityRangeRaw.unit)
                  ? {
                      unit: intensityRangeRaw.unit as any,
                      min: typeof intensityRangeRaw.min === "number" ? intensityRangeRaw.min : undefined,
                      max: typeof intensityRangeRaw.max === "number" ? intensityRangeRaw.max : undefined,
                    }
                  : undefined;

              const intensityType =
                typeof b.intensityType === "string" &&
                ["pace", "power", "hr", "rpe", "zone"].includes(b.intensityType)
                  ? (b.intensityType as any)
                  : undefined;

              return {
                id: typeof b.id === "string" ? b.id : randomId(),
                reps: typeof b.reps === "number" && Number.isFinite(b.reps) ? b.reps : undefined,
                distanceM:
                  typeof b.distanceM === "number" && Number.isFinite(b.distanceM) ? b.distanceM : undefined,
                durationSec:
                  typeof b.durationSec === "number" && Number.isFinite(b.durationSec) ? b.durationSec : undefined,
                intensityType,
                intensityLabel: typeof b.intensityLabel === "string" ? b.intensityLabel : undefined,
                intensityRange,
                restSec: typeof b.restSec === "number" && Number.isFinite(b.restSec) ? b.restSec : undefined,
                notes: typeof b.notes === "string" ? b.notes : undefined,
              };
            })
            .filter(isNotNull)
        : [];

      const type = toSectionType(s.type);
      const title =
        typeof s.title === "string" && s.title.trim().length > 0 ? s.title.trim() : defaultTitleForType(type);

      return {
        id: typeof s.id === "string" ? s.id : randomId(),
        type,
        title,
        blocks,
      };
    })
    .filter(isNotNull);

  if (sections.length === 0) return null;

  const objective = typeof obj.objective === "string" ? obj.objective : undefined;
  return {
    version: 2,
    objective,
    sections,
  };
}

function defaultTitleForType(t: SectionType): string {
  if (t === "warmup") return "Warm-up";
  if (t === "cooldown") return "Cool-down";
  if (t === "strength") return "Strength";
  if (t === "technique") return "Technique";
  return "Main";
}

