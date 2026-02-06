"use client";

import React from "react";
import { Trash2, Plus, Wand2 } from "lucide-react";
import type { StructuredWorkoutPlan, Section, Block, SectionType, IntensityUnit } from "@/lib/plans/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

export function StructuredBuilder({
  value,
  discipline,
  onChange,
  showTemplates = true,
}: {
  value: StructuredWorkoutPlan;
  discipline?: string;
  onChange: (plan: StructuredWorkoutPlan) => void;
  showTemplates?: boolean;
}) {
  const plan = value;

  function update(next: StructuredWorkoutPlan) {
    onChange({ ...next, version: 2 });
  }

  function addSection(type: SectionType) {
    const next: StructuredWorkoutPlan = {
      ...plan,
      sections: [...(plan.sections ?? []), createSection(type)],
    };
    update(next);
  }

  function addBlock(sectionId: string) {
    const blk: Block = { id: newId(), notes: "" };
    const next = {
      ...plan,
      sections: plan.sections.map((s) => (s.id === sectionId ? { ...s, blocks: [...s.blocks, blk] } : s)),
    };
    update(next);
  }

  function updateBlock(sectionId: string, block: Block) {
    const next = {
      ...plan,
      sections: plan.sections.map((s) => {
        if (s.id !== sectionId) return s;
        return { ...s, blocks: s.blocks.map((b) => (b.id === block.id ? block : b)) };
      }),
    };
    update(next);
  }

  function deleteBlock(sectionId: string, blockId: string) {
    const next = {
      ...plan,
      sections: plan.sections.map((s) =>
        s.id === sectionId ? { ...s, blocks: s.blocks.filter((b) => b.id !== blockId) } : s
      ),
    };
    update(next);
  }

  function deleteSection(sectionId: string) {
    const next = {
      ...plan,
      sections: plan.sections.filter((s) => s.id !== sectionId),
    };
    update(next);
  }

  const templates = getTemplatesForDiscipline(discipline);
  const canDeleteSection = (s: Section) => s.type === "technique" || s.type === "strength";

  function applyTemplate(templateId: string) {
    const t = templates.find((x) => x.id === templateId);
    if (!t) return;
    update(t.build());
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <Label className="text-2xs uppercase tracking-wide text-muted-foreground">Objective</Label>
        <Input
          value={plan.objective ?? ""}
          onChange={(e) => update({ ...plan, objective: e.target.value })}
          placeholder="e.g. Aerobic base + smooth cadence"
        />
      </div>

      {showTemplates && templates.length > 0 && (
        <div className="rounded-card border bg-muted/10 p-3">
          <div className="flex items-center justify-between gap-3 mb-2">
            <div className="flex items-center gap-2">
              <Wand2 className="h-4 w-4 text-muted-foreground" />
              <div className="text-sm font-medium">Quick templates</div>
            </div>
            <Badge variant="muted" className="capitalize">
              {discipline ?? "workout"}
            </Badge>
          </div>
          <div className="flex flex-wrap gap-2">
            {templates.map((t) => (
              <Button key={t.id} type="button" variant="outline" size="sm" onClick={() => applyTemplate(t.id)}>
                {t.label}
              </Button>
            ))}
          </div>
          <div className="mt-2 text-2xs text-muted-foreground">
            Templates overwrite the current structured plan (you can edit afterwards).
          </div>
        </div>
      )}

      {plan.sections.map((s) => (
        <div key={s.id} className="rounded-card border bg-muted/10 overflow-hidden">
          <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-border/50">
            <div className="min-w-0 flex items-center gap-2">
              <Badge variant="muted" className="capitalize">
                {s.type}
              </Badge>
              <Input
                value={s.title}
                onChange={(e) =>
                  update({
                    ...plan,
                    sections: plan.sections.map((x) => (x.id === s.id ? { ...x, title: e.target.value } : x)),
                  })
                }
                className="h-8 text-sm font-semibold bg-transparent border-transparent focus-visible:border-border/60"
              />
            </div>

            <div className="flex items-center gap-2">
              {canDeleteSection(s) && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => deleteSection(s.id)}
                  aria-label="Delete section"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
              <Button type="button" size="sm" onClick={() => addBlock(s.id)}>
                <Plus className="h-4 w-4 mr-2" />
                Add block
              </Button>
            </div>
          </div>

          <div className="p-4 space-y-3">
            {s.blocks.map((b) => (
              <BlockEditor
                key={b.id}
                block={b}
                onChange={(nb) => updateBlock(s.id, nb)}
                onDelete={() => deleteBlock(s.id, b.id)}
              />
            ))}
            {s.blocks.length === 0 && (
              <div className="text-xs text-muted-foreground">Add blocks to define the prescription.</div>
            )}
          </div>
        </div>
      ))}

      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" onClick={() => addSection("technique")}>
          <Plus className="h-4 w-4 mr-2" />
          Add technique
        </Button>
        <Button type="button" variant="outline" onClick={() => addSection("strength")}>
          <Plus className="h-4 w-4 mr-2" />
          Add strength
        </Button>
      </div>
    </div>
  );
}

