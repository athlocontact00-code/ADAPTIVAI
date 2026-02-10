"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { Loader2, ArrowRight, Zap } from "lucide-react";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AVAILABILITY_PRESETS } from "@/lib/types/profile";
import { generateTrainingPlan } from "@/lib/actions/coach";
import { cn } from "@/lib/utils";

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function OnboardingPage() {
  const t = useTranslations("onboarding");
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [planResult, setPlanResult] = useState<{
    workoutCount: number;
    totalHours: number;
    firstWorkoutDate: string | null;
    firstWorkoutTitle: string | null;
  } | null>(null);
  const [formData, setFormData] = useState({
    sportPrimary: "",
    experienceLevel: "",
    weeklyHoursGoal: "",
    goal: "" as "" | "race" | "general_fitness" | "build_base",
    daysAvailable: [] as number[],
    maxMinutesPerDay: 60 as number | null,
    preferredTime: "any" as "morning" | "evening" | "any",
  });

  async function saveStep(extra?: Record<string, unknown>) {
    const payload = {
      ...formData,
      daysAvailable: formData.daysAvailable.length > 0 ? formData.daysAvailable : undefined,
      maxMinutesPerDay: formData.maxMinutesPerDay,
      preferredTime: formData.preferredTime,
      availability:
        formData.daysAvailable.length > 0 ||
        formData.maxMinutesPerDay !== undefined ||
        formData.preferredTime
          ? {
              daysAvailable: formData.daysAvailable,
              maxMinutesPerDay:
                formData.maxMinutesPerDay === undefined ? undefined : formData.maxMinutesPerDay,
              preferredTime: formData.preferredTime,
            }
          : undefined,
      goal: formData.goal || undefined,
      ...extra,
    };
    const res = await fetch("/api/profile/onboarding", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error("Failed to save");
    return res.json();
  }

  async function handleContinue() {
    if (step < 3) {
      try {
        await saveStep();
        setStep(step + 1);
      } catch {
        toast.error("Failed to save");
      }
      return;
    }
    setStep(4);
  }

  async function handleGeneratePlan() {
    setIsLoading(true);
    try {
      await saveStep({ complete: true });
      const result = await generateTrainingPlan();
      if (!result.success) {
        toast.error(result.error ?? "Failed to generate plan");
        router.push("/today");
        router.refresh();
        return;
      }
      const workouts = result.workoutCount ?? 0;
      const start = result.startDate ? new Date(result.startDate) : new Date();
      const end = result.endDate ? new Date(result.endDate) : new Date();
      const _days = Math.ceil((end.getTime() - start.getTime()) / 86400000) || 7;
      const totalHours = (workouts * 45) / 60;
      const firstWorkoutDate = start.toISOString().slice(0, 10);
      setPlanResult({
        workoutCount: workouts,
        totalHours: Math.round(totalHours * 10) / 10,
        firstWorkoutDate,
        firstWorkoutTitle: "Session",
      });
    } catch {
      toast.error("Something went wrong");
      router.push("/today");
      router.refresh();
    } finally {
      setIsLoading(false);
    }
  }

  async function handleSkip() {
    setIsLoading(true);
    try {
      await saveStep();
      const res = await fetch("/api/profile/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sportPrimary: formData.sportPrimary || undefined,
          experienceLevel: formData.experienceLevel || undefined,
          weeklyHoursGoal: formData.weeklyHoursGoal || undefined,
          goal: formData.goal || undefined,
          availability: {
            daysAvailable: formData.daysAvailable,
            maxMinutesPerDay:
              formData.maxMinutesPerDay === undefined ? undefined : formData.maxMinutesPerDay,
            preferredTime: formData.preferredTime,
          },
          dismiss: true,
        }),
      });
      if (!res.ok) throw new Error("Failed");
      router.push("/today");
      router.refresh();
    } catch {
      toast.error("Failed to save");
    } finally {
      setIsLoading(false);
    }
  }

  function toggleDay(d: number) {
    setFormData((prev) => ({
      ...prev,
      daysAvailable: prev.daysAvailable.includes(d)
        ? prev.daysAvailable.filter((x) => x !== d)
        : [...prev.daysAvailable, d].sort((a, b) => a - b),
    }));
  }

  const isComplete = step === 4;

  const weeklyHoursNum = formData.weeklyHoursGoal.trim() ? parseFloat(formData.weeklyHoursGoal.trim()) : NaN;
  const weeklyHoursValid = !Number.isNaN(weeklyHoursNum) && weeklyHoursNum > 0;
  const step1SelectsFilled =
    Boolean(formData.goal) && Boolean(formData.sportPrimary) && Boolean(formData.experienceLevel);
  const step1Valid = step1SelectsFilled && weeklyHoursValid;
  const step1WeeklyHoursTouched = formData.weeklyHoursGoal.trim().length > 0;
  const step1ShowWeeklyHoursError = step1WeeklyHoursTouched && !weeklyHoursValid;

  function handleStep1Submit(e: React.FormEvent) {
    e.preventDefault();
    if (!step1Valid) return;
    handleContinue();
  }

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-background to-muted/20 p-4 sm:p-6">
      <div className="flex items-center gap-2 mb-6">
        <Logo size={28} />
        <span className="text-xl font-bold">AdaptivAI</span>
      </div>

      {!isComplete && (
        <div className="mb-6">
          <div className="flex justify-between text-xs text-muted-foreground mb-1">
            <span>{t("step")} {step} {t("of")} 3</span>
          </div>
          <Progress value={(step / 3) * 100} className="h-1.5" />
        </div>
      )}

      <div className="flex-1 max-w-md w-full mx-auto">
        {step === 1 && (
          <form onSubmit={handleStep1Submit}>
            <h1 className="text-xl font-semibold mb-1">{t("welcome")}</h1>
            <p className="text-sm text-muted-foreground mb-6">Profile snapshot</p>
            <div className="space-y-4">
              <div>
                <Label>{t("goal")}</Label>
                <Select
                  value={formData.goal}
                  onValueChange={(v) => setFormData({ ...formData, goal: v as typeof formData.goal })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select goal" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="race">{t("race")}</SelectItem>
                    <SelectItem value="general_fitness">{t("generalFitness")}</SelectItem>
                    <SelectItem value="build_base">{t("buildBase")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Primary sport</Label>
                <Select
                  value={formData.sportPrimary}
                  onValueChange={(v) => setFormData({ ...formData, sportPrimary: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select sport" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="running">Running</SelectItem>
                    <SelectItem value="cycling">Cycling</SelectItem>
                    <SelectItem value="triathlon">Triathlon</SelectItem>
                    <SelectItem value="swimming">Swimming</SelectItem>
                    <SelectItem value="strength">Strength</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Experience level</Label>
                <Select
                  value={formData.experienceLevel}
                  onValueChange={(v) => setFormData({ ...formData, experienceLevel: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select level" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="beginner">Beginner</SelectItem>
                    <SelectItem value="intermediate">Intermediate</SelectItem>
                    <SelectItem value="advanced">Advanced</SelectItem>
                    <SelectItem value="expert">Expert</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Weekly hours goal</Label>
                <Input
                  type="number"
                  min={0.5}
                  step={0.5}
                  placeholder="e.g. 6"
                  value={formData.weeklyHoursGoal}
                  onChange={(e) => setFormData({ ...formData, weeklyHoursGoal: e.target.value })}
                />
                {step1ShowWeeklyHoursError && (
                  <p className="text-sm text-destructive mt-1">{t("weeklyHoursRequired")}</p>
                )}
              </div>
            </div>
            <div className="mt-6">
              <Button type="submit" className="w-full" size="lg" disabled={!step1Valid}>
                {t("next")}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </form>
        )}

        {step === 2 && (
          <>
            <h1 className="text-xl font-semibold mb-1">{t("availability")}</h1>
            <p className="text-sm text-muted-foreground mb-6">When can you train?</p>
            <div className="space-y-4">
              <div>
                <Label>{t("daysAvailable")}</Label>
                <div className="flex flex-wrap gap-2 mt-2">
                  {DAY_LABELS.map((label, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => toggleDay(i)}
                      className={cn(
                        "px-3 py-1.5 rounded-md text-sm font-medium transition-colors",
                        formData.daysAvailable.includes(i)
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted hover:bg-muted/80"
                      )}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <Label>{t("maxTimePerDay")}</Label>
                <div className="flex flex-wrap gap-2 mt-2">
                  {AVAILABILITY_PRESETS.map((m) => (
                    <button
                      key={m ?? "null"}
                      type="button"
                      onClick={() => setFormData({ ...formData, maxMinutesPerDay: m })}
                      className={cn(
                        "px-3 py-1.5 rounded-md text-sm font-medium transition-colors",
                        formData.maxMinutesPerDay === m ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-muted/80"
                      )}
                    >
                      {m === null ? t("maxTimePerDayUnlimited") : `${m} min`}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground mt-1.5">{t("maxTimePerDayNoLimitHint")}</p>
              </div>
              <div>
                <Label>{t("preferredTime")}</Label>
                <Select
                  value={formData.preferredTime}
                  onValueChange={(v) => setFormData({ ...formData, preferredTime: v as typeof formData.preferredTime })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="morning">{t("morning")}</SelectItem>
                    <SelectItem value="evening">{t("evening")}</SelectItem>
                    <SelectItem value="any">{t("any")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </>
        )}

        {step === 3 && !planResult && (
          <>
            <h1 className="text-xl font-semibold mb-1">{t("firstAction")}</h1>
            <p className="text-sm text-muted-foreground mb-6">Get your first training plan</p>
            <div className="space-y-3">
              <Button
                className="w-full"
                size="lg"
                onClick={handleGeneratePlan}
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Generating…
                  </>
                ) : (
                  <>
                    <Zap className="mr-2 h-4 w-4" />
                    {t("generatePlan")}
                  </>
                )}
              </Button>
              <Button
                variant="outline"
                className="w-full"
                size="lg"
                onClick={handleSkip}
                disabled={isLoading}
              >
                {t("skipForNow")}
              </Button>
            </div>
          </>
        )}

        {planResult && (
          <>
            <h1 className="text-xl font-semibold mb-1">{t("youreSetUp")}</h1>
            <p className="text-sm text-muted-foreground mb-6">
              {planResult.workoutCount} {t("plannedSessions")} · {planResult.totalHours}h {t("totalHours")}
            </p>
            <div className="rounded-lg border bg-muted/30 p-4 mb-6">
              <p className="text-sm">
                {t("firstWorkout")}: {planResult.firstWorkoutTitle} {t("today")} / {t("tomorrow")}
              </p>
            </div>
            <Link href="/today">
              <Button className="w-full" size="lg">
                {t("goToToday")}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </>
        )}

        {step > 1 && step < 4 && !planResult && (
          <div className="mt-8 flex justify-between">
            <Button variant="ghost" onClick={() => setStep(step - 1)}>
              {t("back")}
            </Button>
            {step < 3 && (
              <Button onClick={handleContinue}>
                {t("continue")}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
