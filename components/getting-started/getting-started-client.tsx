"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Settings,
  Calendar,
  Bot,
  ClipboardCheck,
  BookOpen,
  MessageSquare,
  Check,
  ChevronRight,
  Shield,
  Loader2,
  Zap,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getOnboardingStatus, getSampleOnboardingStatusForDev, type OnboardingStatus } from "@/lib/actions/onboarding";
import { cn } from "@/lib/utils";

const STEPS = [
  {
    id: "profile",
    label: "Complete profile & zones/PBs",
    why: "AI needs your zones and goals to build personalized plans.",
    href: "/settings",
    icon: Settings,
    getDone: (s: OnboardingStatus) => s.hasProfileConfigured,
  },
  {
    id: "season",
    label: "Create Season",
    why: "Season sets your training horizon and race goals.",
    href: "/season",
    icon: Calendar,
    getDone: (s: OnboardingStatus) => s.hasSeason,
  },
  {
    id: "plan",
    label: "Generate first 7-day plan",
    why: "AI Coach creates your weekly structure.",
    href: "/coach",
    icon: Bot,
    getDone: (s: OnboardingStatus) => s.hasPlannedWorkoutsThisWeek,
  },
  {
    id: "checkin",
    label: "Do Daily Check-in",
    why: "Readiness keeps your plan calibrated to today.",
    href: "/today",
    icon: ClipboardCheck,
    getDone: (s: OnboardingStatus) => s.hasCheckInToday,
  },
  {
    id: "diary",
    label: "Add Diary entry",
    why: "Mood, sleep, stress help AI understand you.",
    href: "/diary",
    icon: BookOpen,
    getDone: (s: OnboardingStatus) => s.hasDiaryEntryThisMonth,
  },
  {
    id: "feedback",
    label: "Add Post-workout feedback",
    why: "How sessions felt improves future recommendations.",
    href: "/calendar",
    icon: MessageSquare,
    getDone: (s: OnboardingStatus) => s.hasPostWorkoutFeedbackLast7d,
  },
] as const;

const WORKFLOW_STEPS = [
  { label: "Plan", href: "/coach", icon: Bot },
  { label: "Check-in", href: "/today", icon: ClipboardCheck },
  { label: "Execute", href: "/calendar", icon: Calendar },
  { label: "Feedback", href: "/calendar", icon: MessageSquare },
  { label: "Reflect", href: "/diary", icon: BookOpen },
];

const PRIVACY_LEVELS = [
  { id: "full", label: "Full AI Access", desc: "AI can use scores and notes.", recommended: false },
  { id: "metrics", label: "Metrics Only", desc: "AI can use scores but not your text.", recommended: true },
  { id: "hidden", label: "Hidden", desc: "AI ignores the entry completely.", recommended: false },
];

