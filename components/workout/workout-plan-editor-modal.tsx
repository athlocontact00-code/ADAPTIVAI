"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Bot, Loader2, Sparkles } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import type { StructuredWorkoutPlan } from "@/lib/plans/types";
import { parseTextToStructured } from "@/lib/plans/parser";
import {
  convertPrescriptionV1ToStructured,
  parseWorkoutPlanJson,
  stringifyStructuredWorkoutPlan,
} from "@/lib/plans/compat";
import { exportStructuredToText } from "@/lib/plans/format";
import { PlanRenderer, PlanTextRenderer } from "@/components/workout/plan-renderer";
import { StructuredBuilder } from "@/components/workout/structured-builder";
import {
  applyCoachWorkoutPlan,
  generateCoachWorkoutPlan,
  type CoachGeneratedWorkoutPlan,
} from "@/lib/actions/coach-workout-plan";

type WorkoutLike = {
  id: string;
  title: string;
  type: string;
  date: string | Date;
  descriptionMd?: string | null;
  prescriptionJson?: string | null;
};

export function WorkoutPlanEditorModal({
  open,
  onOpenChange,
  workout,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workout: WorkoutLike | null;
  onSaved?: (updated: { descriptionMd: string | null; prescriptionJson: string | null }) => void;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<"structured" | "text">("structured");
  const [structured, setStructured] = useState<StructuredWorkoutPlan>(() => emptyPlan());
  const [text, setText] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [generatingCoach, setGeneratingCoach] = useState(false);
  const [coachResult, setCoachResult] = useState<CoachGeneratedWorkoutPlan | null>(null);
  const [useAdjusted, setUseAdjusted] = useState(false);
  const [applyingCoach, setApplyingCoach] = useState(false);

  useEffect(() => {
    if (!open || !workout) return;

    const rawJson = typeof workout.prescriptionJson === "string" ? workout.prescriptionJson : "";
    const parsedJson = rawJson.trim().length > 0 ? parseWorkoutPlanJson(rawJson) : null;

    const initialStructured = (() => {
      if (parsedJson?.kind === "structured_v2") return parsedJson.plan;
      if (parsedJson?.kind === "prescription_v1") return convertPrescriptionV1ToStructured(parsedJson.plan);
      const rawText = typeof workout.descriptionMd === "string" ? workout.descriptionMd : "";
      const parsedText = rawText.trim().length > 0 ? parseTextToStructured(rawText) : null;
      return parsedText ?? emptyPlan();
    })();

    const initialText = (() => {
      const rawText = typeof workout.descriptionMd === "string" ? workout.descriptionMd : "";
      if (rawText.trim().length > 0) return rawText;
      const exported = exportStructuredToText(initialStructured);
      return exported;
    })();

    setMode("structured");
    setStructured(initialStructured);
    setText(initialText);
    setCoachResult(null);
    setUseAdjusted(false);
  }, [open, workout]);

  const preview = useMemo(() => {
    if (mode === "structured") {
      return { kind: "structured" as const, structured };
    }
    const parsed = parseTextToStructured(text);
    if (parsed) return { kind: "parsed_text" as const, structured: parsed };
    return { kind: "text_only" as const, text };
  }, [mode, structured, text]);

  const disciplineLabel = workout?.type ?? "workout";
  const dateLabel = workout?.date ? new Date(workout.date).toLocaleDateString() : "";

  async function handleGenerateWithCoach() {
    if (!workout) return;
    setGeneratingCoach(true);
    setCoachResult(null);
    setUseAdjusted(false);
    try {
      const res = await generateCoachWorkoutPlan({ workoutId: workout.id });
      if (!res.ok) throw new Error(res.error || "Failed to generate");

      setCoachResult(res.result);
      setMode("structured");
      setStructured(res.result.plannedPlan);
      setText(exportStructuredToText(res.result.plannedPlan));
      toast.success("Coach plan generated");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to generate coach plan";
      toast.error(msg);
    } finally {
      setGeneratingCoach(false);
    }
  }

  async function handleApplyCoachPlan() {
    if (!workout || !coachResult) return;
    if (preview.kind === "text_only") {
      toast.error("Text plan can’t be applied yet", {
        description: "Switch to Structured mode or make the text parseable first.",
      });
      return;
    }

    setApplyingCoach(true);
    try {
      const planToApply = preview.structured;
      const res = await applyCoachWorkoutPlan({
        workoutId: workout.id,
        plan: planToApply,
        source: useAdjusted ? "adjusted" : "planned",
        reason: coachResult.reason,
      });
      if (!res.ok) throw new Error(res.error || "Failed to apply");

      if (res.applied === "PROPOSED") {
        toast.success("Plan is locked — proposal created", {
          description: "Open the workout in Calendar to accept/decline.",
        });
      } else {
        const planJson = stringifyStructuredWorkoutPlan(planToApply);
        const planText = exportStructuredToText(planToApply);
        onSaved?.({ prescriptionJson: planJson, descriptionMd: planText.length > 0 ? planText : null });
        toast.success("Coach plan applied");
      }

      router.refresh();
      onOpenChange(false);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to apply coach plan";
      toast.error(msg);
    } finally {
      setApplyingCoach(false);
    }
  }

  async function handleSave() {
    if (!workout) return;
    setSaving(true);
    try {
      const payload =
        mode === "structured"
          ? (() => {
              const planJson = stringifyStructuredWorkoutPlan(structured);
              const planText = exportStructuredToText(structured);
              return {
                prescriptionJson: planJson,
                descriptionMd: planText.length > 0 ? planText : null,
              };
            })()
          : (() => {
              const trimmed = text.trim();
              const parsed = trimmed.length > 0 ? parseTextToStructured(trimmed) : null;
              return {
                prescriptionJson: parsed ? stringifyStructuredWorkoutPlan(parsed) : null,
                descriptionMd: trimmed.length > 0 ? trimmed : null,
              };
            })();

      const res = await fetch(`/api/workouts/${workout.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const responseBody = (await res.json().catch(() => null)) as null | { error?: string };
      if (!res.ok) throw new Error(responseBody?.error || "Failed to save plan");

      toast.success("Plan saved");
      onSaved?.(payload);
      onOpenChange(false);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to save plan";
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl p-0 overflow-hidden">
        <div className="flex flex-col max-h-[85vh]">
          <DialogHeader className="px-6 pt-6 pb-4 border-b border-border/60">
            <div className="flex items-start justify-between gap-4 pr-10">
              <div className="min-w-0">
                <DialogTitle className="text-xl truncate">Edit plan</DialogTitle>
                {workout && (
                  <div className="mt-1 text-xs text-muted-foreground truncate">
                    {workout.title} • {dateLabel} • {disciplineLabel}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleGenerateWithCoach}
                  disabled={generatingCoach || applyingCoach || !workout}
                >
                  {generatingCoach ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Bot className="h-4 w-4 mr-2" />}
                  Generate with Coach
                </Button>
              </div>
            </div>

            <div className="mt-4 flex items-center justify-between gap-3">
              <Tabs
                value={mode}
                onValueChange={(v) => setMode(v === "text" ? "text" : "structured")}
                className="w-full"
              >
                <TabsList className="w-full sm:w-auto">
                  <TabsTrigger value="structured">Structured</TabsTrigger>
                  <TabsTrigger value="text">Text (advanced)</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>

            {coachResult && (
              <div className="mt-4 rounded-card border bg-muted/10 p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="text-sm font-semibold">Coach output</div>
                  {coachResult.adjustedPlan && (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">Use adjusted version</span>
                      <Switch
                        checked={useAdjusted}
                        onCheckedChange={(checked) => {
                          setUseAdjusted(checked);
                          const next =
                            checked && coachResult.adjustedPlan ? coachResult.adjustedPlan : coachResult.plannedPlan;
                          setMode("structured");
                          setStructured(next);
                          setText(exportStructuredToText(next));
                        }}
                        disabled={generatingCoach || applyingCoach}
                      />
                    </div>
                  )}
                </div>

                <div className="text-xs text-muted-foreground whitespace-pre-wrap">{coachResult.summary}</div>
                <div className="text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">Reason: </span>
                  {coachResult.reason}
                </div>
                {coachResult.targetsUsed && Object.keys(coachResult.targetsUsed).length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(coachResult.targetsUsed).map(([k, v]) => (
                      <Badge key={k} variant="secondary" className="tabular-nums text-2xs">
                        {k.replace(/_/g, " ")}: {v}
                      </Badge>
                    ))}
                  </div>
                )}
                <div className="text-xs text-muted-foreground">{coachResult.safetyNote}</div>

                <div className="flex items-center justify-end">
                  <Button
                    type="button"
                    onClick={handleApplyCoachPlan}
                    disabled={applyingCoach || generatingCoach || preview.kind === "text_only"}
                  >
                    {applyingCoach ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Applying…
                      </>
                    ) : (
                      "Apply coach plan"
                    )}
                  </Button>
                </div>
              </div>
            )}
          </DialogHeader>

          <div className="flex-1 overflow-hidden">
            <div className="grid lg:grid-cols-2 h-full">
              <div className="overflow-y-auto px-6 py-5">
                {mode === "structured" ? (
                  <StructuredBuilder
                    value={structured}
                    discipline={disciplineLabel}
                    onChange={(p) => setStructured(p)}
                    showTemplates
                  />
                ) : (
                  <div className="space-y-3">
                    <div className="rounded-card border bg-muted/10 p-3">
                      <div className="flex items-center gap-2 text-sm font-medium">
                        <Sparkles className="h-4 w-4 text-muted-foreground" />
                        Text mode
                      </div>
                      <div className="mt-1 text-2xs text-muted-foreground">
                        Paste anything. On save we store the text and try a best-effort parse to structured blocks.
                      </div>
                      <div className="mt-3">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={handleGenerateWithCoach}
                          disabled={generatingCoach || applyingCoach || !workout}
                        >
                          {generatingCoach ? (
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          ) : (
                            <Bot className="h-4 w-4 mr-2" />
                          )}
                          Convert to structured (AI)
                        </Button>
                      </div>
                    </div>

                    <Textarea
                      value={text}
                      onChange={(e) => setText(e.target.value)}
                      placeholder="## Warm-up\n- ...\n\n## Main set\n- ...\n\n## Cool-down\n- ..."
                      rows={14}
                    />
                  </div>
                )}
              </div>

              <div className="border-t lg:border-t-0 lg:border-l border-border/60 bg-muted/5 overflow-y-auto px-6 py-5">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm font-semibold">Rendered plan</div>
                  {preview.kind === "parsed_text" && (
                    <Badge variant="info" className="tabular-nums">
                      parsed
                    </Badge>
                  )}
                  {preview.kind === "text_only" && (
                    <Badge variant="muted" className="tabular-nums">
                      formatted text
                    </Badge>
                  )}
                </div>
                <Separator className="my-3" />

                {preview.kind === "text_only" ? (
                  <PlanTextRenderer text={preview.text ?? ""} />
                ) : (
                  <PlanRenderer plan={preview.structured} />
                )}
              </div>
            </div>
          </div>

          <DialogFooter className="px-6 py-4 border-t border-border/60">
            <div className="flex w-full items-center justify-between gap-3">
              <div className="text-2xs text-muted-foreground">
                Saving updates `prescriptionJson` (structured) and `descriptionMd` (text export / source).
              </div>
              <div className="flex items-center gap-2">
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
                  Cancel
                </Button>
                <Button type="button" onClick={handleSave} disabled={saving || !workout}>
                  {saving ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Saving…
                    </>
                  ) : (
                    "Save plan"
                  )}
                </Button>
              </div>
            </div>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function emptyPlan(): StructuredWorkoutPlan {
  return {
    version: 2,
    objective: "",
    sections: [
      { id: newId(), type: "warmup", title: "Warm-up", blocks: [] },
      { id: newId(), type: "main", title: "Main set", blocks: [] },
      { id: newId(), type: "cooldown", title: "Cool-down", blocks: [] },
    ],
  };
}

function newId(): string {
  const c = globalThis.crypto as unknown as undefined | { randomUUID?: () => string };
  return c?.randomUUID?.() ?? `id_${Math.random().toString(36).slice(2, 10)}`;
}

