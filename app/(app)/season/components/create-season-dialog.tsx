"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

interface CreateSeasonDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: { name: string; sport: string; startDate: string; endDate: string; goalRaceDate?: string; primaryGoal?: string }) => Promise<void>;
}

export function CreateSeasonDialog({ open, onOpenChange, onSubmit }: CreateSeasonDialogProps) {
  const today = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState({
    name: "",
    sport: "Triathlon",
    startDate: today,
    endDate: today,
    goalRaceDate: "",
    primaryGoal: "",
  });
  const [loading, setLoading] = useState(false);

  const startEndValid = form.startDate && form.endDate && new Date(form.startDate) <= new Date(form.endDate);
  const goalDateValid = !form.goalRaceDate || !form.startDate || new Date(form.goalRaceDate) >= new Date(form.startDate);

  const handleSubmit = async () => {
    if (!form.name || !form.startDate || !form.endDate || !startEndValid || !goalDateValid) return;
    setLoading(true);
    try {
      await onSubmit({
        name: form.name,
        sport: form.sport,
        startDate: form.startDate,
        endDate: form.endDate,
        goalRaceDate: form.goalRaceDate || undefined,
        primaryGoal: form.primaryGoal || undefined,
      });
      onOpenChange(false);
      setForm({ name: "", sport: "Triathlon", startDate: today, endDate: today, goalRaceDate: "", primaryGoal: "" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Create Season Manually</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div>
            <Label>Season Name</Label>
            <Input
              placeholder="e.g. 2026 Marathon Prep"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </div>
          <div>
            <Label>Sport</Label>
            <Select value={form.sport} onValueChange={(v) => setForm({ ...form, sport: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Triathlon">Triathlon</SelectItem>
                <SelectItem value="Running">Running</SelectItem>
                <SelectItem value="Cycling">Cycling</SelectItem>
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
            <Label>Goal Race Date (optional)</Label>
            <Input
              type="date"
              value={form.goalRaceDate}
              onChange={(e) => setForm({ ...form, goalRaceDate: e.target.value })}
              aria-invalid={!!form.goalRaceDate && !!form.startDate && new Date(form.goalRaceDate) < new Date(form.startDate)}
            />
            {form.goalRaceDate && form.startDate && new Date(form.goalRaceDate) < new Date(form.startDate) && (
              <p className="mt-1 text-xs text-destructive">Goal race date must be on or after start date.</p>
            )}
          </div>
          <div>
            <Label>Primary Goal (optional)</Label>
            <Textarea
              placeholder="e.g. Sub-4 hour marathon"
              value={form.primaryGoal}
              onChange={(e) => setForm({ ...form, primaryGoal: e.target.value })}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={loading || !form.name || !form.startDate || !form.endDate || !startEndValid || !goalDateValid}>
            {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Create Season
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