function BlockEditor({
  block,
  onChange,
  onDelete,
}: {
  block: Block;
  onChange: (b: Block) => void;
  onDelete: () => void;
}) {
  const intensityType = block.intensityType ?? "none";

  return (
    <div className="rounded-control border bg-background/40 p-3 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 space-y-1">
          <Label className="text-2xs text-muted-foreground">Cue / notes</Label>
          <Input
            placeholder='e.g. "easy jog", "smooth form", "pull buoy"'
            value={block.notes ?? ""}
            onChange={(e) => onChange({ ...block, notes: e.target.value })}
          />
        </div>
        <Button type="button" variant="ghost" size="icon" onClick={onDelete} aria-label="Delete block">
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      <div className="grid grid-cols-12 gap-2 items-end">
        <div className="col-span-4 sm:col-span-2">
          <Label className="text-2xs text-muted-foreground">Reps</Label>
          <Input
            type="number"
            inputMode="numeric"
            placeholder="—"
            value={block.reps?.toString() ?? ""}
            onChange={(e) => onChange({ ...block, reps: toInt(e.target.value) ?? undefined })}
          />
        </div>
        <div className="col-span-8 sm:col-span-5">
          <Label className="text-2xs text-muted-foreground">Distance (m)</Label>
          <Input
            type="number"
            inputMode="numeric"
            placeholder="e.g. 400"
            value={block.distanceM?.toString() ?? ""}
            onChange={(e) => onChange({ ...block, distanceM: toInt(e.target.value) ?? undefined })}
          />
        </div>
        <div className="col-span-6 sm:col-span-3">
          <Label className="text-2xs text-muted-foreground">Time (min)</Label>
          <Input
            type="number"
            inputMode="numeric"
            placeholder="e.g. 10"
            value={typeof block.durationSec === "number" ? String(Math.round(block.durationSec / 60)) : ""}
            onChange={(e) => {
              const v = toInt(e.target.value);
              onChange({ ...block, durationSec: v != null ? v * 60 : undefined });
            }}
          />
        </div>
        <div className="col-span-6 sm:col-span-2">
          <Label className="text-2xs text-muted-foreground">Rest (sec)</Label>
          <Input
            type="number"
            inputMode="numeric"
            placeholder="e.g. 60"
            value={block.restSec?.toString() ?? ""}
            onChange={(e) => onChange({ ...block, restSec: toInt(e.target.value) ?? undefined })}
          />
        </div>
      </div>

      <div className="grid grid-cols-12 gap-2 items-end">
        <div className="col-span-6 sm:col-span-4">
          <Label className="text-2xs text-muted-foreground">Intensity</Label>
          <Select
            value={intensityType}
            onValueChange={(v) => {
              if (v === "none") {
                onChange({
                  ...block,
                  intensityType: undefined,
                  intensityLabel: undefined,
                  intensityRange: undefined,
                });
                return;
              }
              if (v === "zone") {
                onChange({
                  ...block,
                  intensityType: "zone",
                  intensityLabel: block.intensityLabel?.startsWith("Z") ? block.intensityLabel : "Z2",
                  intensityRange: undefined,
                });
                return;
              }
              if (v === "rpe") {
                onChange({
                  ...block,
                  intensityType: "rpe",
                  intensityLabel: undefined,
                  intensityRange: block.intensityRange?.unit === "rpe" ? block.intensityRange : { unit: "rpe", min: 6 },
                });
                return;
              }
              if (v === "hr") {
                onChange({
                  ...block,
                  intensityType: "hr",
                  intensityLabel: undefined,
                  intensityRange: block.intensityRange?.unit === "bpm" ? block.intensityRange : { unit: "bpm", min: 140, max: 160 },
                });
                return;
              }
              if (v === "power") {
                onChange({
                  ...block,
                  intensityType: "power",
                  intensityLabel: undefined,
                  intensityRange: block.intensityRange?.unit === "w" ? block.intensityRange : { unit: "w", min: 180, max: 220 },
                });
                return;
              }
              if (v === "pace") {
                onChange({
                  ...block,
                  intensityType: "pace",
                  intensityLabel: block.intensityLabel ?? "",
                  intensityRange: undefined,
                });
                return;
              }
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="—" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">—</SelectItem>
              <SelectItem value="zone">Zone (Z1–Z5)</SelectItem>
              <SelectItem value="rpe">RPE</SelectItem>
              <SelectItem value="pace">Pace (label)</SelectItem>
              <SelectItem value="power">Power (W)</SelectItem>
              <SelectItem value="hr">HR (bpm)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {block.intensityType === "zone" && (
          <div className="col-span-6 sm:col-span-4">
            <Label className="text-2xs text-muted-foreground">Zone</Label>
            <Select
              value={block.intensityLabel ?? "Z2"}
              onValueChange={(v) => onChange({ ...block, intensityLabel: v, intensityType: "zone" })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {["Z1", "Z2", "Z3", "Z4", "Z5"].map((z) => (
                  <SelectItem key={z} value={z}>
                    {z}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {block.intensityType === "rpe" && (
          <RangeEditor
            unit="rpe"
            label="RPE"
            value={block.intensityRange?.unit === "rpe" ? block.intensityRange : { unit: "rpe", min: 6 }}
            onChange={(r) => onChange({ ...block, intensityRange: r, intensityType: "rpe" })}
          />
        )}

        {block.intensityType === "hr" && (
          <RangeEditor
            unit="bpm"
            label="HR (bpm)"
            value={block.intensityRange?.unit === "bpm" ? block.intensityRange : { unit: "bpm", min: 140, max: 160 }}
            onChange={(r) => onChange({ ...block, intensityRange: r, intensityType: "hr" })}
          />
        )}

        {block.intensityType === "power" && (
          <RangeEditor
            unit="w"
            label="Power (W)"
            value={block.intensityRange?.unit === "w" ? block.intensityRange : { unit: "w", min: 180, max: 220 }}
            onChange={(r) => onChange({ ...block, intensityRange: r, intensityType: "power" })}
          />
        )}

        {block.intensityType === "pace" && (
          <div className="col-span-6 sm:col-span-8">
            <Label className="text-2xs text-muted-foreground">Pace label</Label>
            <Input
              placeholder="e.g. 4:10–4:25/km or 1:45/100m"
              value={block.intensityLabel ?? ""}
              onChange={(e) => onChange({ ...block, intensityLabel: e.target.value, intensityType: "pace" })}
            />
          </div>
        )}
      </div>
    </div>
  );
}

function RangeEditor({
  unit,
  label,
  value,
  onChange,
}: {
  unit: IntensityUnit;
  label: string;
  value: { unit: IntensityUnit; min?: number; max?: number };
  onChange: (next: { unit: IntensityUnit; min?: number; max?: number }) => void;
}) {
  return (
    <div className="col-span-6 sm:col-span-8">
      <Label className="text-2xs text-muted-foreground">{label}</Label>
      <div className="grid grid-cols-2 gap-2">
        <Input
          type="number"
          inputMode="numeric"
          placeholder="min"
          value={value.min?.toString() ?? ""}
          onChange={(e) => onChange({ unit, min: toInt(e.target.value) ?? undefined, max: value.max })}
        />
        <Input
          type="number"
          inputMode="numeric"
          placeholder="max"
          value={value.max?.toString() ?? ""}
          onChange={(e) => onChange({ unit, min: value.min, max: toInt(e.target.value) ?? undefined })}
        />
      </div>
    </div>
  );
}

type TemplateOption = {
  id: string;
  label: string;
  build: () => StructuredWorkoutPlan;
};

function getTemplatesForDiscipline(discipline?: string): TemplateOption[] {
  const d = (discipline ?? "").toLowerCase();
  if (d === "run") {
    return [
      { id: "run_easy", label: "Easy run", build: () => templateRunEasy() },
      { id: "run_tempo", label: "Tempo", build: () => templateRunTempo() },
      { id: "run_intervals", label: "Intervals", build: () => templateRunIntervals() },
    ];
  }
  if (d === "bike") {
    return [
      { id: "bike_endurance", label: "Endurance", build: () => templateBikeEndurance() },
      { id: "bike_tempo", label: "Tempo", build: () => templateBikeTempo() },
      { id: "bike_threshold", label: "Threshold", build: () => templateBikeThreshold() },
    ];
  }
  if (d === "swim") {
    return [
      { id: "swim_technique", label: "Technique", build: () => templateSwimTechnique() },
      { id: "swim_intervals", label: "Intervals", build: () => templateSwimIntervals() },
    ];
  }
  return [];
}

function templateBase(params: { objective: string; warmup?: Block[]; main?: Block[]; cooldown?: Block[]; technique?: Block[] }): StructuredWorkoutPlan {
  const mk = (type: SectionType, title: string, blocks: Block[]) => ({
    id: newId(),
    type,
    title,
    blocks: blocks.map((b) => ({ ...b, id: b.id || newId() })),
  });
  const sections = [
    mk("warmup", "Warm-up", params.warmup ?? []),
    mk("main", "Main set", params.main ?? []),
    mk("cooldown", "Cool-down", params.cooldown ?? []),
    ...(params.technique && params.technique.length > 0 ? [mk("technique", "Technique", params.technique)] : []),
  ].filter((s) => s.blocks.length > 0);

  return { version: 2, objective: params.objective, sections };
}

function templateRunEasy(): StructuredWorkoutPlan {
  return templateBase({
    objective: "Aerobic base • relaxed cadence",
    warmup: [{ id: newId(), durationSec: 10 * 60, intensityType: "zone", intensityLabel: "Z1", notes: "easy jog" }],
    main: [{ id: newId(), durationSec: 35 * 60, intensityType: "zone", intensityLabel: "Z2", notes: "conversational" }],
    cooldown: [{ id: newId(), durationSec: 5 * 60, intensityType: "zone", intensityLabel: "Z1", notes: "easy" }],
  });
}

function templateRunTempo(): StructuredWorkoutPlan {
  return templateBase({
    objective: "Controlled tempo • smooth form",
    warmup: [{ id: newId(), durationSec: 12 * 60, intensityType: "zone", intensityLabel: "Z2", notes: "easy + drills" }],
    main: [
      { id: newId(), reps: 3, durationSec: 10 * 60, intensityType: "zone", intensityLabel: "Z3", restSec: 5 * 60, notes: "steady tempo" },
    ],
    cooldown: [{ id: newId(), durationSec: 8 * 60, intensityType: "zone", intensityLabel: "Z1", notes: "easy" }],
  });
}

function templateRunIntervals(): StructuredWorkoutPlan {
  return templateBase({
    objective: "Speed endurance • quality reps",
    warmup: [{ id: newId(), durationSec: 15 * 60, intensityType: "zone", intensityLabel: "Z2", notes: "include 4×20s strides" }],
    main: [
      { id: newId(), reps: 6, durationSec: 2 * 60, intensityType: "rpe", intensityRange: { unit: "rpe", min: 8 }, restSec: 2 * 60, notes: "strong / controlled" },
    ],
    cooldown: [{ id: newId(), durationSec: 10 * 60, intensityType: "zone", intensityLabel: "Z1", notes: "easy" }],
  });
}

function templateBikeEndurance(): StructuredWorkoutPlan {
  return templateBase({
    objective: "Endurance • steady pressure",
    warmup: [{ id: newId(), durationSec: 12 * 60, intensityType: "zone", intensityLabel: "Z1", notes: "easy spin" }],
    main: [{ id: newId(), durationSec: 55 * 60, intensityType: "zone", intensityLabel: "Z2", notes: "keep it smooth" }],
    cooldown: [{ id: newId(), durationSec: 8 * 60, intensityType: "zone", intensityLabel: "Z1", notes: "easy" }],
  });
}

function templateBikeTempo(): StructuredWorkoutPlan {
  return templateBase({
    objective: "Tempo • sustained work",
    warmup: [{ id: newId(), durationSec: 15 * 60, intensityType: "zone", intensityLabel: "Z2", notes: "easy spin" }],
    main: [{ id: newId(), reps: 3, durationSec: 12 * 60, intensityType: "zone", intensityLabel: "Z3", restSec: 6 * 60, notes: "steady" }],
    cooldown: [{ id: newId(), durationSec: 10 * 60, intensityType: "zone", intensityLabel: "Z1", notes: "easy" }],
  });
}

function templateBikeThreshold(): StructuredWorkoutPlan {
  return templateBase({
    objective: "Threshold • smooth power",
    warmup: [{ id: newId(), durationSec: 15 * 60, intensityType: "zone", intensityLabel: "Z2", notes: "include 3×30s pickups" }],
    main: [{ id: newId(), reps: 4, durationSec: 6 * 60, intensityType: "zone", intensityLabel: "Z4", restSec: 4 * 60, notes: "no surges" }],
    cooldown: [{ id: newId(), durationSec: 10 * 60, intensityType: "zone", intensityLabel: "Z1", notes: "easy" }],
  });
}

function templateSwimTechnique(): StructuredWorkoutPlan {
  return templateBase({
    objective: "Technique • feel for water",
    warmup: [{ id: newId(), distanceM: 400, intensityType: "zone", intensityLabel: "Z1", notes: "easy mix" }],
    technique: [{ id: newId(), reps: 8, distanceM: 50, restSec: 20, notes: "drills: catch-up / fingertip drag" }],
    main: [{ id: newId(), reps: 6, distanceM: 100, restSec: 20, intensityType: "zone", intensityLabel: "Z2", notes: "smooth" }],
    cooldown: [{ id: newId(), distanceM: 200, intensityType: "zone", intensityLabel: "Z1", notes: "easy" }],
  });
}

function templateSwimIntervals(): StructuredWorkoutPlan {
  return templateBase({
    objective: "Intervals • controlled hard",
    warmup: [{ id: newId(), distanceM: 400, intensityType: "zone", intensityLabel: "Z1", notes: "easy + drills" }],
    main: [{ id: newId(), reps: 12, distanceM: 100, restSec: 30, intensityType: "rpe", intensityRange: { unit: "rpe", min: 8 }, notes: "strong" }],
    cooldown: [{ id: newId(), distanceM: 200, intensityType: "zone", intensityLabel: "Z1", notes: "easy" }],
  });
}

function createSection(type: SectionType): Section {
  const title =
    type === "warmup"
      ? "Warm-up"
      : type === "cooldown"
        ? "Cool-down"
        : type === "strength"
          ? "Strength"
          : type === "technique"
            ? "Technique"
            : "Main set";
  return { id: newId(), type, title, blocks: [] };
}

function toInt(v: string): number | null {
  const s = v.trim();
  if (!s) return null;
  const n = parseInt(s, 10);
  return Number.isFinite(n) ? n : null;
}

function newId(): string {
  const c = globalThis.crypto as unknown as undefined | { randomUUID?: () => string };
  return c?.randomUUID?.() ?? `id_${Math.random().toString(36).slice(2, 10)}`;
}
