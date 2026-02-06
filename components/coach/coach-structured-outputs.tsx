"use client";

import { Copy, Calendar, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export interface WorkoutCardData {
  type: "workout";
  title: string;
  discipline: string;
  durationMin: number;
  tss?: number;
  rpe?: string;
  targets?: { label: string; value: string }[];
  warmUp?: { minutes: number; text: string };
  mainSet?: { minutes: number; text: string };
  coolDown?: { minutes: number; text: string };
}

export function WorkoutCard({ data }: { data: WorkoutCardData }) {
  function handleCopy() {
    const text = `${data.title}\n${data.discipline} · ${data.durationMin} min${data.tss ? ` · ${data.tss} TSS` : ""}\n\nWarm-up: ${data.warmUp?.text ?? "—"}\nMain: ${data.mainSet?.text ?? "—"}\nCool-down: ${data.coolDown?.text ?? "—"}`;
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard");
  }

  return (
    <Card className="border-border/50 overflow-hidden">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="font-medium">{data.title}</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {data.discipline} · {data.durationMin} min
              {data.tss != null && data.tss > 0 && ` · ${data.tss} TSS`}
              {data.rpe && ` · RPE ${data.rpe}`}
            </p>
          </div>
          <div className="flex gap-1">
            <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={handleCopy} aria-label="Copy">
              <Copy className="h-3.5 w-3.5" />
            </Button>
            <Button size="sm" variant="ghost" className="h-7 w-7 p-0" aria-label="Add to calendar">
              <Calendar className="h-3.5 w-3.5" />
            </Button>
            <Button size="sm" variant="ghost" className="h-7 w-7 p-0" aria-label="Edit">
              <Pencil className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 pt-0">
        {data.targets && data.targets.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {data.targets.map((t, i) => (
              <span key={i} className="text-xs rounded-md border border-border/50 px-2 py-0.5 bg-muted/20">
                {t.label}: {t.value}
              </span>
            ))}
          </div>
        )}
        <div className="text-xs space-y-2 border-t border-border/40 pt-3">
          {data.warmUp && (
            <div>
              <span className="font-medium text-muted-foreground">Warm-up ({data.warmUp.minutes} min)</span>
              <p className="mt-0.5">{data.warmUp.text}</p>
            </div>
          )}
          {data.mainSet && (
            <div>
              <span className="font-medium text-muted-foreground">Main ({data.mainSet.minutes} min)</span>
              <p className="mt-0.5">{data.mainSet.text}</p>
            </div>
          )}
          {data.coolDown && (
            <div>
              <span className="font-medium text-muted-foreground">Cool-down ({data.coolDown.minutes} min)</span>
              <p className="mt-0.5">{data.coolDown.text}</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export interface WeekPlanDay {
  day: string;
  type: string;
  durationMin: number;
  tss: number;
}

export interface WeekPlanGridData {
  type: "week_plan";
  days: WeekPlanDay[];
  totalHours?: number;
  totalTss?: number;
}

export function WeekPlanGrid({ data }: { data: WeekPlanGridData }) {
  const totalHours = data.totalHours ?? data.days.reduce((s, d) => s + d.durationMin / 60, 0);
  const totalTss = data.totalTss ?? data.days.reduce((s, d) => s + d.tss, 0);

  return (
    <Card className="border-border/50 overflow-hidden">
      <CardHeader className="pb-2">
        <p className="font-medium text-sm">7-Day Plan</p>
        <p className="text-xs text-muted-foreground">
          {totalHours.toFixed(1)}h total · {Math.round(totalTss)} TSS
        </p>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="grid grid-cols-7 gap-1">
          {data.days.map((d, i) => (
            <div
              key={i}
              className={cn(
                "rounded-md border p-2 text-center text-xs",
                d.type === "Rest" ? "border-border/30 bg-muted/10" : "border-border/50 bg-muted/20"
              )}
            >
              <p className="font-medium text-muted-foreground">{d.day}</p>
              <p className="font-medium truncate">{d.type}</p>
              {d.durationMin > 0 && <p className="text-muted-foreground">{d.durationMin}m</p>}
              {d.tss > 0 && <p className="text-muted-foreground">{d.tss} TSS</p>}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export interface ChangeProposalCardData {
  type: "change_proposal";
  changeType: string;
  description: string;
  impact: string;
  why: string;
}

export function ChangeProposalCard({ data }: { data: ChangeProposalCardData }) {
  return (
    <Card className="border-border/50 overflow-hidden">
      <CardContent className="pt-4">
        <p className="font-medium text-sm">{data.description}</p>
        <p className="text-xs text-muted-foreground mt-1">{data.impact}</p>
        <Collapsible>
          <CollapsibleTrigger className="mt-2 text-xs text-muted-foreground hover:text-foreground">
            Why
          </CollapsibleTrigger>
          <CollapsibleContent className="text-xs text-muted-foreground mt-1">
            {data.why}
          </CollapsibleContent>
        </Collapsible>
        <Button size="sm" className="mt-3 h-7 text-xs">
          Apply
        </Button>
      </CardContent>
    </Card>
  );
}
