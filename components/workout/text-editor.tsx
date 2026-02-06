"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { parseTextToStructured } from "@/lib/plans/parser";
import { PlanRenderer } from "@/components/workout/plan-renderer";
import type { StructuredWorkoutPlan } from "@/lib/plans/types";

export function TextEditor({
  initialText,
  onSave,
}: {
  initialText?: string | null;
  onSave: (text: string, parsed?: StructuredWorkoutPlan | null) => void;
}) {
  const [text, setText] = useState(initialText ?? "");
  const [preview, setPreview] = useState<StructuredWorkoutPlan | null>(null);

  return (
    <div className="space-y-3">
      <Textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="Paste workout prescription or free text" rows={8} />
      <div className="flex gap-2">
        <Button onClick={() => {
          const parsed = parseTextToStructured(text);
          setPreview(parsed);
        }}>Preview</Button>
        <Button onClick={() => { const parsed = parseTextToStructured(text); onSave(text, parsed); }}>Save</Button>
      </div>

      {preview ? (
        <div>
          <PlanRenderer plan={preview} />
        </div>
      ) : (
        <div className="text-2xs text-muted-foreground">Preview will render a structured workout when the text contains recognizable sections (Warm-up/Main/Cool-down)</div>
      )}
    </div>
  );
}
