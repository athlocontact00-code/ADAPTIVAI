"use client";

import { useMemo, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { DiaryEntry, Workout } from "@prisma/client";
import { toast } from "sonner";
import {
  ChevronLeft,
  ChevronRight,
  Moon,
  Zap,
  Heart,
  Eye,
  EyeOff,
  Lock,
  ChevronDown,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { cn, formatLocalDateInput, isSameDay } from "@/lib/utils";
import { getMonthGrid } from "@/lib/services/calendar-summary.service";

type DiaryEntryWithWorkout = DiaryEntry & { workout: Workout | null };

interface DiaryClientProps {
  initialEntries: DiaryEntryWithWorkout[];
  workouts: Workout[];
  monthStart: Date;
}

type VisibilityLevel = "HIDDEN" | "METRICS_ONLY" | "FULL_AI_ACCESS";

const VISIBILITY_OPTIONS: Array<{
  value: VisibilityLevel;
  label: string;
  icon: typeof Eye;
  description: string;
}> = [
  { value: "HIDDEN", label: "Ukryte", icon: EyeOff, description: "AI nie widzi nic z tego dnia." },
  { value: "METRICS_ONLY", label: "Tylko sygnały", icon: Lock, description: "AI widzi tylko sygnały i trendy — bez opisu." },
  { value: "FULL_AI_ACCESS", label: "Sens dla AI", icon: Eye, description: "AI widzi sens i temat wpisu — nigdy dosłowne zdania." },
];

// Premium day card color based on mood (0-100)
function getDayCardStyle(mood: number | null): string {
  if (mood === null) return "bg-card border-border/50";
  if (mood >= 70) return "bg-emerald-950/30 border-emerald-800/40";
  if (mood >= 40) return "bg-card border-border/50";
  return "bg-amber-950/20 border-amber-900/30";
}

// Get trend arrow from value
function getTrendArrow(current: number | null, baseline: number): string {
  if (current === null) return "";
  const diff = current - baseline;
  if (diff > 10) return "↑";
  if (diff < -10) return "↓";
  return "→";
}

export function DiaryClient({ initialEntries, workouts, monthStart }: DiaryClientProps) {
  const router = useRouter();
  const [entries, setEntries] = useState<DiaryEntryWithWorkout[]>(initialEntries);
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [currentMonthStart, setCurrentMonthStart] = useState<Date>(new Date(monthStart));
  const [bodySignalsOpen, setBodySignalsOpen] = useState(false);

  // Form state for day view (sliders 0-100)
  const [formData, setFormData] = useState({
    sleepQuality: 50,
    mood: 50,
    motivation: 50,
    fatigue: 50,
    notes: "",
    visibilityLevel: "METRICS_ONLY" as VisibilityLevel,
    // Body signals (optional)
    hrv: "",
    restingHr: "",
    soreness: "none" as "none" | "light" | "medium" | "heavy",
  });

  // Helper: local day key
  function localDayKey(d: Date): string {
    const x = new Date(d);
    x.setHours(0, 0, 0, 0);
    return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;
  }

  // Group entries by day
  const entriesByDay = useMemo(() => {
    const map: Record<string, DiaryEntryWithWorkout> = {};
    for (const e of entries) {
      const key = localDayKey(new Date(e.date));
      map[key] = e;
    }
    return map;
  }, [entries]);

  // Month grid
  const monthGrid = useMemo(() => getMonthGrid({ monthDate: currentMonthStart }), [currentMonthStart]);

  // Navigate month
  function navigateMonth(delta: number) {
    const next = new Date(currentMonthStart);
    next.setMonth(next.getMonth() + delta);
    next.setDate(1);
    next.setHours(0, 0, 0, 0);
    setCurrentMonthStart(next);
    router.push(`/diary?month=${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}`);
  }

  // Open day view
  const openDay = useCallback((day: Date) => {
    const key = localDayKey(day);
    const existing = entriesByDay[key];
    if (existing) {
      // Load existing entry into form
      const e = existing as DiaryEntryWithWorkout & { motivation?: number | null; visibilityLevel?: string | null };
      setFormData({
        sleepQuality: e.sleepQual != null ? e.sleepQual * 20 : 50,
        mood: e.mood != null ? e.mood * 20 : 50,
        motivation: typeof e.motivation === "number" ? e.motivation * 20 : 50,
        fatigue: e.stress != null ? e.stress * 20 : 50,
        notes: e.notes || "",
        visibilityLevel: (e.visibilityLevel as VisibilityLevel) || "METRICS_ONLY",
        hrv: "",
        restingHr: "",
        soreness: e.soreness != null ? (e.soreness <= 2 ? "light" : e.soreness <= 3 ? "medium" : "heavy") : "none",
      });
    } else {
      // Reset form
      setFormData({
        sleepQuality: 50,
        mood: 50,
        motivation: 50,
        fatigue: 50,
        notes: "",
        visibilityLevel: "METRICS_ONLY",
        hrv: "",
        restingHr: "",
        soreness: "none",
      });
    }
    setSelectedDay(day);
    setBodySignalsOpen(false);
  }, [entriesByDay]);

  // Close day view
  function closeDay() {
    setSelectedDay(null);
  }

  // Save entry
  async function saveEntry() {
    if (!selectedDay) return;
    setIsLoading(true);

    const dateStr = formatLocalDateInput(selectedDay);
    const key = localDayKey(selectedDay);
    const existing = entriesByDay[key];

    // Convert 0-100 sliders to 1-5 scale for API
    const payload = {
      date: dateStr,
      mood: Math.round(formData.mood / 20) || 1,
      energy: Math.round(formData.motivation / 20) || 3,
      sleepHrs: null,
      sleepQual: Math.round(formData.sleepQuality / 20) || 3,
      stress: Math.round(formData.fatigue / 20) || 3,
      soreness: formData.soreness === "none" ? 1 : formData.soreness === "light" ? 2 : formData.soreness === "medium" ? 3 : 5,
      motivation: Math.round(formData.motivation / 20) || 3,
      notes: formData.notes || null,
      workoutId: null,
      visibilityLevel: formData.visibilityLevel,
    };

    try {
      const url = existing ? `/api/diary/${existing.id}` : "/api/diary";
      const method = existing ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Failed to save");
      const saved = await res.json();
      const savedWithWorkout = { ...saved, workout: workouts.find((w) => w.id === saved.workoutId) || null };

      if (existing) {
        setEntries((prev) => prev.map((e) => (e.id === savedWithWorkout.id ? savedWithWorkout : e)));
      } else {
        setEntries((prev) => [savedWithWorkout, ...prev]);
      }
      toast.success("Zapisano");
      closeDay();
    } catch {
      toast.error("Nie udało się zapisać");
    } finally {
      setIsLoading(false);
    }
  }

  // Generate month summary narrative (simple version)
  const monthSummary = useMemo(() => {
    const monthEntries = entries.filter((e) => {
      const d = new Date(e.date);
      return d.getMonth() === currentMonthStart.getMonth() && d.getFullYear() === currentMonthStart.getFullYear();
    });
    if (monthEntries.length < 3) return null;

    const avgMood = monthEntries.reduce((s, e) => s + (e.mood || 3), 0) / monthEntries.length;
    const firstHalf = monthEntries.slice(0, Math.floor(monthEntries.length / 2));
    const secondHalf = monthEntries.slice(Math.floor(monthEntries.length / 2));
    const avgFirst = firstHalf.reduce((s, e) => s + (e.mood || 3), 0) / (firstHalf.length || 1);
    const avgSecond = secondHalf.reduce((s, e) => s + (e.mood || 3), 0) / (secondHalf.length || 1);

    let narrative = "";
    if (avgMood >= 3.5) {
      narrative = "Ten miesiąc był dobry. ";
    } else if (avgMood >= 2.5) {
      narrative = "Ten miesiąc był stabilny. ";
    } else {
      narrative = "Ten miesiąc był wymagający. ";
    }

    if (avgSecond > avgFirst + 0.3) {
      narrative += "Początek był cięższy, ale końcówka przyniosła więcej spokoju.";
    } else if (avgFirst > avgSecond + 0.3) {
      narrative += "Początek był lżejszy, końcówka bardziej intensywna.";
    } else {
      narrative += "Przebieg był dość równomierny.";
    }

    return narrative;
  }, [entries, currentMonthStart]);

  // Polish month name
  const monthName = currentMonthStart.toLocaleDateString("pl-PL", { month: "long", year: "numeric" });

  return (
    <div className="min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-light tracking-wide">Diary</h1>
          <p className="text-sm text-muted-foreground/70 mt-1">Twój miesięczny pamiętnik</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigateMonth(-1)} className="h-8 w-8">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm font-medium min-w-[140px] text-center capitalize">{monthName}</span>
          <Button variant="ghost" size="icon" onClick={() => navigateMonth(1)} className="h-8 w-8">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Month Grid - Premium Day Cards */}
      <div className="space-y-3">
        <div className="grid grid-cols-7 gap-1 text-xs text-muted-foreground/60 mb-2">
          {["Pon", "Wt", "Śr", "Czw", "Pt", "Sob", "Ndz"].map((d) => (
            <div key={d} className="text-center py-1">{d}</div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-2">
          {monthGrid.days.map((day) => {
            const inMonth = day.getMonth() === currentMonthStart.getMonth();
            const isToday = isSameDay(day, new Date());
            const key = localDayKey(day);
            const entry = entriesByDay[key];
            const mood = entry?.mood != null ? entry.mood * 20 : null;
            const hasNotes = !!entry?.notes;

            return (
              <button
                key={key}
                type="button"
                onClick={() => openDay(day)}
                className={cn(
                  "relative min-h-[80px] rounded-xl border p-2.5 text-left transition-all duration-200",
                  "hover:scale-[1.02] hover:shadow-lg hover:border-primary/30",
                  getDayCardStyle(mood),
                  !inMonth && "opacity-40",
                  isToday && "ring-1 ring-primary/50",
                  entry && mood && mood >= 80 && "animate-pulse-subtle"
                )}
              >
                <div className="flex flex-col h-full justify-between">
                  <div className={cn("text-xs font-medium tabular-nums", isToday && "text-primary")}>
                    {day.getDate()}
                  </div>
                  {entry && (
                    <div className="flex items-center gap-1.5 mt-auto flex-wrap">
                      {entry.sleepQual != null && (
                        <span className="inline-flex items-center gap-0.5 text-[9px] text-muted-foreground/70" title="Jakość snu">
                          <Moon className="h-2.5 w-2.5" />
                          {Math.round((entry.sleepQual ?? 0) * 20)}%
                        </span>
                      )}
                      {mood != null && (
                        <span className="text-[9px] text-muted-foreground/70" title="Samopoczucie">
                          {getTrendArrow(mood, 50)}
                        </span>
                      )}
                      {hasNotes && (
                        <span className="inline-block w-1.5 h-1.5 rounded-sm bg-primary/60" title="Notatka" aria-hidden />
                      )}
                    </div>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Month Summary */}
      {monthSummary && (
        <div className="mt-10 pt-8 border-t border-border/30">
          <h2 className="text-xs uppercase tracking-widest text-muted-foreground/50 mb-3">Historia miesiąca</h2>
          <p className="text-sm text-muted-foreground/80 leading-relaxed max-w-xl">
            {monthSummary}
          </p>
        </div>
      )}

      {/* Day View Overlay */}
      {selectedDay && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ animation: "fadeIn 180ms ease-out" }}
        >
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-background/90 backdrop-blur-sm"
            onClick={closeDay}
          />
          {/* Card */}
          <div
            className="relative z-10 w-full max-w-lg bg-card border border-border rounded-2xl shadow-2xl overflow-hidden"
            style={{ animation: "scaleIn 200ms ease-out" }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-border/50">
              <div>
                <div className="text-lg font-medium">
                  {selectedDay.toLocaleDateString("pl-PL", { weekday: "long", day: "numeric", month: "long" })}
                </div>
              </div>
              <Button variant="ghost" size="icon" onClick={closeDay} className="h-8 w-8">
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="p-6 space-y-7 max-h-[70dvh] overflow-y-auto scroll-touch">
              {/* Pamiętnik - Main textarea */}
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Dziennik</label>
                <Textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Jak się dziś czułeś? Co było trudne, co przyszło łatwo?"
                  rows={5}
                  className="resize-none border border-border/50 rounded-xl bg-muted/20 focus:bg-muted/30 text-sm leading-relaxed placeholder:text-muted-foreground/50 focus-visible:ring-2 focus-visible:ring-primary/20"
                />
              </div>

              {/* Quick Signals - Sliders */}
              <div className="space-y-5">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Sygnały dnia</p>
                <div className="space-y-5 pl-1">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm text-foreground/90">
                      <Moon className="h-4 w-4 text-muted-foreground" />
                      <span>Jakość snu</span>
                    </div>
                    <span className="text-xs text-muted-foreground/60">{getTrendArrow(formData.sleepQuality, 50)}</span>
                  </div>
                  <Slider
                    value={[formData.sleepQuality]}
                    onValueChange={([v]) => setFormData({ ...formData, sleepQuality: v })}
                    max={100}
                    step={5}
                    className="w-full"
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm text-foreground/90">
                      <Heart className="h-4 w-4 text-muted-foreground" />
                      <span>Samopoczucie</span>
                    </div>
                    <span className="text-xs text-muted-foreground/60">{getTrendArrow(formData.mood, 50)}</span>
                  </div>
                  <Slider
                    value={[formData.mood]}
                    onValueChange={([v]) => setFormData({ ...formData, mood: v })}
                    max={100}
                    step={5}
                    className="w-full"
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm text-foreground/90">
                      <Zap className="h-4 w-4 text-muted-foreground" />
                      <span>Motywacja</span>
                    </div>
                    <span className="text-xs text-muted-foreground/60">{getTrendArrow(formData.motivation, 50)}</span>
                  </div>
                  <Slider
                    value={[formData.motivation]}
                    onValueChange={([v]) => setFormData({ ...formData, motivation: v })}
                    max={100}
                    step={5}
                    className="w-full"
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm text-foreground/90">
                      <Zap className="h-4 w-4 rotate-180 text-muted-foreground" />
                      <span>Zmęczenie</span>
                    </div>
                    <span className="text-xs text-muted-foreground/60">{getTrendArrow(formData.fatigue, 50)}</span>
                  </div>
                  <Slider
                    value={[formData.fatigue]}
                    onValueChange={([v]) => setFormData({ ...formData, fatigue: v })}
                    max={100}
                    step={5}
                    className="w-full"
                  />
                </div>
                </div>
              </div>

              {/* Body Signals - Collapsible */}
              <div className="border-t border-border/30 pt-4">
                <button
                  type="button"
                  onClick={() => setBodySignalsOpen(!bodySignalsOpen)}
                  className="flex items-center gap-2 text-sm text-muted-foreground/70 hover:text-muted-foreground transition-colors"
                >
                  <ChevronDown className={cn("h-4 w-4 transition-transform", bodySignalsOpen && "rotate-180")} />
                  <span>Sygnały ciała (opcjonalne)</span>
                </button>
                {bodySignalsOpen && (
                  <div className="mt-4 space-y-4 pl-6">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <Label className="text-xs text-muted-foreground">HRV</Label>
                        <input
                          type="number"
                          value={formData.hrv}
                          onChange={(e) => setFormData({ ...formData, hrv: e.target.value })}
                          placeholder="ms"
                          className="w-full h-9 px-3 rounded-md border border-border/50 bg-muted/20 text-sm"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs text-muted-foreground">Resting HR</Label>
                        <input
                          type="number"
                          value={formData.restingHr}
                          onChange={(e) => setFormData({ ...formData, restingHr: e.target.value })}
                          placeholder="bpm"
                          className="w-full h-9 px-3 rounded-md border border-border/50 bg-muted/20 text-sm"
                        />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">DOMS / Soreness</Label>
                      <div className="flex gap-2">
                        {(["none", "light", "medium", "heavy"] as const).map((s) => (
                          <button
                            key={s}
                            type="button"
                            onClick={() => setFormData({ ...formData, soreness: s })}
                            className={cn(
                              "px-3 py-1.5 rounded-md text-xs border transition-colors",
                              formData.soreness === s
                                ? "bg-primary/20 border-primary/50 text-primary"
                                : "border-border/50 text-muted-foreground hover:border-border"
                            )}
                          >
                            {s === "none" ? "Brak" : s === "light" ? "Lekki" : s === "medium" ? "Średni" : "Ciężki"}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* AI Visibility Toggle */}
              <div className="border-t border-border/30 pt-4">
                <Label className="text-xs text-muted-foreground mb-3 block">Widoczność dla AI</Label>
                <div className="flex gap-2">
                  {VISIBILITY_OPTIONS.map((opt) => {
                    const Icon = opt.icon;
                    const isActive = formData.visibilityLevel === opt.value;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setFormData({ ...formData, visibilityLevel: opt.value })}
                        className={cn(
                          "flex-1 px-3 py-2 rounded-lg border text-xs transition-all",
                          isActive
                            ? "bg-primary/10 border-primary/40 text-foreground"
                            : "border-border/50 text-muted-foreground hover:border-border"
                        )}
                      >
                        <div className="flex items-center justify-center gap-1.5">
                          <Icon className="h-3.5 w-3.5" />
                          <span>{opt.label}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
                <p className="text-[11px] text-muted-foreground/60 mt-2">
                  {VISIBILITY_OPTIONS.find((o) => o.value === formData.visibilityLevel)?.description}
                </p>
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-border/50 flex justify-end gap-3">
              <Button variant="ghost" onClick={closeDay}>Anuluj</Button>
              <Button onClick={saveEntry} disabled={isLoading}>
                {isLoading ? "Zapisuję..." : "Zapisz"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Animations */}
      <style jsx global>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes scaleIn {
          from { opacity: 0; transform: scale(0.96); }
          to { opacity: 1; transform: scale(1); }
        }
        .animate-pulse-subtle {
          animation: pulseSoft 3s ease-in-out infinite;
        }
        @keyframes pulseSoft {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.85; }
        }
      `}</style>
    </div>
  );
}