export function GettingStartedClient() {
  const [status, setStatus] = useState<OnboardingStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [useSample, setUseSample] = useState(false);
  const isDev = typeof window !== "undefined" && process.env.NODE_ENV === "development";

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    async function load() {
      const s = useSample ? await getSampleOnboardingStatusForDev() : await getOnboardingStatus();
      if (!cancelled) {
        setStatus(s ?? null);
        setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [useSample]);

  const handleLoadSample = () => {
    setUseSample(true);
    setLoading(true);
  };

  if (loading && !status) {
    return (
      <div className="flex min-h-[200px] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const s = status ?? {
    hasProfileConfigured: false,
    hasSeason: false,
    hasPlannedWorkoutsThisWeek: false,
    hasCheckInToday: false,
    hasDiaryEntryThisMonth: false,
    hasPostWorkoutFeedbackLast7d: false,
  };

  const completedCount = STEPS.filter((step) => step.getDone(s)).length;
  const recommendedStep = STEPS.find((step) => !step.getDone(s));
  const estimatedMinutes = Math.max(5, (6 - completedCount) * 3);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Getting Started</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            A quick guide to the core screens and your daily workflow.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <Badge
              variant={completedCount === 6 ? "default" : "secondary"}
              className={cn(
                "font-medium",
                completedCount === 6 && "bg-emerald-600 hover:bg-emerald-600"
              )}
            >
              {completedCount}/6 completed
            </Badge>
            <span className="text-xs text-muted-foreground">~{estimatedMinutes} min left</span>
          </div>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          {recommendedStep && (
            <Link href={recommendedStep.href}>
              <Button className="w-full sm:w-auto">
                Continue setup
                <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            </Link>
          )}
          <Link href="/dashboard">
            <Button variant="outline">Go to Dashboard</Button>
          </Link>
          {isDev && (
            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground"
              onClick={handleLoadSample}
            >
              Load sample (dev)
            </Button>
          )}
        </div>
      </div>

      {/* Setup checklist */}
      <Card className="border-border/50 overflow-hidden">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Setup checklist</CardTitle>
          <CardDescription>Complete these steps to get the most from AdaptivAI.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {STEPS.map((step, _i) => {
            const done = step.getDone(s);
            const isRecommended = recommendedStep?.id === step.id;
            const Icon = step.icon;
            return (
              <div
                key={step.id}
                className={cn(
                  "flex flex-col gap-2 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between",
                  "border-border/50 bg-card/50",
                  done && "border-emerald-500/30 bg-emerald-500/5"
                )}
              >
                <div className="flex flex-1 items-start gap-3">
                  <div
                    className={cn(
                      "flex h-8 w-8 shrink-0 items-center justify-center rounded-md",
                      done ? "bg-emerald-500/20 text-emerald-600" : "bg-muted text-muted-foreground"
                    )}
                  >
                    {done ? <Check className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={cn("font-medium text-sm", done && "text-muted-foreground line-through")}>
                        {step.label}
                      </span>
                      {done && (
                        <Badge variant="secondary" className="text-[10px]">
                          Done
                        </Badge>
                      )}
                      {isRecommended && !done && (
                        <Badge className="text-[10px] bg-amber-500/90 hover:bg-amber-500/90">
                          Recommended
                        </Badge>
                      )}
                      {!done && !isRecommended && (
                        <Badge variant="outline" className="text-[10px]">
                          Not started
                        </Badge>
                      )}
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">{step.why}</p>
                  </div>
                </div>
                {!done && (
                  <Link href={step.href} className="shrink-0">
                    <Button size="sm" variant={isRecommended ? "default" : "outline"}>
                      {step.id === "profile" && "Open Settings"}
                      {step.id === "season" && "Create Season"}
                      {step.id === "plan" && "Generate plan"}
                      {step.id === "checkin" && "Do Check-in"}
                      {step.id === "diary" && "Add entry"}
                      {step.id === "feedback" && "Open Calendar"}
                    </Button>
                  </Link>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Daily workflow */}
      <Card className="border-border/50 overflow-hidden">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Zap className="h-4 w-4 text-amber-500" />
            Your daily workflow
          </CardTitle>
          <CardDescription>Plan → Check-in → Execute → Feedback → Reflect</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center gap-2">
            {WORKFLOW_STEPS.map((w, i) => (
              <span key={w.label} className="flex items-center gap-2">
                <Link
                  href={w.href}
                  className="flex items-center gap-1.5 rounded-md border border-border/50 px-3 py-2 text-sm font-medium transition-colors hover:bg-muted/50 hover:border-muted-foreground/30"
                >
                  <w.icon className="h-3.5 w-3.5 text-muted-foreground" />
                  {w.label}
                </Link>
                {i < WORKFLOW_STEPS.length - 1 && (
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                )}
              </span>
            ))}
          </div>
          {recommendedStep && (
            <p className="mt-3 text-xs text-muted-foreground">
              <span className="font-medium text-foreground">Recommended next:</span>{" "}
              <Link href={recommendedStep.href} className="underline hover:no-underline">
                {recommendedStep.label}
              </Link>
            </p>
          )}
        </CardContent>
      </Card>

      {/* Privacy & AI */}
      <Card className="border-border/50 overflow-hidden">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Shield className="h-4 w-4" />
            Privacy & AI
          </CardTitle>
          <CardDescription>Control what the AI can learn from each diary entry.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {PRIVACY_LEVELS.map((p) => (
            <div
              key={p.id}
              className="rounded-md border border-border/50 bg-muted/20 px-3 py-2"
            >
              <div className="flex items-center gap-2">
                <span className="font-medium text-sm">{p.label}</span>
                {p.recommended && (
                  <Badge variant="secondary" className="text-[10px]">
                    Recommended
                  </Badge>
                )}
              </div>
              <p className="mt-0.5 text-xs text-muted-foreground">{p.desc}</p>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
