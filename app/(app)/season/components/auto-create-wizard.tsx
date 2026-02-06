"use client";

import { useState } from "react";
import { Loader2, ChevronRight, ChevronLeft, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { AutoCreateWizardInput, DisciplineFocus } from "@/lib/types/season";

const STEPS = ["Goal", "Constraints", "Style"];
const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const defaultInput: AutoCreateWizardInput = {
  name: "",
  sport: "Triathlon",
  goalRaceDate: "",
  raceType: "70.3",
  startDate: new Date().toISOString().slice(0, 10),
  maxWeeklyHours: 12,
  availability: [1, 2, 3, 4, 5, 6, 0],
  intensityLimit: "Normal",
  injuryToggle: false,
  injuryNote: "",
  planRigidity: "SEMI_LOCKED",
  disciplineFocus: { swim: 25, bike: 40, run: 30, strength: 5 },
};

interface AutoCreateWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (input: AutoCreateWizardInput) => Promise<void>;
}

export function AutoCreateWizard({ open, onOpenChange, onSubmit }: AutoCreateWizardProps) {
  const [step, setStep] = useState(0);
  const [input, setInput] = useState<AutoCreateWizardInput>(defaultInput);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    setLoading(true);
    try {
      await onSubmit(input);
      onOpenChange(false);
      setStep(0);
      setInput(defaultInput);
    } finally {
      setLoading(false);
    }
  };

  const toggleDay = (d: number) => {
    const next = input.availability.includes(d)
      ? input.availability.filter((x) => x !== d)
      : [...input.availability, d].sort((a, b) => a - b);
    setInput({ ...input, availability: next });
  };

  const setFocus = (key: keyof DisciplineFocus, val: number) => {
    setInput({
      ...input,
      disciplineFocus: { ...input.disciplineFocus, [key]: val },
    });
  };

  const goalDateValid = input.goalRaceDate && input.startDate && new Date(input.goalRaceDate) >= new Date(input.startDate);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto" aria-describedby="wizard-desc">
        <p id="wizard-desc" className="sr-only">Create a season in 3 steps: Goal, Constraints, Style</p>
        <DialogHeader>
          <DialogTitle>Auto-Create Season</DialogTitle>
        </DialogHeader>
        <div className="flex gap-2 py-2">
          {STEPS.map((s, i) => (
            <div
              key={s}
              className={cn(
                "flex-1 h-1 rounded-full transition-colors",
                i <= step ? "bg-primary" : "bg-muted"
              )}
            />
          ))}
        </div>

        {step === 0 && (
          <div className="space-y-4">
            <div>
              <Label>Season Name</Label>
              <Input
                placeholder="e.g. 2026 70.3 Prep"
                value={input.name}
                onChange={(e) => setInput({ ...input, name: e.target.value })}
              />
            </div>
            <div>
              <Label>Sport</Label>
              <Select value={input.sport} onValueChange={(v) => setInput({ ...input, sport: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Triathlon">Triathlon</SelectItem>
                  <SelectItem value="Running">Running</SelectItem>
                  <SelectItem value="Cycling">Cycling</SelectItem>
                  <SelectItem value="Swimming">Swimming</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Goal Race Date</Label>
                <Input
                  type="date"
                  value={input.goalRaceDate}
                  onChange={(e) => setInput({ ...input, goalRaceDate: e.target.value })}
                />
              </div>
              <div>
                <Label>Race Type</Label>
                <Select value={input.raceType} onValueChange={(v) => setInput({ ...input, raceType: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Sprint">Sprint</SelectItem>
                    <SelectItem value="Olympic">Olympic</SelectItem>
                    <SelectItem value="70.3">70.3</SelectItem>
                    <SelectItem value="Full">Full Ironman</SelectItem>
                    <SelectItem value="Marathon">Marathon</SelectItem>
                    <SelectItem value="Half Marathon">Half Marathon</SelectItem>
                    <SelectItem value="10k">10k</SelectItem>
                    <SelectItem value="5k">5k</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Season Start Date</Label>
              <Input
                type="date"
                value={input.startDate}
                onChange={(e) => setInput({ ...input, startDate: e.target.value })}
                aria-invalid={!!input.goalRaceDate && !!input.startDate && new Date(input.goalRaceDate) < new Date(input.startDate)}
              />
              {input.goalRaceDate && input.startDate && new Date(input.goalRaceDate) < new Date(input.startDate) && (
                <p className="mt-1 text-xs text-destructive">Goal race date must be on or after start date.</p>
              )}
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-4">
            <div>
              <Label>Max Weekly Hours</Label>
              <Input
                type="number"
                min={4}
                max={30}
                step={1}
                value={input.maxWeeklyHours}
                onChange={(e) => setInput({ ...input, maxWeeklyHours: parseInt(e.target.value) || 12 })}
              />
            </div>
            <div>
              <Label>Preferred Training Days</Label>
              <div className="flex flex-wrap gap-2 mt-2">
                {DAYS.map((label, i) => (
                  <button
                    key={label}
                    type="button"
                    onClick={() => toggleDay(i)}
                    className={cn(
                      "px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                      input.availability.includes(i)
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted/50 text-muted-foreground hover:bg-muted"
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <Label>Intensity Limit</Label>
              <Select value={input.intensityLimit} onValueChange={(v: any) => setInput({ ...input, intensityLimit: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Low">Low — conservative</SelectItem>
                  <SelectItem value="Normal">Normal</SelectItem>
                  <SelectItem value="High">High — aggressive</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between">
              <Label>Injury / Limitations</Label>
              <Switch
                checked={input.injuryToggle}
                onCheckedChange={(v) => setInput({ ...input, injuryToggle: v })}
              />
            </div>
            {input.injuryToggle && (
              <Textarea
                placeholder="Describe any limitations..."
                value={input.injuryNote}
                onChange={(e) => setInput({ ...input, injuryNote: e.target.value })}
              />
            )}
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <div>
              <Label>Plan Rigidity</Label>
              <Select value={input.planRigidity} onValueChange={(v: any) => setInput({ ...input, planRigidity: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="LOCKED">Locked — stick to plan</SelectItem>
                  <SelectItem value="SEMI_LOCKED">Semi-locked — flexible when needed</SelectItem>
                  <SelectItem value="FLEXIBLE">Flexible — adapt often</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Discipline Focus</Label>
              <div className="space-y-3 mt-2">
                {(["swim", "bike", "run", "strength"] as const).map((k) => (
                  <div key={k} className="flex items-center gap-3">
                    <span className="w-20 text-sm text-muted-foreground capitalize">{k}</span>
                    <Slider
                      value={[input.disciplineFocus?.[k] ?? 25]}
                      onValueChange={([v]) => setFocus(k, v)}
                      max={100}
                      step={5}
                      className="flex-1"
                    />
                    <span className="w-8 text-sm tabular-nums">{input.disciplineFocus?.[k] ?? 25}%</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-lg border border-border/50 bg-muted/20 p-3 text-sm text-muted-foreground">
              <p className="font-medium text-foreground mb-1">Summary</p>
              <p>{input.name || "New season"} • {input.sport} • {input.raceType} on {input.goalRaceDate || "—"}</p>
              <p>{input.maxWeeklyHours}h/week max • {input.planRigidity}</p>
            </div>
          </div>
        )}

        <DialogFooter className="gap-2">
          {step > 0 ? (
            <Button variant="outline" onClick={() => setStep(step - 1)}>
              <ChevronLeft className="h-4 w-4 mr-1" />
              Back
            </Button>
          ) : (
            <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          )}
          {step < 2 ? (
            <Button onClick={() => setStep(step + 1)} disabled={step === 0 && !goalDateValid}>
              Next
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          ) : (
            <Button onClick={handleSubmit} disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              <Check className="h-4 w-4 mr-2" />
              Create Season
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
