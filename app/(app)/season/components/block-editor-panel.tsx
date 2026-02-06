"use client";

import { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatLocalDateInput } from "@/lib/utils";
import type { BlockHQ } from "@/lib/types/season";

interface BlockUpdateData {
  type?: string;
  startDate?: string;
  endDate?: string;
  focus?: string | null;
  targetHoursMin?: number;
  targetHoursMax?: number;
  targetTSSMin?: number;
  targetTSSMax?: number;
  focusDiscipline?: string;
  focusLabel?: string | null;
  guardrails?: { maxHardSessionsPerWeek?: number; rampRateLimit?: number };
}

interface BlockEditorPanelProps {
  block: BlockHQ | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (id: string, data: BlockUpdateData) => Promise<void>;
}

const TYPES = ["BASE", "BUILD", "PEAK", "TAPER", "RECOVERY", "CUSTOM"];
const DISCIPLINES = ["SWIM", "BIKE", "RUN", "STRENGTH", "MIXED"];

export function BlockEditorPanel({ block, open, onOpenChange, onSave }: BlockEditorPanelProps) {
  const [form, setForm] = useState({
    type: "BASE",
    startDate: "",
    endDate: "",
    focus: "",
    targetHoursMin: "",
    targetHoursMax: "",
    targetTSSMin: "",
    targetTSSMax: "",
    focusDiscipline: "MIXED",
    focusLabel: "",
    maxHardSessionsPerWeek: "",
    rampRateLimit: "",
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (block) {
      setForm({
        type: block.type,
        startDate: formatLocalDateInput(new Date(block.startDate)),
        endDate: formatLocalDateInput(new Date(block.endDate)),
        focus: block.focus || "",
        targetHoursMin: block.targetHoursMin?.toString() ?? "",
        targetHoursMax: block.targetHoursMax?.toString() ?? "",
        targetTSSMin: block.targetTSSMin?.toString() ?? "",
        targetTSSMax: block.targetTSSMax?.toString() ?? "",
        focusDiscipline: block.focusDiscipline || "MIXED",
        focusLabel: block.focusLabel || "",
        maxHardSessionsPerWeek: block.guardrails?.maxHardSessionsPerWeek?.toString() ?? "",
        rampRateLimit: block.guardrails?.rampRateLimit?.toString() ?? "",
      });
    }
  }, [block]);

  const handleSave = async () => {
    if (!block) return;
    setLoading(true);
    try {
      await onSave(block.id, {
        type: form.type,
        startDate: form.startDate,
        endDate: form.endDate,
        focus: form.focus || null,
        targetHoursMin: form.targetHoursMin ? parseFloat(form.targetHoursMin) : undefined,
        targetHoursMax: form.targetHoursMax ? parseFloat(form.targetHoursMax) : undefined,
        targetTSSMin: form.targetTSSMin ? parseInt(form.targetTSSMin) : undefined,
        targetTSSMax: form.targetTSSMax ? parseInt(form.targetTSSMax) : undefined,
        focusDiscipline: form.focusDiscipline,
        focusLabel: form.focusLabel || null,
        guardrails: {
          maxHardSessionsPerWeek: form.maxHardSessionsPerWeek ? parseInt(form.maxHardSessionsPerWeek) : undefined,
          rampRateLimit: form.rampRateLimit ? parseInt(form.rampRateLimit) : undefined,
        },
      });
      onOpenChange(false);
    } finally {
      setLoading(false);
    }
  };

  if (!block) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Edit Block: {block.type}</SheetTitle>
        </SheetHeader>
        <div className="space-y-4 py-6">
          <div>
            <Label>Block Type</Label>
            <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {TYPES.map((t) => (
                  <SelectItem key={t} value={t}>{t}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Start Date</Label>
              <Input
                type="date"
                value={form.startDate}
                onChange={(e) => setForm({ ...form, startDate: e.target.value })}
              />
            </div>
            <div>
              <Label>End Date</Label>
              <Input
                type="date"
                value={form.endDate}
                onChange={(e) => setForm({ ...form, endDate: e.target.value })}
              />
            </div>
          </div>
          <div>
            <Label>Focus Notes</Label>
            <Input
              placeholder="e.g. Aerobic base, consistency"
              value={form.focus}
              onChange={(e) => setForm({ ...form, focus: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Target Hours Min (week)</Label>
              <Input
                type="number"
                step="0.5"
                value={form.targetHoursMin}
                onChange={(e) => setForm({ ...form, targetHoursMin: e.target.value })}
              />
            </div>
            <div>
              <Label>Target Hours Max (week)</Label>
              <Input
                type="number"
                step="0.5"
                value={form.targetHoursMax}
                onChange={(e) => setForm({ ...form, targetHoursMax: e.target.value })}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Target TSS Min</Label>
              <Input
                type="number"
                value={form.targetTSSMin}
                onChange={(e) => setForm({ ...form, targetTSSMin: e.target.value })}
              />
            </div>
            <div>
              <Label>Target TSS Max</Label>
              <Input
                type="number"
                value={form.targetTSSMax}
                onChange={(e) => setForm({ ...form, targetTSSMax: e.target.value })}
              />
            </div>
          </div>
          <div>
            <Label>Focus Discipline</Label>
            <Select value={form.focusDiscipline} onValueChange={(v) => setForm({ ...form, focusDiscipline: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {DISCIPLINES.map((d) => (
                  <SelectItem key={d} value={d}>{d}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Focus Label</Label>
            <Input
              placeholder="e.g. Bike endurance, Run threshold"
              value={form.focusLabel}
              onChange={(e) => setForm({ ...form, focusLabel: e.target.value })}
            />
          </div>
          <div className="border-t pt-4">
            <p className="text-sm font-medium text-muted-foreground mb-2">Guardrails</p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Max Hard Sessions / Week</Label>
                <Input
                  type="number"
                  min={1}
                  max={5}
                  value={form.maxHardSessionsPerWeek}
                  onChange={(e) => setForm({ ...form, maxHardSessionsPerWeek: e.target.value })}
                />
              </div>
              <div>
                <Label>Ramp Rate Limit (%)</Label>
                <Input
                  type="number"
                  value={form.rampRateLimit}
                  onChange={(e) => setForm({ ...form, rampRateLimit: e.target.value })}
                />
              </div>
            </div>
          </div>
        </div>
        <SheetFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={loading}>
            {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Save Block
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
