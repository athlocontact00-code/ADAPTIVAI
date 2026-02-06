"use client";

import React from "react";
import type { Block, StructuredWorkoutPlan } from "@/lib/plans/types";
import { formatTextForDisplay } from "@/lib/plans/format";
import { Badge } from "@/components/ui/badge";

export function PlanRenderer({
  plan,
  density = "comfortable",
}: {
  plan: StructuredWorkoutPlan;
  density?: "comfortable" | "compact";
}) {
  return (
    <div className="space-y-3">
      {plan.objective && (
        <div className="rounded-card border bg-muted/20 p-4">
          <div className="text-2xs uppercase tracking-wide text-muted-foreground">Objective</div>
          <div className="mt-1 text-sm font-medium leading-snug">{plan.objective}</div>
        </div>
      )}

      {plan.sections.map((section) => (
        <section key={section.id} className="rounded-card border bg-muted/10 overflow-hidden">
          <header className="flex items-center justify-between gap-3 px-4 py-3 border-b border-border/50">
            <div className="min-w-0">
              <h4 className="truncate text-sm font-semibold">{section.title}</h4>
              <div className="text-2xs text-muted-foreground capitalize">{prettySectionType(section.type)}</div>
            </div>
            <Badge variant="muted" className="shrink-0 tabular-nums">
              {section.blocks.length} block{section.blocks.length === 1 ? "" : "s"}
            </Badge>
          </header>

          {section.blocks.length === 0 ? (
            <div className="px-4 py-3 text-xs text-muted-foreground">No blocks yet.</div>
          ) : (
            <div className="divide-y divide-border/40">
              {section.blocks.map((b, idx) => (
                <BlockRow key={b.id} block={b} index={idx + 1} density={density} />
              ))}
            </div>
          )}
        </section>
      ))}
    </div>
  );
}

export function PlanTextRenderer({
  text,
  density = "comfortable",
}: {
  text: string;
  density?: "comfortable" | "compact";
}) {
  const sections = formatTextForDisplay(text);
  if (sections.length === 0) return null;

  return (
    <div className="space-y-3">
      {sections.map((s) => (
        <section key={s.id} className="rounded-card border bg-muted/10 overflow-hidden">
          <header className="px-4 py-3 border-b border-border/50">
            <h4 className="text-sm font-semibold">{s.title}</h4>
          </header>

          <div className={density === "compact" ? "px-4 py-3" : "px-4 py-4"}>
            {renderFormattedLines(s.lines)}
          </div>
        </section>
      ))}
    </div>
  );
}

function renderFormattedLines(lines: Array<{ kind: "bullet" | "text"; text: string }>) {
  const hasBullets = lines.some((l) => l.kind === "bullet");
  const onlyBullets = hasBullets && lines.every((l) => l.kind === "bullet");

  if (onlyBullets) {
    return (
      <ul className="space-y-1 text-xs text-muted-foreground">
        {lines.map((l, i) => (
          <li key={i} className="whitespace-pre-wrap">
            {l.text}
          </li>
        ))}
      </ul>
    );
  }

  return (
    <div className="space-y-2 text-xs text-muted-foreground">
      {lines.map((l, i) =>
        l.kind === "bullet" ? (
          <div key={i} className="flex gap-2">
            <div className="mt-1 h-1.5 w-1.5 rounded-full bg-muted-foreground/50 shrink-0" />
            <div className="whitespace-pre-wrap">{l.text}</div>
          </div>
        ) : (
          <div key={i} className="whitespace-pre-wrap">
            {l.text}
          </div>
        )
      )}
    </div>
  );
}

function BlockRow({
  block,
  index,
  density,
}: {
  block: Block;
  index: number;
  density: "comfortable" | "compact";
}) {
  const main = formatBlockMain(block);
  const intensity = formatBlockIntensity(block);
  const rest = typeof block.restSec === "number" && block.restSec > 0 ? `Rest ${formatDuration(block.restSec)}` : null;
  const cue = typeof block.notes === "string" && block.notes.trim().length > 0 ? block.notes.trim() : null;

  const right = [intensity, rest].filter(Boolean).join(" • ");

  return (
    <div className={density === "compact" ? "px-4 py-2.5" : "px-4 py-3.5"}>
      <div className="grid grid-cols-[1fr_auto] gap-4 items-start">
        <div className="min-w-0">
          <div className="flex items-baseline gap-2">
            <span className="text-2xs text-muted-foreground tabular-nums">{String(index).padStart(2, "0")}</span>
            <span className="text-sm font-medium tabular-nums">{main ?? "—"}</span>
          </div>
          {cue && cue !== main && <div className="mt-0.5 text-xs text-muted-foreground whitespace-pre-wrap">{cue}</div>}
        </div>
        {right ? (
          <div className="text-right text-xs text-muted-foreground tabular-nums whitespace-nowrap">{right}</div>
        ) : (
          <div className="text-right text-xs text-muted-foreground tabular-nums whitespace-nowrap"> </div>
        )}
      </div>
    </div>
  );
}

function prettySectionType(t: any): string {
  if (t === "warmup") return "Warm-up";
  if (t === "cooldown") return "Cool-down";
  if (t === "strength") return "Strength";
  if (t === "technique") return "Technique";
  return "Main set";
}

function formatBlockMain(b: Block): string | null {
  const reps = typeof b.reps === "number" && b.reps > 0 ? b.reps : null;
  const dist = typeof b.distanceM === "number" && b.distanceM > 0 ? b.distanceM : null;
  const dur = typeof b.durationSec === "number" && b.durationSec > 0 ? b.durationSec : null;

  if (reps && dist) return `${reps}×${formatDistance(dist)}`;
  if (reps && dur) return `${reps}×${formatDuration(dur)}`;
  if (dist) return formatDistance(dist);
  if (dur) return formatDuration(dur);
  return null;
}

function formatBlockIntensity(b: Block): string | null {
  if (typeof b.intensityLabel === "string" && b.intensityLabel.trim().length > 0) return b.intensityLabel.trim();
  if (!b.intensityRange) return null;

  const r = b.intensityRange;
  const min = typeof r.min === "number" ? r.min : null;
  const max = typeof r.max === "number" ? r.max : null;

  if (r.unit === "rpe") {
    if (min != null && max != null) return `RPE ${min}–${max}`;
    if (min != null) return `RPE ${min}`;
    return "RPE";
  }
  if (r.unit === "w") {
    if (min != null && max != null) return `${min}–${max} W`;
    if (min != null) return `${min} W`;
    return "Power";
  }
  if (r.unit === "bpm") {
    if (min != null && max != null) return `${min}–${max} bpm`;
    if (min != null) return `${min} bpm`;
    return "HR";
  }
  if (r.unit === "min/km") {
    if (min != null && max != null) return `${min}–${max} min/km`;
    if (min != null) return `${min} min/km`;
    return "Pace";
  }
  if (r.unit === "sec/100m") {
    if (min != null && max != null) return `${min}–${max} sec/100m`;
    if (min != null) return `${min} sec/100m`;
    return "Pace";
  }
  return null;
}

function formatDistance(m: number): string {
  if (m >= 1000 && m % 1000 === 0) return `${m / 1000} km`;
  if (m >= 1000 && m % 100 === 0) return `${Math.round((m / 1000) * 10) / 10} km`;
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
