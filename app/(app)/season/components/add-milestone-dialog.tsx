"use client";

import { useState, useEffect } from "react";
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
import type { MilestoneHQ } from "@/lib/types/season";

const KINDS = ["A_RACE", "B_RACE", "C_RACE", "TEST", "CAMP"] as const;

interface MilestoneFormData {
  name?: string;
  date?: string;
  kind?: string;
  distance?: string;
  priority?: string;
  goalTime?: string;
  notes?: string;
}

interface AddMilestoneDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  seasonId: string;
  editMilestone: MilestoneHQ | null;
  onSubmit: (data: { name: string; date: string; kind: string; distance?: string; priority?: string; goalTime?: string; notes?: string }) => Promise<void>;
  onUpdate?: (id: string, data: MilestoneFormData) => Promise<void>;
}

export function AddMilestoneDialog({
  open,
  onOpenChange,
  seasonId: _seasonId,
  editMilestone,
  onSubmit,
  onUpdate,
}: AddMilestoneDialogProps) {
  const getToday = () => new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState(() => ({
    name: "",
    date: getToday(),
    kind: "A_RACE",
    distance: "",
    priority: "A",
    goalTime: "",
    notes: "",
  }));
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (editMilestone) {
      setForm({
        name: editMilestone.name,
        date: new Date(editMilestone.date).toISOString().slice(0, 10),
        kind: editMilestone.kind || "A_RACE",
        distance: editMilestone.distance || "",
        priority: editMilestone.priority || "A",
        goalTime: editMilestone.goalTime || "",
        notes: editMilestone.notes || "",
      });
    } else {
      setForm({ name: "", date: getToday(), kind: "A_RACE", distance: "", priority: "A", goalTime: "", notes: "" });
    }
  }, [editMilestone, open]);

  const handleSubmit = async () => {
    if (!form.name || !form.date) return;
    setLoading(true);
    try {
      if (editMilestone && onUpdate) {
        await onUpdate(editMilestone.id, {
          name: form.name,
          date: form.date,
          kind: form.kind,
          distance: form.distance || undefined,
          priority: form.priority,
          goalTime: form.goalTime || undefined,
          notes: form.notes || undefined,
        });
      } else {
        await onSubmit({
          name: form.name,
          date: form.date,
          kind: form.kind,
          distance: form.distance || undefined,
          priority: form.priority,
          goalTime: form.goalTime || undefined,
          notes: form.notes || undefined,
        });
      }
      onOpenChange(false);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editMilestone ? "Edit Milestone" : "Add Milestone"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div>
            <Label>Name</Label>
            <Input
              placeholder="e.g. City Marathon"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Date</Label>
              <Input
                type="date"
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
              />
            </div>
            <div>
              <Label>Type</Label>
              <Select value={form.kind} onValueChange={(v) => setForm({ ...form, kind: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {KINDS.map((k) => (
                    <SelectItem key={k} value={k}>{k.replace("_", " ")}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Priority</Label>
              <Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="A">A — Goal race</SelectItem>
                  <SelectItem value="B">B — Important</SelectItem>
                  <SelectItem value="C">C — Training</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Distance (optional)</Label>
              <Input
                placeholder="e.g. Half Marathon"
                value={form.distance}
                onChange={(e) => setForm({ ...form, distance: e.target.value })}
              />
            </div>
          </div>
          <div>
            <Label>Goal Time (optional)</Label>
            <Input
              placeholder="e.g. 1:45:00"
              value={form.goalTime}
              onChange={(e) => setForm({ ...form, goalTime: e.target.value })}
            />
          </div>
          <div>
            <Label>Notes (optional)</Label>
            <Textarea
              placeholder="..."
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={loading || !form.name || !form.date}>
            {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {editMilestone ? "Save" : "Add"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
