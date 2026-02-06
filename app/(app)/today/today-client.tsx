"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Calendar,
  CheckCircle2,
  Cloud,
  CloudDrizzle,
  CloudRain,
  CloudSnow,
  CloudSun,
  MapPinOff,
  Play,
  RefreshCw,
  Moon,
  Sun,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { DailyCheckInModal } from "@/components/daily-checkin-modal";
import { WorkoutCompleteFlow } from "@/components/workout-complete-flow";
import { startWorkout } from "@/lib/actions/workout-execution";
import {
  ActionCard,
  CompactToggle,
  EmptyState,
  ListCard,
  MetricCard,
  useCompactMode,
} from "@/components/ui-extensions";
import { TodayDecisionSheet } from "@/components/today-decision-sheet";

type TodayWorkout = {
  id: string;
  title: string;
  type: string;
  date: string;
  durationMin: number | null;
  tss: number | null;
  planned: boolean;
  completed: boolean;
  aiGenerated?: boolean | null;
  aiReason?: string | null;
  source?: string | null;
};

export function TodayClient(props: {
  workouts: TodayWorkout[];
  checkInRequired: boolean;
  checkInWorkout: { id: string; title: string; type: string; duration: number; tss: number } | null;
  todayCheckIn: null | {
    id: string;
    workoutId: string | null;
    readinessScore: number | null;
    aiDecision: string | null;
    aiConfidence: number | null;
    lockedAt: string | null;
    sleepDuration: number | null;
    sleepQuality: number | null;
    physicalFatigue: number | null;
    motivation: number | null;
  };
}) {
  const router = useRouter();
  const { compact, setCompact } = useCompactMode();
  const density = compact ? "compact" : "default";
  const [checkInOpen, setCheckInOpen] = useState(false);
  const [todayDecisionOpen, setTodayDecisionOpen] = useState(false);
  const [startingWorkoutId, setStartingWorkoutId] = useState<string | null>(null);

  const [weather, setWeather] = useState<
    | {
        tempC: number;
        feelsLikeC: number;
        windKph: number;
        precipMm: number;
        humidityPct: number;
        sunriseIso: string;
        sunsetIso: string;
        sunriseNextIso: string;
        code: number;
      }
    | null
  >(null);
  const [weatherStatus, setWeatherStatus] = useState<"idle" | "loading" | "denied" | "error">("idle");

  const todayLabel = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
  });

  const readiness = props.todayCheckIn?.readinessScore;
  const _readinessColor =
    typeof readiness !== "number"
      ? "text-muted-foreground"
      : readiness >= 70
        ? "text-green-500"
        : readiness >= 45
          ? "text-yellow-500"
          : "text-red-500";

  const hasPreTrainingWorkout = Boolean(props.checkInWorkout);
  const preTrainingStatus = props.todayCheckIn
    ? "completed"
    : props.checkInRequired
    ? "required"
    : "pending";
  const preTrainingBadgeVariant =
    preTrainingStatus === "completed" ? "success" : preTrainingStatus === "required" ? "warning" : "muted";
  const preTrainingDescription = props.todayCheckIn
    ? props.todayCheckIn.aiDecision
      ? `Coach: ${props.todayCheckIn.aiDecision}`
      : "Check-in saved for today."
    : hasPreTrainingWorkout
    ? `${props.checkInWorkout?.title} • ${props.checkInWorkout?.type} • ${props.checkInWorkout?.duration} min`
    : "Plan a session to unlock pre-training check-in.";

  const isAdaptedFromCheckIn = (workout: TodayWorkout) => {
    if (workout.source === "daily-checkin") return true;
    if (!workout.aiReason) return false;
    return workout.aiReason.toLowerCase().includes("check-in");
  };

  const todayMeta = useMemo(() => {
    const totalTss = props.workouts.reduce((sum, w) => sum + (typeof w.tss === "number" ? w.tss : 0), 0);
    const totalDurationMin = props.workouts.reduce(
      (sum, w) => sum + (typeof w.durationMin === "number" ? w.durationMin : 0),
      0
    );
    const hasWorkout = props.workouts.length > 0;
    const hasPlannedNotCompleted = props.workouts.some((w) => w.planned && !w.completed);
    const types = new Set(props.workouts.map((w) => w.type));

    const todayFocus = (() => {
      if (!hasWorkout) return "Dzień na spokojne wejście w rytm.";
      if (!hasPlannedNotCompleted) return "Dzień na domknięcie i regenerację.";

      if (props.checkInRequired) return "Dzień na kontrolę tempa i uważność.";
      if (totalTss >= 90) return "Dzień na równą pracę i trzymanie jakości.";
      if (types.has("strength")) return "Dzień na technikę i spokojne wykonanie.";
      if (types.has("run")) return "Dzień na lekkość kroku i rytm.";
      return "Dzień na spokojną, równą pracę.";
    })();

    const recoveryTime = (() => {
      const tss = totalTss;
      const hours = (() => {
        if (!hasWorkout || tss <= 0) return 8;
        if (tss <= 25) return 12;
        if (tss <= 55) return 18;
        if (tss <= 85) return 30;
        return 42;
      })();
      return `Regeneracja po dzisiejszym dniu: ~${hours} h`;
    })();

    const arrow = (v: "up" | "down" | "flat") => (v === "up" ? "↑" : v === "down" ? "↓" : "→");
    const sleepArrow = (() => {
      const h = props.todayCheckIn?.sleepDuration;
      const q = props.todayCheckIn?.sleepQuality;
      if (typeof h === "number") {
        if (h < 6) return arrow("down");
        if (h >= 8) return arrow("up");
        return arrow("flat");
      }
      if (typeof q === "number") {
        if (q <= 2) return arrow("down");
        if (q >= 4) return arrow("up");
        return arrow("flat");
      }
      return null;
    })();
    const fatigueArrow = (() => {
      const f = props.todayCheckIn?.physicalFatigue;
      if (typeof f !== "number") return null;
      if (f >= 4) return arrow("up");
      if (f <= 2) return arrow("down");
      return arrow("flat");
    })();
    const motivationArrow = (() => {
      const m = props.todayCheckIn?.motivation;
      if (typeof m !== "number") return null;
      if (m >= 4) return arrow("up");
      if (m <= 2) return arrow("down");
      return arrow("flat");
    })();

    const signalSnapshot = (() => {
      const hasAll = sleepArrow != null && fatigueArrow != null && motivationArrow != null;
      if (hasAll) {
        return `Sen ${sleepArrow} · Zmęczenie ${fatigueArrow} · Motywacja ${motivationArrow}`;
      }

      const candidates: Array<{ label: string; arrow: string | null }> = [
        { label: "sen", arrow: sleepArrow },
        { label: "zmęczenie", arrow: fatigueArrow },
        { label: "motywacja", arrow: motivationArrow },
      ].filter((c) => c.arrow != null);

      if (candidates.length === 0) return "Główny sygnał dziś: sen";

      const score = (a: string) => (a === "↑" || a === "↓" ? 2 : 0);
      candidates.sort((a, b) => score(b.arrow!) - score(a.arrow!));
      return `Główny sygnał dziś: ${candidates[0]!.label}`;
    })();

    return {
      totalTss,
      totalDurationMin,
      todayFocus,
      recoveryTimeText: recoveryTime,
      signalSnapshot,
    };
  }, [props.workouts, props.todayCheckIn, props.checkInRequired]);

  function describeWeather(code: number): { label: string; Icon: typeof Sun } {
    if (code === 0) return { label: "Clear", Icon: Sun };
    if (code >= 1 && code <= 3) return { label: "Partly cloudy", Icon: CloudSun };
    if (code === 45 || code === 48) return { label: "Fog", Icon: Cloud };
    if ((code >= 51 && code <= 57) || (code >= 80 && code <= 82)) return { label: "Showers", Icon: CloudDrizzle };
    if ((code >= 61 && code <= 67) || (code >= 95 && code <= 99)) return { label: "Rain", Icon: CloudRain };
    if (code >= 71 && code <= 77) return { label: "Snow", Icon: CloudSnow };
    return { label: "Weather", Icon: Cloud };
  }

  const weatherView = useMemo(() => {
    if (!weather) return null;
    const { label, Icon } = describeWeather(weather.code);
    return { label, Icon };
  }, [weather]);

  function formatLocalTime(iso: string): string {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "—";
    return d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false });
  }

  function clamp01(n: number): number {
    if (n < 0) return 0;
    if (n > 1) return 1;
    return n;
  }

  function getDayNightProgress(params: {
    now: Date;
    sunriseIso: string;
    sunsetIso: string;
    sunriseNextIso: string;
  }): { mode: "day" | "night"; progress: number } {
    const nowMs = params.now.getTime();
    const sunriseMs = new Date(params.sunriseIso).getTime();
    const sunsetMs = new Date(params.sunsetIso).getTime();
    const sunriseNextMs = new Date(params.sunriseNextIso).getTime();

    if (!Number.isFinite(sunriseMs) || !Number.isFinite(sunsetMs) || !Number.isFinite(sunriseNextMs)) {
      return { mode: "day", progress: 0 };
    }

    if (nowMs >= sunriseMs && nowMs <= sunsetMs) {
      const p = (nowMs - sunriseMs) / Math.max(1, sunsetMs - sunriseMs);
      return { mode: "day", progress: clamp01(p) };
    }

    // Night can be either after today's sunset or before today's sunrise.
    const dayLen = Math.max(1, sunsetMs - sunriseMs);
    const nightLen = 24 * 60 * 60 * 1000 - dayLen;
    const prevSunsetMs = sunriseMs - nightLen;

    if (nowMs < sunriseMs) {
      const p = (nowMs - prevSunsetMs) / Math.max(1, sunriseMs - prevSunsetMs);
      return { mode: "night", progress: clamp01(p) };
    }

    const p = (nowMs - sunsetMs) / Math.max(1, sunriseNextMs - sunsetMs);
    return { mode: "night", progress: clamp01(p) };
  }

  function formatHhMm(totalMinutes: number): string {
    const m = Math.max(0, Math.round(totalMinutes));
    const h = Math.floor(m / 60);
    const mm = m % 60;
    return `${h}h ${String(mm).padStart(2, "0")}min`;
  }

  function SunPathIndicator(props: {
    now: Date;
    sunriseIso: string;
    sunsetIso: string;
    sunriseNextIso: string;
  }) {
    const phase = getDayNightProgress({
      now: props.now,
      sunriseIso: props.sunriseIso,
      sunsetIso: props.sunsetIso,
      sunriseNextIso: props.sunriseNextIso,
    });

    const sunriseMs = new Date(props.sunriseIso).getTime();
    const sunsetMs = new Date(props.sunsetIso).getTime();
    const sunriseNextMs = new Date(props.sunriseNextIso).getTime();
    const nowMs = props.now.getTime();

    const width = 220;
    const height = 96;
    const cx = width / 2;
    const cy = height - 10;
    const r = 78;

    const p = clamp01(phase.progress);
    const angle = Math.PI * (1 - p);
    const x = cx + r * Math.cos(angle);
    const y = cy - r * Math.sin(angle);

    const isDay = phase.mode === "day";
    const remainingDaylightMin = isDay && Number.isFinite(sunsetMs)
      ? Math.max(0, (sunsetMs - nowMs) / 60000)
      : 0;
    const toSunriseMin = !isDay && Number.isFinite(sunriseMs) && nowMs < sunriseMs
      ? Math.max(0, (sunriseMs - nowMs) / 60000)
      : !isDay && Number.isFinite(sunriseNextMs)
        ? Math.max(0, (sunriseNextMs - nowMs) / 60000)
        : 0;

    const tooltipLine = isDay
      ? `Światło dzienne: ${formatHhMm(remainingDaylightMin)}`
      : `Do wschodu: ${formatHhMm(toSunriseMin)}`;

    const sunriseText = formatLocalTime(props.sunriseIso);
    const sunsetText = formatLocalTime(props.sunsetIso);

    const MarkerIcon = isDay ? Sun : Moon;

    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="select-none">
              <div className="flex items-center justify-center">
                <div className="relative" style={{ width, height }}>
                  <svg
                    width={width}
                    height={height}
                    viewBox={`0 0 ${width} ${height}`}
                    className="block"
                  >
                    <defs>
                      <linearGradient id="sunPathDay" x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%" stopColor="#b9b2a3" stopOpacity="0.65" />
                        <stop offset="50%" stopColor="#e6e4dd" stopOpacity="0.75" />
                        <stop offset="82%" stopColor="#d8a08a" stopOpacity="0.55" />
                        <stop offset="100%" stopColor="#b59ad0" stopOpacity="0.45" />
                      </linearGradient>
                      <linearGradient id="sunPathNight" x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%" stopColor="#9aa4b2" stopOpacity="0.35" />
                        <stop offset="100%" stopColor="#7d8693" stopOpacity="0.35" />
                      </linearGradient>
                    </defs>

                    <path
                      d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
                      fill="none"
                      stroke={isDay ? "url(#sunPathDay)" : "url(#sunPathNight)"}
                      strokeWidth="3"
                      strokeLinecap="round"
                    />
                  </svg>

                  <div
                    className="absolute -translate-x-1/2 -translate-y-1/2"
                    style={{ left: x, top: y }}
                  >
                    <div className="rounded-full bg-background/60 p-1 shadow-sm ring-1 ring-border/40">
                      <MarkerIcon className="h-3.5 w-3.5 text-muted-foreground" />
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-1 flex items-center justify-between text-xs tabular-nums text-muted-foreground">
                <span>{sunriseText}</span>
                <span>{sunsetText}</span>
              </div>
            </div>
          </TooltipTrigger>
          <TooltipContent side="top" align="center">
            <div className="text-xs">{tooltipLine}</div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!navigator.geolocation) {
      setWeatherStatus("error");
      return;
    }

    let cancelled = false;
    const ctrl = new AbortController();
    setWeatherStatus("loading");

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const lat = pos.coords.latitude;
          const lon = pos.coords.longitude;
          const url =
            "https://api.open-meteo.com/v1/forecast" +
            `?latitude=${encodeURIComponent(String(lat))}` +
            `&longitude=${encodeURIComponent(String(lon))}` +
            "&current=temperature_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m,relative_humidity_2m" +
            "&daily=sunrise,sunset" +
            "&forecast_days=2" +
            "&timezone=auto";

          const res = await fetch(url, { signal: ctrl.signal });
          if (!res.ok) throw new Error("weather_fetch_failed");
          const data = (await res.json()) as {
            current?: {
              temperature_2m?: number;
              apparent_temperature?: number;
              precipitation?: number;
              weather_code?: number;
              wind_speed_10m?: number;
              relative_humidity_2m?: number;
            };
            daily?: {
              sunrise?: string[];
              sunset?: string[];
            };
          };

          const cur = data.current;
          if (!cur) throw new Error("weather_missing_current");

          const sunriseIso = data.daily?.sunrise?.[0];
          const sunsetIso = data.daily?.sunset?.[0];
          const sunriseNextIso = data.daily?.sunrise?.[1];
          if (typeof sunriseIso !== "string" || typeof sunsetIso !== "string" || typeof sunriseNextIso !== "string") {
            throw new Error("weather_missing_sun");
          }

          const next = {
            tempC: typeof cur.temperature_2m === "number" ? cur.temperature_2m : 0,
            feelsLikeC: typeof cur.apparent_temperature === "number" ? cur.apparent_temperature : 0,
            precipMm: typeof cur.precipitation === "number" ? cur.precipitation : 0,
            windKph: typeof cur.wind_speed_10m === "number" ? cur.wind_speed_10m : 0,
            humidityPct: typeof cur.relative_humidity_2m === "number" ? cur.relative_humidity_2m : 0,
            sunriseIso,
            sunsetIso,
            sunriseNextIso,
            code: typeof cur.weather_code === "number" ? cur.weather_code : 0,
          };

          if (!cancelled) {
            setWeather(next);
            setWeatherStatus("idle");
          }
        } catch {
          if (!cancelled) setWeatherStatus("error");
        }
      },
      () => {
        if (!cancelled) setWeatherStatus("denied");
      },
      { enableHighAccuracy: false, maximumAge: 10 * 60 * 1000, timeout: 10 * 1000 }
    );

    return () => {
      cancelled = true;
      ctrl.abort();
    };
  }, []);

  const modalWorkout =
    props.checkInWorkout ??
    (props.workouts.length > 0
      ? {
          id: props.workouts[0].id,
          title: props.workouts[0].title,
          type: props.workouts[0].type,
          duration: props.workouts[0].durationMin ?? 60,
          tss: props.workouts[0].tss ?? 50,
        }
      : null);

  async function handleStart(workoutId: string) {
    if (props.checkInRequired && !props.todayCheckIn) {
      toast.error("Pre-training check required", { description: "Complete check-in before starting" });
      setCheckInOpen(true);
      return;
    }

    setStartingWorkoutId(workoutId);
    try {
      const res = await startWorkout({
        workoutId,
        checkInId: props.todayCheckIn?.id ?? null,
      });
      if (!res.success) {
        toast.error(res.error || "Failed to start workout");
        return;
      }
      toast.success("Workout started");
      router.refresh();
    } catch {
      toast.error("Failed to start workout");
    } finally {
      setStartingWorkoutId(null);
    }
  }

  const readinessTone =
    typeof readiness !== "number"
      ? ("neutral" as const)
      : readiness >= 70
        ? ("success" as const)
        : readiness >= 45
          ? ("warning" as const)
          : ("danger" as const);

  const primaryAction = (() => {
    if (props.checkInRequired && modalWorkout) {
      return {
        label: props.todayCheckIn ? "View check-in" : "Open check-in",
        onClick: () => setCheckInOpen(true),
        variant: "default" as const,
      };
    }

    const next = props.workouts.find((w) => w.planned && !w.completed) ?? props.workouts[0] ?? null;
    if (next) {
      return {
        label: "Open workout",
        href: `/calendar?workoutId=${encodeURIComponent(next.id)}`,
        variant: "default" as const,
      };
    }

    return { label: "Plan workout", href: "/calendar", variant: "default" as const };
  })();

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="type-h1">Today</h1>
          <p className="type-caption">{todayLabel}</p>
        </div>
        <div className="flex items-center gap-2">
          <CompactToggle value={compact} onChange={setCompact} />
          <Button variant="outline" size="sm" onClick={() => router.refresh()}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
          <Link href="/calendar">
            <Button size="sm">
              <Calendar className="mr-2 h-4 w-4" />
              Calendar
            </Button>
          </Link>
        </div>
      </div>

      <section className="grid gap-4 lg:grid-cols-12">
        <div className="lg:col-span-7">
          <ActionCard
            title="Today"
            subtitle={todayMeta.todayFocus}
            primary={primaryAction}
            secondary={{ label: "Plan", href: "/calendar", variant: "outline" }}
            density={density}
            badges={
              <div className="flex flex-wrap items-center gap-2">
                <Badge
                  variant={
                    readinessTone === "success"
                      ? "success"
                      : readinessTone === "warning"
                        ? "warning"
                        : readinessTone === "danger"
                          ? "danger"
                          : "muted"
                  }
                  className="h-6 px-2 tabular-nums"
                >
                  Readiness {typeof readiness === "number" ? `${readiness}%` : "—"}
                </Badge>
                {props.checkInRequired ? (
                  <Badge variant="warning" className="h-6 px-2">
                    Check-in required
                  </Badge>
                ) : null}
              </div>
            }
          >
            <div className={cn("grid gap-2", density === "compact" ? "mt-2" : "mt-3")}>
              <div className="text-xs text-muted-foreground">{todayMeta.recoveryTimeText}</div>
              <div className="text-xs text-muted-foreground tabular-nums">{todayMeta.signalSnapshot}</div>

              <div className="flex items-center justify-between gap-3 rounded-control border border-border/50 bg-secondary/30 p-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-foreground">Pre-training check-in</span>
                    <Badge variant={preTrainingBadgeVariant} className="h-5 px-2 text-2xs">
                      {preTrainingStatus === "completed"
                        ? "Completed"
                        : preTrainingStatus === "required"
                        ? "Required"
                        : "Pending"}
                    </Badge>
                  </div>
                  <div className="mt-0.5 text-2xs text-muted-foreground truncate">{preTrainingDescription}</div>
                </div>
                {hasPreTrainingWorkout ? (
                  <Button
                    variant={preTrainingStatus === "required" ? "default" : "ghost"}
                    size="sm"
                    onClick={() => setCheckInOpen(true)}
                    className={cn(
                      "h-7 text-xs",
                      preTrainingStatus === "required" && "bg-amber-500 hover:bg-amber-600 text-white"
                    )}
                  >
                    {props.todayCheckIn ? "View" : "Open"}
                  </Button>
                ) : (
                  <Link href="/calendar">
                    <Button variant="outline" size="sm" className="h-7 text-xs">
                      Plan workout
                    </Button>
                  </Link>
                )}
              </div>
              <Button
                variant="outline"
                size="sm"
                className="w-full text-primary border-primary/30 hover:bg-primary/5 mt-2"
                onClick={() => setTodayDecisionOpen(true)}
              >
                What should I do today?
              </Button>
            </div>
          </ActionCard>
          <TodayDecisionSheet
            open={todayDecisionOpen}
            onOpenChange={setTodayDecisionOpen}
          />
        </div>

        <div className="lg:col-span-5 grid grid-cols-2 gap-3">
          <MetricCard
            title="Readiness"
            value={typeof readiness === "number" ? readiness : "—"}
            unit={typeof readiness === "number" ? "%" : undefined}
            tone={readinessTone}
            hint={
              props.todayCheckIn?.aiDecision
                ? `Coach: ${props.todayCheckIn.aiDecision}`
                : typeof readiness === "number"
                  ? "Based on today’s check-in"
                  : "Do a check-in to unlock"
            }
            tooltip="A quick indicator of how ready you are for intensity today."
            density={density}
          />
          <MetricCard
            title="Planned Time"
            value={todayMeta.totalDurationMin}
            unit="min"
            hint={`${props.workouts.length} session${props.workouts.length === 1 ? "" : "s"}`}
            tooltip="Total planned training time for today."
            density={density}
          />
          <MetricCard
            title="Planned Load"
            value={todayMeta.totalTss}
            unit="TSS"
            hint={todayMeta.totalTss > 0 ? "Keep it smooth" : "Optional recovery"}
            tooltip="Total planned training stress for today."
            density={density}
          />
          <MetricCard
            title="Weather"
            value={weather && weatherView && weatherStatus === "idle" ? Math.round(weather.tempC) : "—"}
            unit={weather && weatherView && weatherStatus === "idle" ? "°C" : undefined}
            hint={
              weather && weatherView && weatherStatus === "idle"
                ? `${weatherView.label} • feels ${Math.round(weather.feelsLikeC)}°C`
                : weatherStatus === "denied"
                  ? "Enable location"
                  : weatherStatus === "loading"
                    ? "Loading…"
                    : "Unavailable"
            }
            tooltip="Local conditions can affect pace, clothing, and hydration."
            density={density}
          />
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <ListCard
          title="Today’s workouts"
          subtitle={props.workouts.length > 0 ? `${props.workouts.length} session${props.workouts.length === 1 ? "" : "s"}` : "—"}
          density={density}
          right={
            <Link href="/calendar">
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-2xs text-muted-foreground hover:text-foreground"
              >
                View all
              </Button>
            </Link>
          }
          items={props.workouts}
          empty={{
            title: "No sessions scheduled",
            description: "Plan a workout — or take a true rest day and recover.",
            cta: { label: "Plan workout", href: "/calendar" },
          }}
          renderItem={(w) => {
            const dur = typeof w.durationMin === "number" && w.durationMin > 0 ? `${w.durationMin}min` : null;
            const tss = typeof w.tss === "number" && w.tss > 0 ? `${w.tss} TSS` : null;
            const meta = [w.type, dur, tss].filter(Boolean).join(" • ");
            const statusBadge = w.completed ? (
              <Badge variant="success" className="h-5 px-2">Done</Badge>
            ) : w.planned ? (
              <Badge className="h-5 px-2">Planned</Badge>
            ) : null;
            const adaptedBadge = isAdaptedFromCheckIn(w) ? (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Badge variant="info" className="h-5 px-2">
                      Adapted
                    </Badge>
                  </TooltipTrigger>
                  <TooltipContent>Adapted based on your check-in.</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            ) : null;

            return (
              <div className={cn("flex items-center justify-between gap-3", density === "compact" ? "px-1" : "px-1.5")}>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <div className="text-sm font-medium truncate">{w.title}</div>
                    {statusBadge}
                    {adaptedBadge}
                  </div>
                  <div className="mt-0.5 text-2xs text-muted-foreground tabular-nums truncate">
                    {meta}
                  </div>
                </div>

                <div className={cn("flex items-center gap-2 shrink-0", density === "compact" ? "gap-1.5" : "gap-2")}>
                  <Link href={`/calendar?workoutId=${encodeURIComponent(w.id)}`}>
                    <Button variant="outline" size="sm" className={density === "compact" ? "px-2" : undefined}>
                      <Calendar className="h-4 w-4" />
                      <span className={cn(density === "compact" ? "hidden" : "inline")}>Open</span>
                    </Button>
                  </Link>

                  {!w.completed ? (
                    <Button
                      onClick={() => handleStart(w.id)}
                      variant="outline"
                      size="sm"
                      disabled={startingWorkoutId === w.id}
                      className={density === "compact" ? "px-2" : undefined}
                    >
                      <Play className="h-4 w-4" />
                      <span className={cn(density === "compact" ? "hidden" : "inline")}>Start</span>
                    </Button>
                  ) : null}

                  {!w.completed ? (
                    <div className={density === "compact" ? "scale-[0.98] origin-right" : ""}>
                      <WorkoutCompleteFlow
                        workoutId={w.id}
                        workoutTitle={w.title}
                        onComplete={() => router.refresh()}
                      />
                    </div>
                  ) : (
                    <Button variant="outline" size="sm" disabled className={cn("gap-2", density === "compact" ? "px-2" : undefined)}>
                      <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                      <span className={cn(density === "compact" ? "hidden" : "inline")}>Completed</span>
                    </Button>
                  )}
                </div>
              </div>
            );
          }}
        />

        <Card>
          <CardHeader className={cn(density === "compact" ? "pb-2" : "pb-2")}>
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <CardTitle className="text-sm font-semibold tracking-tight">Weather</CardTitle>
                <CardDescription className="text-2xs">
                  Local conditions (pacing + gear)
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className={cn(density === "compact" ? "pt-0" : "pt-0")}>
            {weatherStatus === "loading" ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="h-6 w-14" />
                </div>
                <Skeleton className="h-3 w-3/4" />
                <Skeleton className="h-20 w-full" />
              </div>
            ) : weatherStatus === "denied" ? (
              <EmptyState
                title="Location disabled"
                description="Enable location to show local weather on Today."
                icon={<MapPinOff className="h-5 w-5 text-muted-foreground/70" />}
                size={density === "compact" ? "sm" : "md"}
              />
            ) : weatherStatus === "error" ? (
              <EmptyState
                title="Weather unavailable"
                description="Couldn’t load weather right now. Try refreshing."
                icon={<Cloud className="h-5 w-5 text-muted-foreground/70" />}
                cta={{ label: "Refresh", onClick: () => router.refresh() }}
                size={density === "compact" ? "sm" : "md"}
              />
            ) : weather && weatherView ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <weatherView.Icon className="h-4 w-4 text-muted-foreground" />
                    <div className="text-sm font-medium">{weatherView.label}</div>
                  </div>
                  <div className="text-lg font-bold tabular-nums">{Math.round(weather.tempC)}°C</div>
                </div>
                <div className="text-xs text-muted-foreground tabular-nums">
                  Feels {Math.round(weather.feelsLikeC)}°C · Wind {Math.round(weather.windKph)} km/h · Humidity{" "}
                  {Math.round(weather.humidityPct)}% · Precip {Math.round(weather.precipMm)} mm
                </div>
                <div className="pt-1">
                  <SunPathIndicator
                    now={new Date()}
                    sunriseIso={weather.sunriseIso}
                    sunsetIso={weather.sunsetIso}
                    sunriseNextIso={weather.sunriseNextIso}
                  />
                </div>
              </div>
            ) : (
              <EmptyState
                title="No weather data"
                description="Enable location to see local conditions."
                icon={<CloudSun className="h-5 w-5 text-muted-foreground/70" />}
                size={density === "compact" ? "sm" : "md"}
              />
            )}
          </CardContent>
        </Card>
      </section>

      {modalWorkout ? (
        <DailyCheckInModal
          open={checkInOpen}
          onOpenChange={setCheckInOpen}
          workout={modalWorkout}
          onComplete={() => {
            setCheckInOpen(false);
            router.refresh();
          }}
        />
      ) : null}

      <div className="pt-4 text-xs text-muted-foreground">
        Po treningu zapytam Cię, jak się czułeś — to pomaga mi lepiej planować kolejne dni.
      </div>
    </div>
  );
}
