"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import {
  Loader2,
  User,
  Heart,
  Brain,
  Bot,
  CreditCard,
  Target,
  Briefcase,
  Info,
  Calculator,
  Languages,
  MapPin,
  Clock,
  Shield,
  Calendar,
  Bell,
} from "lucide-react";
import { updateExplainLevel, getExplainLevel } from "@/lib/actions/decision";
import { updateIdentityMode, getIdentityMode } from "@/lib/actions/psychology";
import {
  getPlanRigidity,
  updatePlanRigidity,
  type PlanRigiditySetting,
} from "@/lib/actions/plan-rigidity";
import {
  getCoachCalendarSettings,
  updateCoachCalendarSettings,
  type CoachCalendarSettings,
} from "@/lib/actions/coach-draft";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  SettingsSectionCard,
  SettingsField,
  SettingsTopBar,
  SettingsAiSummaryPanel,
  InputWithAdornment,
} from "@/components/settings";
import { ProfileAvatarSection } from "@/components/settings/profile-avatar-section";
import type {
  AvailabilityData,
  PreferencesData,
  GuardrailsData,
  DayOfWeek,
  PreferredTime,
  TrainingStyle,
  SurfacePreference,
  SwimPreference,
  SwimLevel,
} from "@/lib/types/profile";
import { AVAILABILITY_PRESETS } from "@/lib/types/profile";
import { LanguageSwitcher } from "@/components/language-switcher";
import { parseMmSsToSeconds, formatSecondsToMmSs } from "@/lib/utils/parse-time";
import { cn } from "@/lib/utils";
import { getIsAdmin, resyncBillingAdmin, forceProFor24h } from "@/lib/actions/admin-billing";

const ZONE_TAGS = ["Easy", "Endurance", "Tempo", "Threshold", "VO2"];
const INPUT_CLASS =
  "h-10 w-full rounded-[12px] border border-white/[0.08] bg-background/50 px-3 text-sm transition-default focus:border-white/20 focus:ring-1 focus:ring-white/10 focus:outline-none";

type SaveStatus = "saved" | "unsaved" | "saving" | "error";

const INITIAL_PROFILE = {
  name: "",
  email: "",
  sportPrimary: "",
  experienceLevel: "",
  weeklyHoursGoal: "",
  restingHR: "",
  maxHR: "",
  ftp: "",
  weight: "",
  height: "",
  equipmentNotes: "",
  terrainNotes: "",
  availabilityNotes: "",
  swimPoolLengthM: "",
  club: "",
  location: "",
  timezone: "",
  birthYear: "",
};

const INITIAL_AVAILABILITY: AvailabilityData = {};
const INITIAL_PREFERENCES: PreferencesData = {};
const INITIAL_GUARDRAILS: GuardrailsData = { limitWeeklyRampRatePercent: 15 };

const DAYS = [
  { value: 0 as DayOfWeek, label: "Sun" },
  { value: 1 as DayOfWeek, label: "Mon" },
  { value: 2 as DayOfWeek, label: "Tue" },
  { value: 3 as DayOfWeek, label: "Wed" },
  { value: 4 as DayOfWeek, label: "Thu" },
  { value: 5 as DayOfWeek, label: "Fri" },
  { value: 6 as DayOfWeek, label: "Sat" },
];

const INITIAL_ZONES = {
  zone1Min: "",
  zone1Max: "",
  zone2Min: "",
  zone2Max: "",
  zone3Min: "",
  zone3Max: "",
  zone4Min: "",
  zone4Max: "",
  zone5Min: "",
  zone5Max: "",
};

const INITIAL_BENCHMARKS = {
  swimCssSecPer100: "",
  swim400TimeSec: "",
  swim100TimeSec: "",
  swim200TimeSec: "",
  swim1500TimeSec: "",
  run5kTimeSec: "",
  run10kTimeSec: "",
  runThresholdSecPerKm: "",
  runHmTimeSec: "",
  runMarathonTimeSec: "",
  bikeBest20minWatts: "",
};

export default function SettingsPage() {
  const t = useTranslations("settings");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState("profile");
  const [profile, setProfile] = useState(INITIAL_PROFILE);
  const [zones, setZones] = useState(INITIAL_ZONES);
  const [benchmarks, setBenchmarks] = useState(INITIAL_BENCHMARKS);
  const [explainLevel, setExplainLevel] = useState<"minimal" | "standard" | "deep">("standard");
  const [coachDetailLevel, setCoachDetailLevel] = useState<CoachCalendarSettings["detailLevel"]>("detailed");
  const [coachAutoAddToCalendar, setCoachAutoAddToCalendar] = useState<CoachCalendarSettings["autoAddToCalendar"]>("draft");
  const [identityMode, setIdentityMode] = useState<
    "competitive" | "longevity" | "comeback" | "busy_pro"
  >("competitive");
  const [planRigidity, setPlanRigidity] = useState<PlanRigiditySetting>("LOCKED_1_DAY");
  const [isSavingExplain, setIsSavingExplain] = useState(false);
  const [isSavingIdentity, setIsSavingIdentity] = useState(false);
  const [isSavingRigidity, setIsSavingRigidity] = useState(false);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("saved");
  const [isLoading, setIsLoading] = useState(true);
  const [isOpeningPortal, setIsOpeningPortal] = useState(false);
  const [isStartingCheckout, setIsStartingCheckout] = useState(false);
  const [checkoutPlan, setCheckoutPlan] = useState<"month" | "year">("month");
  const [planInfo, setPlanInfo] = useState<{
    name: string;
    status: string;
    trialEndsAt?: string | null;
    trialDaysRemaining?: number | null;
    currentPeriodEnd?: string | null;
    cancelAtPeriodEnd?: boolean;
  } | null>(null);
  const [syncingBilling, setSyncingBilling] = useState(false);
  const [benchmarkErrors, setBenchmarkErrors] = useState<Record<string, string>>({});
  const [zoneErrors, setZoneErrors] = useState<string | null>(null);
  const [showUnsavedDialog, setShowUnsavedDialog] = useState(false);
  const [pendingTab, setPendingTab] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [availability, setAvailability] = useState<AvailabilityData>(INITIAL_AVAILABILITY);
  const [preferences, setPreferences] = useState<PreferencesData>(INITIAL_PREFERENCES);
  const [guardrails, setGuardrails] = useState<GuardrailsData>(INITIAL_GUARDRAILS);
  const [profileErrors, setProfileErrors] = useState<Record<string, string>>({});

  const [initialProfile, setInitialProfile] = useState(INITIAL_PROFILE);
  const [initialZones, setInitialZones] = useState(INITIAL_ZONES);
  const [initialBenchmarks, setInitialBenchmarks] = useState(INITIAL_BENCHMARKS);
  const [initialAvailability, setInitialAvailability] = useState<AvailabilityData>(INITIAL_AVAILABILITY);
  const [initialPreferences, setInitialPreferences] = useState<PreferencesData>(INITIAL_PREFERENCES);
  const [initialGuardrails, setInitialGuardrails] = useState<GuardrailsData>(INITIAL_GUARDRAILS);
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminResyncUserId, setAdminResyncUserId] = useState("");
  const [adminResyncLoading, setAdminResyncLoading] = useState(false);
  const [adminForceProLoading, setAdminForceProLoading] = useState(false);

  const profileDirty =
    JSON.stringify(profile) !== JSON.stringify(initialProfile) ||
    JSON.stringify(zones) !== JSON.stringify(initialZones) ||
    JSON.stringify(benchmarks) !== JSON.stringify(initialBenchmarks) ||
    JSON.stringify(availability) !== JSON.stringify(initialAvailability) ||
    JSON.stringify(preferences) !== JSON.stringify(initialPreferences) ||
    JSON.stringify(guardrails) !== JSON.stringify(initialGuardrails);
  const hasChanges = profileDirty;

  useEffect(() => {
    const tab = searchParams.get("tab");
    if (tab === "billing") setActiveTab("billing");
  }, [searchParams]);

  useEffect(() => {
    getIsAdmin().then(setIsAdmin);
  }, []);

  useEffect(() => {
    if (hasChanges && saveStatus === "saved") setSaveStatus("unsaved");
  }, [hasChanges, saveStatus]);

  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (hasChanges) e.preventDefault();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [hasChanges]);

  const resetToInitial = useCallback(() => {
    setProfile(initialProfile);
    setZones(initialZones);
    setBenchmarks(initialBenchmarks);
    setAvailability(initialAvailability);
    setPreferences(initialPreferences);
    setGuardrails(initialGuardrails);
    setBenchmarkErrors({});
    setZoneErrors(null);
    setProfileErrors({});
  }, [initialProfile, initialZones, initialBenchmarks, initialAvailability, initialPreferences, initialGuardrails]);

  useEffect(() => {
    const checkoutSuccess = searchParams.get("checkout") === "success";
    const portalReturn = searchParams.get("portal") === "return";
    const sessionId = (searchParams.get("session_id") ?? "").trim();
    if (checkoutSuccess || portalReturn) {
      setActiveTab("billing");
      router.refresh();
      setSyncingBilling(true);
      const refetchPlan = () =>
        fetch("/api/profile")
          .then((res) => res.json())
          .then((data) => {
            if (data?.plan) setPlanInfo(data.plan);
          })
          .catch(() => {});
      // Always use refresh=1 when returning from checkout/portal; session_id enables immediate sync from Stripe session
      const statusUrl =
        "/api/billing/status?refresh=1" +
        (sessionId.startsWith("cs_") ? `&session_id=${encodeURIComponent(sessionId)}` : "");
      fetch(statusUrl, { cache: "no-store", credentials: "same-origin" })
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data?.canUsePro ?? data?.isPro) {
            toast.success("Subscription active. You now have Pro access.");
          }
          // Update plan UI immediately from status response so PRO shows without waiting for /api/profile
          if (data && typeof data.plan === "string") {
            setPlanInfo({
              name: data.plan === "PRO" ? "Pro" : data.plan === "TRIAL" ? "Trial" : "Free",
              status: typeof data.status === "string" ? data.status : data.subscriptionStatus ?? "",
              trialDaysRemaining: data.trialDaysRemaining ?? null,
              currentPeriodEnd: data.currentPeriodEnd ?? null,
              cancelAtPeriodEnd: Boolean(data.cancelAtPeriodEnd),
            });
          } else {
            refetchPlan();
          }
          router.refresh();
        })
        .catch(() => {
          refetchPlan();
          router.refresh();
        })
        .finally(() => setSyncingBilling(false));
      const t = setTimeout(() => {
        refetchPlan();
        router.refresh();
        setSyncingBilling(false);
      }, 3000);
      window.history.replaceState(null, "", window.location.pathname + (window.location.hash || ""));
      return () => clearTimeout(t);
    }
  }, [searchParams, router]);

  useEffect(() => {
    fetch("/api/profile")
      .then((res) => res.json())
      .then((data) => {
        if (data.user) {
          setAvatarUrl(data.user.image ?? null);
          const p = {
            name: data.user.name || "",
            email: data.user.email || "",
            sportPrimary: data.profile?.sportPrimary || "",
            experienceLevel: data.profile?.experienceLevel || "",
            weeklyHoursGoal: data.profile?.weeklyHoursGoal?.toString() || "",
            restingHR: data.profile?.restingHR?.toString() || "",
            maxHR: data.profile?.maxHR?.toString() || "",
            ftp: data.profile?.ftp?.toString() || "",
            weight: data.profile?.weight?.toString() || "",
            height: data.profile?.height?.toString() || "",
            equipmentNotes: data.profile?.equipmentNotes || "",
            terrainNotes: data.profile?.terrainNotes || "",
            availabilityNotes: data.profile?.availabilityNotes || "",
            swimPoolLengthM: data.profile?.swimPoolLengthM?.toString() || "",
            club: data.profile?.club || "",
            location: data.profile?.location || "",
            timezone: data.profile?.timezone || "",
            birthYear: data.profile?.birthYear?.toString() || "",
          };
          setProfile(p);
          setInitialProfile(p);
          const av = (data.profile?.availability as AvailabilityData) || {};
          setAvailability(av);
          setInitialAvailability(av);
          const pr = (data.profile?.preferences as PreferencesData) || {};
          setPreferences(pr);
          setInitialPreferences(pr);
          const gd = (data.profile?.guardrails as GuardrailsData) || { limitWeeklyRampRatePercent: 15 };
          setGuardrails(gd);
          setInitialGuardrails(gd);
          if (data.profile) {
            const z = {
              zone1Min: data.profile.zone1Min?.toString() || "",
              zone1Max: data.profile.zone1Max?.toString() || "",
              zone2Min: data.profile.zone2Min?.toString() || "",
              zone2Max: data.profile.zone2Max?.toString() || "",
              zone3Min: data.profile.zone3Min?.toString() || "",
              zone3Max: data.profile.zone3Max?.toString() || "",
              zone4Min: data.profile.zone4Min?.toString() || "",
              zone4Max: data.profile.zone4Max?.toString() || "",
              zone5Min: data.profile.zone5Min?.toString() || "",
              zone5Max: data.profile.zone5Max?.toString() || "",
            };
            setZones(z);
            setInitialZones(z);
          }
        }
        if (data.plan) setPlanInfo(data.plan);
      })
      .catch(() => toast.error("Failed to load profile"))
      .finally(() => setIsLoading(false));

    fetch("/api/profile/benchmarks")
      .then((res) => res.json())
      .then((data) => {
        const b = data?.benchmarks ?? null;
        const bench = {
          swimCssSecPer100: formatSecondsToMmSs(b?.swimCssSecPer100 ?? null),
          swim400TimeSec: formatSecondsToMmSs(b?.swim400TimeSec ?? null),
          swim100TimeSec: formatSecondsToMmSs(b?.swim100TimeSec ?? null),
          swim200TimeSec: formatSecondsToMmSs(b?.swim200TimeSec ?? null),
          swim1500TimeSec: formatSecondsToMmSs(b?.swim1500TimeSec ?? null),
          run5kTimeSec: formatSecondsToMmSs(b?.run5kTimeSec ?? null),
          run10kTimeSec: formatSecondsToMmSs(b?.run10kTimeSec ?? null),
          runThresholdSecPerKm: formatSecondsToMmSs(b?.runThresholdSecPerKm ?? null),
          runHmTimeSec: formatSecondsToMmSs(b?.runHmTimeSec ?? null),
          runMarathonTimeSec: formatSecondsToMmSs(b?.runMarathonTimeSec ?? null),
          bikeBest20minWatts: b?.bikeBest20minWatts?.toString() ?? "",
        };
        setBenchmarks(bench);
        setInitialBenchmarks(bench);
      })
      .catch(() => {});

    getExplainLevel().then(setExplainLevel);
    getIdentityMode().then((m) => setIdentityMode(m as typeof identityMode));
    getPlanRigidity().then(setPlanRigidity);
    getCoachCalendarSettings().then((s) => {
      if (s) {
        setCoachDetailLevel(s.detailLevel);
        setCoachAutoAddToCalendar(s.autoAddToCalendar);
      }
    });
  }, []);

  async function saveProfile() {
    setSaveStatus("saving");
    setBenchmarkErrors({});
    setZoneErrors(null);
    setProfileErrors({});
    try {
      const errs: Record<string, string> = {};
      const by = profile.birthYear.trim();
      if (by) {
        const y = parseInt(by, 10);
        if (isNaN(y) || y < 1930 || y > 2015) errs.birthYear = "Valid year 1930–2015";
      }
      const ramp = guardrails.limitWeeklyRampRatePercent;
      if (ramp != null && (ramp < 5 || ramp > 30)) errs.rampRate = "5–30%";
      if (Object.keys(errs).length > 0) {
        setProfileErrors(errs);
        setSaveStatus("error");
        toast.error("Fix validation errors");
        return;
      }
      const benchmarkPayload = buildBenchmarkPayload();
      const res = await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...profile,
          ...zones,
          availability: Object.keys(availability).length ? availability : null,
          preferences: Object.keys(preferences).length ? preferences : null,
          guardrails: Object.keys(guardrails).length ? guardrails : null,
        }),
      });
      if (!res.ok) throw new Error("Failed to save");

      const resBench = await fetch("/api/profile/benchmarks", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(benchmarkPayload),
      });
      if (!resBench.ok) {
        const benchData = (await resBench.json().catch(() => null)) as {
          error?: string;
          issues?: Array<{ path: string[]; message: string }>;
        } | null;
        const first = benchData?.issues?.[0];
        throw new Error(first ? `${first.path.join(".")}: ${first.message}` : benchData?.error ?? "Failed to save benchmarks");
      }

      setInitialProfile(profile);
      setInitialZones(zones);
      setInitialBenchmarks(benchmarks);
      setInitialAvailability(availability);
      setInitialPreferences(preferences);
      setInitialGuardrails(guardrails);
      setSaveStatus("saved");
      toast.success(t("settingsSaved") || "Settings saved");
    } catch (err) {
      setSaveStatus("error");
      toast.error(err instanceof Error ? err.message : "Failed to save");
    }
  }

  function buildBenchmarkPayload() {
    const errs: Record<string, string> = {};
    const parse = (key: string, val: string, min?: number, max?: number) => {
      const sec = parseMmSsToSeconds(val);
      if (val.trim() && sec === null) {
        errs[key] = "Use mm:ss or h:mm:ss";
        return null;
      }
      if (sec != null && min != null && (sec < min || sec > max!)) return null;
      return sec;
    };
    const swimCssSecPer100 = parse("swimCssSecPer100", benchmarks.swimCssSecPer100, 20, 600);
    const swim400TimeSec = parse("swim400TimeSec", benchmarks.swim400TimeSec, 60, 7200);
    const swim100TimeSec = parse("swim100TimeSec", benchmarks.swim100TimeSec, 20, 3600);
    const swim200TimeSec = parseMmSsToSeconds(benchmarks.swim200TimeSec);
    const swim1500TimeSec = parseMmSsToSeconds(benchmarks.swim1500TimeSec);
    const run5kTimeSec = parse("run5kTimeSec", benchmarks.run5kTimeSec, 600, 36000);
    const run10kTimeSec = parse("run10kTimeSec", benchmarks.run10kTimeSec, 900, 72000);
    const runThresholdSecPerKm = parse("runThresholdSecPerKm", benchmarks.runThresholdSecPerKm, 120, 1200);
    const runHmTimeSec = parseMmSsToSeconds(benchmarks.runHmTimeSec);
    const runMarathonTimeSec = parseMmSsToSeconds(benchmarks.runMarathonTimeSec);
    const bikeBest20minWatts = benchmarks.bikeBest20minWatts.trim()
      ? parseInt(benchmarks.bikeBest20minWatts, 10)
      : null;
    if (bikeBest20minWatts !== null && (isNaN(bikeBest20minWatts) || bikeBest20minWatts < 50 || bikeBest20minWatts > 600)) {
      errs.bikeBest20minWatts = "50–600 W";
    }
    setBenchmarkErrors(errs);
    if (Object.keys(errs).length > 0) throw new Error("Fix benchmark errors");
    const ftpVal = profile.ftp?.trim() ? parseInt(profile.ftp, 10) : NaN;
    const bikeFtpWatts = Number.isFinite(ftpVal) ? ftpVal : null;
    return {
      swimCssSecPer100,
      swim400TimeSec,
      swim100TimeSec,
      swim200TimeSec,
      swim1500TimeSec,
      run5kTimeSec,
      run10kTimeSec,
      runThresholdSecPerKm,
      runHmTimeSec,
      runMarathonTimeSec,
      bikeBest20minWatts,
      bikeFtpWatts,
    };
  }

  function calculateZones() {
    const maxHR = parseInt(profile.maxHR);
    const restingHR = parseInt(profile.restingHR);
    if (!maxHR) {
      setZoneErrors("Enter max heart rate first (Profile tab)");
      return;
    }
    setZoneErrors(null);
    const hrr = restingHR ? maxHR - restingHR : maxHR * 0.5;
    const base = restingHR || 0;
    setZones({
      zone1Min: Math.round(base + hrr * 0.5).toString(),
      zone1Max: Math.round(base + hrr * 0.6).toString(),
      zone2Min: Math.round(base + hrr * 0.6).toString(),
      zone2Max: Math.round(base + hrr * 0.7).toString(),
      zone3Min: Math.round(base + hrr * 0.7).toString(),
      zone3Max: Math.round(base + hrr * 0.8).toString(),
      zone4Min: Math.round(base + hrr * 0.8).toString(),
      zone4Max: Math.round(base + hrr * 0.9).toString(),
      zone5Min: Math.round(base + hrr * 0.9).toString(),
      zone5Max: maxHR.toString(),
    });
    toast.success("Zones calculated (Karvonen)");
  }

  function clearOptionalBenchmarks() {
    setBenchmarks({
      ...benchmarks,
      swim400TimeSec: "",
      swim100TimeSec: "",
      swim200TimeSec: "",
      swim1500TimeSec: "",
      runThresholdSecPerKm: "",
      runHmTimeSec: "",
      runMarathonTimeSec: "",
    });
    toast("Optional benchmarks cleared");
  }

  function handleTabChange(val: string) {
    if (hasChanges) {
      setPendingTab(val);
      setShowUnsavedDialog(true);
    } else {
      setActiveTab(val);
    }
  }

  function confirmTabChange(discard: boolean) {
    if (discard) resetToInitial();
    if (pendingTab) setActiveTab(pendingTab);
    setPendingTab(null);
    setShowUnsavedDialog(false);
  }

  async function openBillingPortal() {
    setIsOpeningPortal(true);
    try {
      const res = await fetch("/api/billing/portal", { method: "POST", headers: { "Content-Type": "application/json" } });
      const data = (await res.json().catch(() => null)) as { url?: string; error?: string } | null;
      if (!res.ok) {
        toast.error(data?.error ?? "Failed to open billing portal");
        return;
      }
      if (data?.url) window.location.href = data.url;
      else toast.error("Missing portal URL");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to open billing portal");
    } finally {
      setIsOpeningPortal(false);
    }
  }

  async function openCheckout() {
    setIsStartingCheckout(true);
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: checkoutPlan }),
      });
      const data = (await res.json().catch(() => null)) as { url?: string; error?: string; code?: string; portalUrl?: string } | null;
      if (!res.ok) {
        if (res.status === 409 && data?.code === "ALREADY_SUBSCRIBED") {
          toast.info("Already subscribed. Open billing portal to manage your subscription.");
          if (typeof data?.portalUrl === "string") {
            window.location.href = data.portalUrl;
            return;
          }
          openBillingPortal();
          return;
        }
        toast.error(data?.error ?? "Failed to start checkout");
        return;
      }
      if (data?.url) window.location.href = data.url;
      else toast.error("Missing checkout URL");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to start checkout");
    } finally {
      setIsStartingCheckout(false);
    }
  }

  const handlePlanRigidityChange = async (v: PlanRigiditySetting) => {
    setIsSavingRigidity(true);
    try {
      const r = await updatePlanRigidity(v);
      if (r.success) {
        setPlanRigidity(v);
        toast.success("Updated");
      } else toast.error(r.error ?? "Failed");
    } catch {
      toast.error("Failed to update");
    } finally {
      setIsSavingRigidity(false);
    }
  };

  const handleIdentityModeChange = async (mode: typeof identityMode) => {
    setIsSavingIdentity(true);
    try {
      const r = await updateIdentityMode(mode);
      if (r.success) {
        setIdentityMode(mode);
        toast.success("Updated");
      } else toast.error(r.error ?? "Failed");
    } catch {
      toast.error("Failed to update");
    } finally {
      setIsSavingIdentity(false);
    }
  };

  const handleExplainLevelChange = async (level: "minimal" | "standard" | "deep") => {
    setIsSavingExplain(true);
    try {
      const r = await updateExplainLevel(level);
      if (r.success) {
        setExplainLevel(level);
        toast.success("Updated");
      } else toast.error(r.error ?? "Failed");
    } catch {
      toast.error("Failed to update");
    } finally {
      setIsSavingExplain(false);
    }
  };

  const zonesSummary = zones.zone5Max
    ? `Z5: ${zones.zone5Min}–${zones.zone5Max} bpm`
    : undefined;
  const hasBenchmarks =
    !!benchmarks.swimCssSecPer100 ||
    !!benchmarks.run5kTimeSec ||
    !!benchmarks.run10kTimeSec ||
    !!benchmarks.bikeBest20minWatts;

  if (isLoading) {
    return (
      <div className="flex min-h-[200px] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="page-container max-w-[1120px]">
        <SettingsTopBar
          title={t("title")}
          description={t("description")}
          status={saveStatus}
          hasChanges={hasChanges}
          onSave={saveProfile}
          onReset={resetToInitial}
          isSaving={saveStatus === "saving"}
        />

        <Tabs value={activeTab} onValueChange={handleTabChange} className="mt-6">
          <TabsList className="sticky top-[72px] z-[9] mb-6 flex h-auto w-full justify-start gap-1 rounded-[14px] border border-white/[0.06] bg-card/30 p-1 backdrop-blur-sm">
            <TabsTrigger
              value="profile"
              className="flex items-center gap-2 rounded-[10px] px-4 py-2 data-[state=active]:bg-white/10"
            >
              <User className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{t("profile")}</span>
            </TabsTrigger>
            <TabsTrigger
              value="zones"
              className="flex items-center gap-2 rounded-[10px] px-4 py-2 data-[state=active]:bg-white/10"
            >
              <Heart className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{t("heartRateZones")}</span>
            </TabsTrigger>
            <TabsTrigger
              value="ai"
              className="flex items-center gap-2 rounded-[10px] px-4 py-2 data-[state=active]:bg-white/10"
            >
              <Brain className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{t("aiSettings")}</span>
            </TabsTrigger>
            <TabsTrigger
              value="billing"
              className="flex items-center gap-2 rounded-[10px] px-4 py-2 data-[state=active]:bg-white/10"
            >
              <CreditCard className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{t("billing")}</span>
            </TabsTrigger>
          </TabsList>

          <div className="flex gap-8">
            <div className="min-w-0 flex-1">
              <TabsContent value="profile" className="mt-0 space-y-5">
                <Card className="rounded-[18px] border border-white/[0.06] bg-card/50 overflow-hidden">
                  <CardContent className="p-5">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-6">
                      <ProfileAvatarSection
                        avatarUrl={avatarUrl}
                        userName={profile.name || null}
                        onAvatarChange={setAvatarUrl}
                      />
                      <div className="flex-1 min-w-0 space-y-1">
                        <h3 className="text-base font-semibold">{profile.name || t("athleteFallback")}</h3>
                        {profile.club && <p className="text-sm text-muted-foreground">{profile.club}</p>}
                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                          {profile.location && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{profile.location}</span>}
                          {profile.timezone && <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{profile.timezone}</span>}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <SettingsSectionCard
                  title={t("language")}
                  icon={Languages}
                  description={t("languageDescription")}
                >
                  <div className="flex items-center gap-4">
                    <LanguageSwitcher />
                  </div>
                </SettingsSectionCard>

                <SettingsSectionCard title={t("personal")} icon={User} description="">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <SettingsField label="Name">
                      <Input
                        className={INPUT_CLASS}
                        value={profile.name}
                        onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                      />
                    </SettingsField>
                    <SettingsField label="Email">
                      <Input className={cn(INPUT_CLASS, "opacity-70")} value={profile.email} disabled />
                    </SettingsField>
                    <SettingsField label={t("weight")} hint={t("weightHint")}>
                      <InputWithAdornment suffix="kg">
                        <Input
                          type="number"
                          className="border-0 bg-transparent p-0 shadow-none focus-visible:ring-0"
                          value={profile.weight}
                          onChange={(e) => setProfile({ ...profile, weight: e.target.value })}
                        />
                      </InputWithAdornment>
                    </SettingsField>
                    <SettingsField label={t("height")}>
                      <InputWithAdornment suffix="cm">
                        <Input
                          type="number"
                          className="border-0 bg-transparent p-0 shadow-none focus-visible:ring-0"
                          value={profile.height}
                          onChange={(e) => setProfile({ ...profile, height: e.target.value })}
                        />
                      </InputWithAdornment>
                    </SettingsField>
                  </div>
                </SettingsSectionCard>

                <SettingsSectionCard
                  title={t("athleteIdentity")}
                  icon={User}
                  description={t("athleteIdentityDesc")}
                >
                  <div className="grid gap-4 sm:grid-cols-2">
                    <SettingsField label={t("clubTeam")} hint={tCommon("optional")}>
                      <Input
                        className={INPUT_CLASS}
                        value={profile.club}
                        onChange={(e) => setProfile({ ...profile, club: e.target.value })}
                        placeholder="e.g. City Running Club"
                      />
                    </SettingsField>
                    <SettingsField label={t("location")} hint="City, country">
                      <Input
                        className={INPUT_CLASS}
                        value={profile.location}
                        onChange={(e) => setProfile({ ...profile, location: e.target.value })}
                        placeholder="e.g. Warsaw, Poland"
                      />
                    </SettingsField>
                    <SettingsField label={t("timezone")} hint="e.g. Europe/Warsaw">
                      <Input
                        className={INPUT_CLASS}
                        value={profile.timezone}
                        onChange={(e) => setProfile({ ...profile, timezone: e.target.value })}
                        placeholder="Auto-detect or enter"
                      />
                    </SettingsField>
                    <SettingsField
                      label={t("birthYear")}
                      hint={t("birthYearHint")}
                      error={profileErrors.birthYear}
                    >
                      <Input
                        type="number"
                        className={INPUT_CLASS}
                        value={profile.birthYear}
                        onChange={(e) => setProfile({ ...profile, birthYear: e.target.value })}
                        placeholder="1990"
                        min={1930}
                        max={2015}
                      />
                    </SettingsField>
                  </div>
                </SettingsSectionCard>

                <SettingsSectionCard
                  title="Training basics"
                  icon={Target}
                  description="Sport, level, and goals"
                >
                  <div className="grid gap-4 sm:grid-cols-2">
                    <SettingsField label="Primary sport">
                      <Select
                        value={profile.sportPrimary}
                        onValueChange={(v) => setProfile({ ...profile, sportPrimary: v })}
                      >
                        <SelectTrigger className={INPUT_CLASS}><SelectValue placeholder="Select" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="running">Running</SelectItem>
                          <SelectItem value="cycling">Cycling</SelectItem>
                          <SelectItem value="triathlon">Triathlon</SelectItem>
                          <SelectItem value="swimming">Swimming</SelectItem>
                          <SelectItem value="strength">Strength</SelectItem>
                        </SelectContent>
                      </Select>
                    </SettingsField>
                    <SettingsField label="Experience level">
                      <Select
                        value={profile.experienceLevel}
                        onValueChange={(v) => setProfile({ ...profile, experienceLevel: v })}
                      >
                        <SelectTrigger className={INPUT_CLASS}><SelectValue placeholder="Select" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="beginner">Beginner</SelectItem>
                          <SelectItem value="intermediate">Intermediate</SelectItem>
                          <SelectItem value="advanced">Advanced</SelectItem>
                          <SelectItem value="expert">Expert</SelectItem>
                        </SelectContent>
                      </Select>
                    </SettingsField>
                    <SettingsField label="Weekly hours goal">
                      <InputWithAdornment suffix="h">
                        <Input
                          type="number"
                          className="border-0 bg-transparent p-0 shadow-none focus-visible:ring-0"
                          value={profile.weeklyHoursGoal}
                          onChange={(e) => setProfile({ ...profile, weeklyHoursGoal: e.target.value })}
                        />
                      </InputWithAdornment>
                    </SettingsField>
                    <SettingsField label="Resting HR" hint="Resting morning HR">
                      <InputWithAdornment suffix="bpm">
                        <Input
                          type="number"
                          className="border-0 bg-transparent p-0 shadow-none focus-visible:ring-0"
                          value={profile.restingHR}
                          onChange={(e) => setProfile({ ...profile, restingHR: e.target.value })}
                        />
                      </InputWithAdornment>
                    </SettingsField>
                    <SettingsField label="Max HR">
                      <InputWithAdornment suffix="bpm">
                        <Input
                          type="number"
                          className="border-0 bg-transparent p-0 shadow-none focus-visible:ring-0"
                          value={profile.maxHR}
                          onChange={(e) => setProfile({ ...profile, maxHR: e.target.value })}
                        />
                      </InputWithAdornment>
                    </SettingsField>
                    <SettingsField label="Pool length" hint="For swim calculations">
                      <InputWithAdornment suffix="m">
                        <Input
                          type="number"
                          className="border-0 bg-transparent p-0 shadow-none focus-visible:ring-0"
                          value={profile.swimPoolLengthM}
                          onChange={(e) => setProfile({ ...profile, swimPoolLengthM: e.target.value })}
                          placeholder="25"
                        />
                      </InputWithAdornment>
                    </SettingsField>
                  </div>
                </SettingsSectionCard>

                <SettingsSectionCard
                  title="Context"
                  icon={Briefcase}
                  description="Terrain and notes — helps AI tailor plans"
                >
                  <div className="space-y-4">
                    <SettingsField label="Terrain & places">
                      <Textarea
                        className={cn(INPUT_CLASS, "min-h-[80px] resize-none")}
                        value={profile.terrainNotes}
                        onChange={(e) => setProfile({ ...profile, terrainNotes: e.target.value })}
                        placeholder="e.g. Flat routes, trails, track, hills"
                      />
                    </SettingsField>
                    <SettingsField label="Additional availability notes" hint="Extra constraints">
                      <Textarea
                        className={cn(INPUT_CLASS, "min-h-[60px] resize-none")}
                        value={profile.availabilityNotes}
                        onChange={(e) => setProfile({ ...profile, availabilityNotes: e.target.value })}
                        placeholder="Other scheduling constraints"
                      />
                    </SettingsField>
                  </div>
                </SettingsSectionCard>

                <SettingsSectionCard
                  title="Availability"
                  icon={Calendar}
                  description="Days, max time, preferred slots — biggest impact on planning"
                >
                  <div className="space-y-4">
                    <SettingsField label="Days available" hint="Which days can you train?">
                      <div className="flex flex-wrap gap-2">
                        {DAYS.map((d) => {
                          const checked = (availability.daysAvailable ?? []).includes(d.value);
                          return (
                            <label
                              key={d.value}
                              className={cn(
                                "flex h-9 min-w-[44px] cursor-pointer items-center justify-center rounded-lg border px-3 text-sm font-medium transition-colors",
                                checked
                                  ? "border-primary bg-primary/20 text-primary"
                                  : "border-white/[0.08] hover:border-white/15"
                              )}
                            >
                              <input
                                type="checkbox"
                                className="sr-only"
                                checked={checked}
                                onChange={() => {
                                  const prev = availability.daysAvailable ?? [];
                                  const next = checked
                                    ? prev.filter((x) => x !== d.value)
                                    : [...prev, d.value].sort((a, b) => a - b);
                                  setAvailability({ ...availability, daysAvailable: next });
                                }}
                              />
                              {d.label}
                            </label>
                          );
                        })}
                      </div>
                    </SettingsField>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <SettingsField label="Max time per day" hint="Minutes">
                        <div className="flex flex-wrap gap-2">
                          {AVAILABILITY_PRESETS.map((m) => {
                            const sel = availability.maxMinutesPerDay === m;
                            return (
                              <button
                                key={m ?? "null"}
                                type="button"
                                onClick={() => setAvailability({ ...availability, maxMinutesPerDay: m })}
                                className={cn(
                                  "h-9 rounded-lg border px-3 text-sm transition-colors",
                                  sel ? "border-primary bg-primary/20 text-primary" : "border-white/[0.08] hover:border-white/15"
                                )}
                              >
                                {m === null ? t("maxTimePerDayNoLimit") : `${m} min`}
                              </button>
                            );
                          })}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1.5">{t("maxTimePerDayNoLimitHint")}</p>
                      </SettingsField>
                      <SettingsField label="Preferred time">
                        <div className="flex rounded-lg border border-white/[0.08] p-0.5">
                          {(["morning", "evening", "any"] as PreferredTime[]).map((v) => {
                            const sel = (availability.preferredTime ?? "any") === v;
                            return (
                              <button
                                key={v}
                                type="button"
                                onClick={() => setAvailability({ ...availability, preferredTime: v })}
                                className={cn(
                                  "flex-1 rounded-md py-2 text-xs font-medium capitalize transition-colors",
                                  sel ? "bg-white/10 text-foreground" : "text-muted-foreground hover:text-foreground"
                                )}
                              >
                                {v}
                              </button>
                            );
                          })}
                        </div>
                      </SettingsField>
                    </div>
                    <SettingsField label="Rest day preference" hint="At least 1 rest day per week">
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={availability.atLeastOneRestDayPerWeek ?? false}
                          onChange={(e) =>
                            setAvailability({ ...availability, atLeastOneRestDayPerWeek: e.target.checked })
                          }
                          className="rounded border-white/20"
                        />
                        <span className="text-sm">At least 1 rest day/week</span>
                      </label>
                    </SettingsField>
                  </div>
                </SettingsSectionCard>

                <SettingsSectionCard
                  title="Training preferences"
                  icon={Target}
                  description="Style, surface, swim — better suggestions"
                >
                  <div className="space-y-4">
                    <SettingsField label="Training style">
                      <div className="grid gap-2 sm:grid-cols-3">
                        {(
                          [
                            { v: "volume_first" as TrainingStyle, l: "Volume-first" },
                            { v: "balanced" as TrainingStyle, l: "Balanced" },
                            { v: "intensity_first" as TrainingStyle, l: "Intensity-first" },
                          ] as const
                        ).map(({ v, l }) => (
                          <label
                            key={v}
                            className={cn(
                              "flex cursor-pointer items-center justify-center rounded-lg border py-3 text-sm font-medium transition-colors",
                              (preferences.trainingStyle ?? "balanced") === v
                                ? "border-primary bg-primary/20 text-primary"
                                : "border-white/[0.08] hover:border-white/15"
                            )}
                          >
                            <input
                              type="radio"
                              name="trainingStyle"
                              className="sr-only"
                              checked={(preferences.trainingStyle ?? "balanced") === v}
                              onChange={() => setPreferences({ ...preferences, trainingStyle: v })}
                            />
                            {l}
                          </label>
                        ))}
                      </div>
                    </SettingsField>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <SettingsField label="Hard sessions/week">
                        <div className="flex rounded-lg border border-white/[0.08] p-0.5">
                          {([1, 2, 3] as const).map((n) => {
                            const sel = (preferences.hardSessionsPerWeek ?? 2) === n;
                            return (
                              <button
                                key={n}
                                type="button"
                                onClick={() => setPreferences({ ...preferences, hardSessionsPerWeek: n })}
                                className={cn(
                                  "flex-1 rounded-md py-2 text-sm font-medium transition-colors",
                                  sel ? "bg-white/10 text-foreground" : "text-muted-foreground hover:text-foreground"
                                )}
                              >
                                {n}
                              </button>
                            );
                          })}
                        </div>
                      </SettingsField>
                      <SettingsField label="Surface preference" hint="Multi-select">
                        <div className="flex flex-wrap gap-2">
                          {(["road", "trail", "treadmill"] as SurfacePreference[]).map((s) => {
                            const arr = preferences.surfacePreference ?? [];
                            const checked = arr.includes(s);
                            return (
                              <label
                                key={s}
                                className={cn(
                                  "flex h-9 cursor-pointer items-center rounded-lg border px-3 text-sm capitalize transition-colors",
                                  checked ? "border-primary bg-primary/20 text-primary" : "border-white/[0.08]"
                                )}
                              >
                                <input
                                  type="checkbox"
                                  className="sr-only"
                                  checked={checked}
                                  onChange={() => {
                                    const next = checked
                                      ? arr.filter((x) => x !== s)
                                      : [...arr, s];
                                    setPreferences({ ...preferences, surfacePreference: next });
                                  }}
                                />
                                {s}
                              </label>
                            );
                          })}
                        </div>
                      </SettingsField>
                    </div>
                    <SettingsField label="Swim preference" hint="Optional">
                      <Select
                        value={preferences.swimPreference ?? ""}
                        onValueChange={(v: SwimPreference) =>
                          setPreferences({ ...preferences, swimPreference: v || undefined })
                        }
                      >
                        <SelectTrigger className={INPUT_CLASS}><SelectValue placeholder="Select" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="pool">Pool</SelectItem>
                          <SelectItem value="open_water">Open water</SelectItem>
                          <SelectItem value="both">Both</SelectItem>
                        </SelectContent>
                      </Select>
                    </SettingsField>
                    <SettingsField label="Swim level" hint="For AI Coach pool prescriptions. Default: Age group">
                      <Select
                        value={preferences.swimLevel ?? "age_group"}
                        onValueChange={(v: SwimLevel) =>
                          setPreferences({ ...preferences, swimLevel: v })
                        }
                      >
                        <SelectTrigger className={INPUT_CLASS}><SelectValue placeholder="Select" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="beginner">Beginner (800–1600m)</SelectItem>
                          <SelectItem value="age_group">Age group (1600–2800m)</SelectItem>
                          <SelectItem value="advanced">Advanced (2500–4000m)</SelectItem>
                          <SelectItem value="expert">Expert (3500–5500m+)</SelectItem>
                        </SelectContent>
                      </Select>
                    </SettingsField>
                    <SettingsField label="Notes for AI" hint="Things AI coach should know">
                      <Textarea
                        className={cn(INPUT_CLASS, "min-h-[80px] resize-none")}
                        value={preferences.notes ?? ""}
                        onChange={(e) => setPreferences({ ...preferences, notes: e.target.value || undefined })}
                        placeholder="e.g. I prefer morning runs, avoid running on Mondays…"
                      />
                    </SettingsField>
                  </div>
                </SettingsSectionCard>

                <SettingsSectionCard
                  title="Guardrails"
                  icon={Shield}
                  description="Safety and pro feeling — limits intensity and ramp"
                >
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label className="flex items-center justify-between gap-4">
                        <span className="text-sm font-medium">Max intensity when fatigue high</span>
                        <input
                          type="checkbox"
                          checked={guardrails.maxIntensityWhenFatigueHigh ?? false}
                          onChange={(e) =>
                            setGuardrails({ ...guardrails, maxIntensityWhenFatigueHigh: e.target.checked })
                          }
                          className="rounded border-white/20"
                        />
                      </label>
                      <p className="text-[11px] text-muted-foreground">Why: Avoids pushing hard when readiness is low.</p>
                    </div>
                    <div className="space-y-2">
                      <label className="flex items-center justify-between gap-4">
                        <span className="text-sm font-medium">Never 2 hard run days in a row</span>
                        <input
                          type="checkbox"
                          checked={guardrails.neverTwoHardRunDaysInRow ?? false}
                          onChange={(e) =>
                            setGuardrails({ ...guardrails, neverTwoHardRunDaysInRow: e.target.checked })
                          }
                          className="rounded border-white/20"
                        />
                      </label>
                      <p className="text-[11px] text-muted-foreground">Why: Reduces injury risk.</p>
                    </div>
                    <SettingsField
                      label="Limit weekly ramp rate"
                      hint="5–30%. Default 15%. Caps week-over-week load increase."
                      error={profileErrors.rampRate}
                    >
                      <InputWithAdornment suffix="%">
                        <Input
                          type="number"
                          min={5}
                          max={30}
                          className="border-0 bg-transparent p-0 shadow-none focus-visible:ring-0"
                          value={guardrails.limitWeeklyRampRatePercent != null ? String(guardrails.limitWeeklyRampRatePercent) : ""}
                          onChange={(e) => {
                            const v = e.target.value ? parseInt(e.target.value, 10) : undefined;
                            setGuardrails({ ...guardrails, limitWeeklyRampRatePercent: v });
                          }}
                          placeholder="15"
                        />
                      </InputWithAdornment>
                    </SettingsField>
                  </div>
                </SettingsSectionCard>

                <SettingsSectionCard
                  title="Performance Benchmarks"
                  icon={Target}
                  description="Used to derive pace/power targets. Leave blank to use zones + RPE."
                >
                  <div className="space-y-6">
                    <BenchmarksSportBlock
                      title="Swim"
                      hint="mm:ss / 100m or mm:ss for times"
                      fields={[
                        { key: "swimCssSecPer100", label: "CSS pace", placeholder: "1:45", hint: "/100m" },
                        { key: "swim400TimeSec", label: "400m TT", placeholder: "6:30", optional: true },
                        { key: "swim100TimeSec", label: "100m", placeholder: "1:35", optional: true },
                        { key: "swim200TimeSec", label: "200m", placeholder: "3:10", optional: true },
                        { key: "swim1500TimeSec", label: "1500m", placeholder: "22:30", optional: true },
                      ]}
                      benchmarks={benchmarks}
                      setBenchmarks={setBenchmarks}
                      errors={benchmarkErrors}
                    />
                    <BenchmarksSportBlock
                      title="Run"
                      hint="mm:ss or h:mm:ss for long distances"
                      fields={[
                        { key: "run5kTimeSec", label: "5K", placeholder: "22:30" },
                        { key: "run10kTimeSec", label: "10K", placeholder: "46:10" },
                        { key: "runThresholdSecPerKm", label: "Threshold pace", placeholder: "4:25", hint: "/km", optional: true },
                        { key: "runHmTimeSec", label: "Half marathon", placeholder: "1:45:00", optional: true },
                        { key: "runMarathonTimeSec", label: "Marathon", placeholder: "3:30:00", optional: true },
                      ]}
                      benchmarks={benchmarks}
                      setBenchmarks={setBenchmarks}
                      errors={benchmarkErrors}
                    />
                    <div>
                      <div className="mb-3 flex items-center justify-between">
                        <span className="text-sm font-medium">Bike</span>
                        <span className="text-[11px] text-muted-foreground">50–600 W</span>
                      </div>
                      <div className="grid gap-4 sm:grid-cols-2">
                        <SettingsField
                          label="Best 20min power"
                          hint="Fallback for FTP estimate (~95%)"
                          error={benchmarkErrors.bikeBest20minWatts}
                        >
                          <InputWithAdornment suffix="W">
                            <Input
                              type="number"
                              className="border-0 bg-transparent p-0 shadow-none focus-visible:ring-0"
                              value={benchmarks.bikeBest20minWatts}
                              onChange={(e) => setBenchmarks({ ...benchmarks, bikeBest20minWatts: e.target.value })}
                              placeholder="250"
                            />
                          </InputWithAdornment>
                        </SettingsField>
                        <SettingsField label="FTP (Profile)" hint="From profile">
                          <InputWithAdornment suffix="W">
                            <Input
                              type="number"
                              className="border-0 bg-transparent p-0 shadow-none focus-visible:ring-0"
                              value={profile.ftp}
                              onChange={(e) => setProfile({ ...profile, ftp: e.target.value })}
                              placeholder="FTP"
                            />
                          </InputWithAdornment>
                        </SettingsField>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2 pt-2">
                      <Button variant="outline" size="sm" onClick={clearOptionalBenchmarks}>
                        Clear optional fields
                      </Button>
                    </div>
                  </div>
                </SettingsSectionCard>
              </TabsContent>

              <TabsContent value="zones" className="mt-0 space-y-5">
                <SettingsSectionCard
                  title="Heart Rate Zones"
                  icon={Heart}
                  description="Configure your training zones. Z1–Z5."
                >
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button variant="outline" size="sm" onClick={calculateZones}>
                            <Calculator className="h-3.5 w-3.5 mr-1.5" />
                            Auto-Calculate
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Based on Max HR & Resting HR (Karvonen)</TooltipContent>
                      </Tooltip>
                    </div>
                    {zoneErrors && (
                      <p className="text-xs text-destructive rounded-lg bg-destructive/10 px-3 py-2">{zoneErrors}</p>
                    )}
                    <div className="overflow-hidden rounded-[12px] border border-white/[0.06]">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-white/[0.06] bg-white/[0.02]">
                            <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Zone</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">From</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">To</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Tag</th>
                            <th className="w-24 px-4 py-3" />
                          </tr>
                        </thead>
                        <tbody>
                          {[1, 2, 3, 4, 5].map((z) => (
                            <tr
                              key={z}
                              className="border-b border-white/[0.04] last:border-0 transition-colors hover:bg-white/[0.02]"
                            >
                              <td className="px-4 py-2.5 font-medium">Z{z}</td>
                              <td className="px-4 py-2.5">
                                <Input
                                  type="number"
                                  className="h-9 w-20 border-white/[0.08] bg-transparent text-sm"
                                  value={zones[`zone${z}Min` as keyof typeof zones]}
                                  onChange={(e) => setZones({ ...zones, [`zone${z}Min`]: e.target.value })}
                                  placeholder="—"
                                />
                              </td>
                              <td className="px-4 py-2.5">
                                <Input
                                  type="number"
                                  className="h-9 w-20 border-white/[0.08] bg-transparent text-sm"
                                  value={zones[`zone${z}Max` as keyof typeof zones]}
                                  onChange={(e) => setZones({ ...zones, [`zone${z}Max`]: e.target.value })}
                                  placeholder="—"
                                />
                              </td>
                              <td className="px-4 py-2.5 text-muted-foreground text-xs">
                                {ZONE_TAGS[z - 1]}
                              </td>
                              <td className="px-4 py-2.5">
                                <div
                                  className="h-1.5 rounded-full bg-white/5 overflow-hidden"
                                  style={{
                                    background: `linear-gradient(90deg, hsl(var(--muted)) 0%, hsl(var(--primary)) 100%)`,
                                    opacity: 0.3,
                                  }}
                                />
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </SettingsSectionCard>
              </TabsContent>

              <TabsContent value="ai" className="mt-0 space-y-5">
                <SettingsSectionCard
                  title="Plan Rigidity"
                  icon={Brain}
                  description="When locked, changes become proposals."
                >
                  <div className="space-y-4">
                    <Select
                      value={planRigidity}
                      onValueChange={(v) => handlePlanRigidityChange(v as PlanRigiditySetting)}
                      disabled={isSavingRigidity}
                    >
                      <SelectTrigger className={INPUT_CLASS}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="LOCKED_TODAY">Now — today locked</SelectItem>
                        <SelectItem value="LOCKED_1_DAY">1 day ahead</SelectItem>
                        <SelectItem value="LOCKED_2_DAYS">2 days ahead</SelectItem>
                        <SelectItem value="LOCKED_3_DAYS">3 days ahead</SelectItem>
                        <SelectItem value="FLEXIBLE_WEEK">Flexible week</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </SettingsSectionCard>

                <SettingsSectionCard
                  title="Coaching Style"
                  icon={User}
                  description="How the AI approaches your training"
                >
                  <div className="grid gap-2 sm:grid-cols-2">
                    {[
                      {
                        id: "competitive" as const,
                        icon: Target,
                        label: "Competitive",
                        desc: "Push for performance. Smart intensity.",
                      },
                      {
                        id: "longevity" as const,
                        icon: Heart,
                        label: "Longevity",
                        desc: "Sustainable fitness for life.",
                      },
                      {
                        id: "comeback" as const,
                        icon: User,
                        label: "Comeback",
                        desc: "Returning from break. Conservative.",
                      },
                      {
                        id: "busy_pro" as const,
                        icon: Briefcase,
                        label: "Busy Pro",
                        desc: "Maximum results, minimum time.",
                      },
                    ].map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => !isSavingIdentity && handleIdentityModeChange(m.id)}
                        disabled={isSavingIdentity}
                        className={cn(
                          "flex items-start gap-3 rounded-[12px] border p-3 text-left transition-all",
                          identityMode === m.id
                            ? "border-primary/50 bg-primary/5"
                            : "border-white/[0.06] hover:border-white/10 hover:bg-white/[0.02]"
                        )}
                      >
                        <m.icon
                          className={cn(
                            "h-4 w-4 shrink-0 mt-0.5",
                            identityMode === m.id ? "text-primary" : "text-muted-foreground"
                          )}
                        />
                        <div>
                          <p className="font-medium text-sm">{m.label}</p>
                          <p className="text-xs text-muted-foreground">{m.desc}</p>
                        </div>
                        {identityMode === m.id && (
                          <div className="ml-auto h-2 w-2 rounded-full bg-primary" />
                        )}
                      </button>
                    ))}
                  </div>
                </SettingsSectionCard>

                <SettingsSectionCard
                  title="Explainability Level"
                  icon={Brain}
                  description="How much detail in AI explanations"
                >
                  <div className="space-y-4">
                    <Select
                      value={explainLevel}
                      onValueChange={(v) => handleExplainLevelChange(v as "minimal" | "standard" | "deep")}
                      disabled={isSavingExplain}
                    >
                      <SelectTrigger className={INPUT_CLASS}><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="minimal">Minimal</SelectItem>
                        <SelectItem value="standard">Standard</SelectItem>
                        <SelectItem value="deep">Deep</SelectItem>
                      </SelectContent>
                    </Select>
                    <div className="rounded-[12px] border border-white/[0.06] bg-white/[0.02] p-4">
                      <p className="text-[11px] text-muted-foreground mb-2">Preview</p>
                      {explainLevel === "minimal" && (
                        <p className="text-sm text-muted-foreground">Readiness: optimal · Easy day</p>
                      )}
                      {explainLevel === "standard" && (
                        <p className="text-sm text-muted-foreground">
                          Readiness: 72/100 — Good sleep. Easy effort to balance yesterday&apos;s intervals.
                        </p>
                      )}
                      {explainLevel === "deep" && (
                        <p className="text-sm text-muted-foreground">
                          Readiness: 72/100 (85% conf). Factors: Good sleep +8, stress +5. Workout: Easy to balance load; weekly ramp +12%.
                        </p>
                      )}
                    </div>
                    <div className="flex items-start gap-2 text-xs text-muted-foreground">
                      <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                      <p>AI can use: HR zones, benchmarks, diary privacy level, check-ins, feedback.</p>
                    </div>
                  </div>
                </SettingsSectionCard>

                <SettingsSectionCard
                  title="AI Coach"
                  icon={Bot}
                  description="Workout generation and calendar"
                >
                  <div className="space-y-4">
                    <SettingsField label="Workout detail level" hint="Coach always generates full sessions; this affects how much extra explanation is included">
                      <Select
                        value={coachDetailLevel}
                        onValueChange={async (v) => {
                          const val = v as CoachCalendarSettings["detailLevel"];
                          setCoachDetailLevel(val);
                          const r = await updateCoachCalendarSettings({ detailLevel: val });
                          if (r.success) toast.success("Saved");
                          else toast.error(r.error);
                        }}
                      >
                        <SelectTrigger className={INPUT_CLASS}><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="minimal">Minimal</SelectItem>
                          <SelectItem value="detailed">Detailed (default)</SelectItem>
                        </SelectContent>
                      </Select>
                    </SettingsField>
                    <SettingsField label="Auto-add to calendar" hint="When the coach prescribes a workout, add it automatically">
                      <Select
                        value={coachAutoAddToCalendar}
                        onValueChange={async (v) => {
                          const val = v as CoachCalendarSettings["autoAddToCalendar"];
                          setCoachAutoAddToCalendar(val);
                          const r = await updateCoachCalendarSettings({ autoAddToCalendar: val });
                          if (r.success) toast.success("Saved");
                          else toast.error(r.error);
                        }}
                      >
                        <SelectTrigger className={INPUT_CLASS}><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="off">Off</SelectItem>
                          <SelectItem value="draft">Draft (default)</SelectItem>
                          <SelectItem value="final">Final</SelectItem>
                        </SelectContent>
                      </Select>
                    </SettingsField>
                    <p className="text-[11px] text-muted-foreground">
                      Draft: workouts appear on the calendar as drafts; you can Finalize or Undo. Final: add as confirmed.
                    </p>
                  </div>
                </SettingsSectionCard>

                <SettingsSectionCard
                  title="Notifications"
                  icon={Bell}
                  description="Daily reminders and alerts"
                >
                  <div className="space-y-4">
                    <label className="flex items-center justify-between gap-4">
                      <span className="text-sm font-medium">Daily reminders</span>
                      <input
                        type="checkbox"
                        checked={preferences.enableDailyReminders !== false}
                        onChange={(e) =>
                          setPreferences({ ...preferences, enableDailyReminders: e.target.checked })
                        }
                        className="rounded border-white/20"
                      />
                    </label>
                    <p className="text-[11px] text-muted-foreground">Remind to check in before planned workouts.</p>
                    <label className="flex items-center justify-between gap-4">
                      <span className="text-sm font-medium">Low readiness alerts</span>
                      <input
                        type="checkbox"
                        checked={preferences.enableLowReadinessAlerts !== false}
                        onChange={(e) =>
                          setPreferences({ ...preferences, enableLowReadinessAlerts: e.target.checked })
                        }
                        className="rounded border-white/20"
                      />
                    </label>
                    <p className="text-[11px] text-muted-foreground">Alert when hard session + low readiness.</p>
                    <label className="flex items-center justify-between gap-4">
                      <span className="text-sm font-medium">Missed log reminder</span>
                      <input
                        type="checkbox"
                        checked={preferences.enableMissedLogReminder !== false}
                        onChange={(e) =>
                          setPreferences({ ...preferences, enableMissedLogReminder: e.target.checked })
                        }
                        className="rounded border-white/20"
                      />
                    </label>
                    <p className="text-[11px] text-muted-foreground">Remind to add post-workout feedback.</p>
                    <label className="flex items-center justify-between gap-4">
                      <span className="text-sm font-medium">Weekly digest</span>
                      <input
                        type="checkbox"
                        checked={preferences.enableWeeklyDigest !== false}
                        onChange={(e) =>
                          setPreferences({ ...preferences, enableWeeklyDigest: e.target.checked })
                        }
                        className="rounded border-white/20"
                      />
                    </label>
                    <p className="text-[11px] text-muted-foreground">Receive weekly training summary (in-app + optional email).</p>
                  </div>
                </SettingsSectionCard>
              </TabsContent>

              <TabsContent value="billing" className="mt-0 space-y-5">
                <SettingsSectionCard
                  title="Billing & plan"
                  icon={CreditCard}
                  description="Manage your subscription"
                >
                  <div className="space-y-4">
                    <div className="rounded-[12px] border border-white/[0.06] bg-white/[0.02] p-4">
                      {syncingBilling && (
                        <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
                          <Loader2 className="h-3 w-3 animate-spin" /> Syncing subscription…
                        </p>
                      )}
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs text-muted-foreground">Current plan</p>
                          <p className="font-medium">{planInfo?.name ?? "—"}</p>
                          <p className="text-[11px] text-muted-foreground capitalize">
                            {planInfo?.name === "Pro"
                              ? planInfo?.cancelAtPeriodEnd
                                ? "Active · Cancels at period end"
                                : "Active"
                              : planInfo?.name === "Trial"
                                ? `Trial · ${planInfo?.trialDaysRemaining ?? "—"} days left`
                                : planInfo?.status ?? "—"}
                          </p>
                        </div>
                      </div>
                      <ul className="mt-3 space-y-1 text-xs text-muted-foreground">
                        <li>• AI Coach & plan generation</li>
                        <li>• Adaptive suggestions & proposals</li>
                        <li>• Progress analytics & trends</li>
                      </ul>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="mb-2 w-full rounded-[10px]"
                      disabled={syncingBilling}
                      onClick={async () => {
                        setSyncingBilling(true);
                        try {
                          const res = await fetch("/api/billing/status?refresh=1");
                          if (res.ok) {
                            const data = await res.json();
                            if (data?.canUsePro ?? data?.isPro) toast.success("Status refreshed. You have Pro access.");
                          }
                          const profileRes = await fetch("/api/profile");
                          const profileData = await profileRes.json();
                          if (profileData?.plan) setPlanInfo(profileData.plan);
                        } finally {
                          setSyncingBilling(false);
                        }
                      }}
                    >
                      {syncingBilling ? <Loader2 className="h-4 w-4 animate-spin" /> : "Refresh status"}
                    </Button>
                    {planInfo?.name === "Pro" ? (
                      <>
                        <Button
                          onClick={openBillingPortal}
                          disabled={isOpeningPortal}
                          className="w-full rounded-[12px]"
                        >
                          {isOpeningPortal ? <Loader2 className="h-4 w-4 animate-spin" /> : "Manage subscription"}
                        </Button>
                        <p className="text-[11px] text-muted-foreground mt-1.5">
                          Manage subscription opens the Stripe portal and returns you here when done.
                        </p>
                      </>
                    ) : (
                      <>
                        <div className="flex rounded-[10px] border border-white/[0.08] p-0.5 bg-white/[0.02]">
                          <button
                            type="button"
                            onClick={() => setCheckoutPlan("month")}
                            className={cn(
                              "flex-1 rounded-md py-2 text-sm font-medium transition-colors",
                              checkoutPlan === "month" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                            )}
                          >
                            Monthly
                          </button>
                          <button
                            type="button"
                            onClick={() => setCheckoutPlan("year")}
                            className={cn(
                              "flex-1 rounded-md py-2 text-sm font-medium transition-colors",
                              checkoutPlan === "year" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                            )}
                          >
                            Yearly
                          </button>
                        </div>
                        <Button
                          onClick={openCheckout}
                          disabled={isStartingCheckout}
                          className="w-full rounded-[12px]"
                        >
                          {isStartingCheckout ? <Loader2 className="h-4 w-4 animate-spin" /> : "Upgrade to Pro"}
                        </Button>
                      </>
                    )}
                  </div>
                </SettingsSectionCard>

                {isAdmin && (
                  <SettingsSectionCard
                    title="Billing Tools (Admin)"
                    icon={Shield}
                    description="Resync subscription from Stripe. Use when webhook missed or status is stale."
                  >
                    <div className="space-y-4">
                      <Button
                        variant="outline"
                        className="w-full rounded-[12px]"
                        disabled={adminResyncLoading}
                        onClick={async () => {
                          setAdminResyncLoading(true);
                          try {
                            const r = await resyncBillingAdmin();
                            if (r.ok) {
                              toast.success(
                                `Resynced. Plan: ${r.plan}${r.subscriptionStatus ? ` · Status: ${r.subscriptionStatus}` : ""}${r.currentPeriodEnd ? ` · Period end: ${new Date(r.currentPeriodEnd).toLocaleDateString()}` : ""}`
                              );
                              router.refresh();
                            } else {
                              toast.error(r.error ?? "Resync failed");
                            }
                          } catch (e) {
                            toast.error(e instanceof Error ? e.message : "Resync failed");
                          } finally {
                            setAdminResyncLoading(false);
                          }
                        }}
                      >
                        {adminResyncLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Resync my subscription"}
                      </Button>
                      <div className="flex gap-2">
                        <Input
                          className={INPUT_CLASS}
                          placeholder="User ID (optional)"
                          value={adminResyncUserId}
                          onChange={(e) => setAdminResyncUserId(e.target.value)}
                        />
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={adminResyncLoading || !adminResyncUserId.trim()}
                          onClick={async () => {
                            const uid = adminResyncUserId.trim();
                            if (!uid) return;
                            setAdminResyncLoading(true);
                            try {
                              const r = await resyncBillingAdmin(uid);
                              if (r.ok) {
                                toast.success(
                                  `Resynced user ${uid}. Plan: ${r.plan}${r.subscriptionStatus ? ` · ${r.subscriptionStatus}` : ""}`
                                );
                                router.refresh();
                              } else {
                                toast.error(r.error ?? "Resync failed");
                              }
                            } catch (e) {
                              toast.error(e instanceof Error ? e.message : "Resync failed");
                            } finally {
                              setAdminResyncLoading(false);
                            }
                          }}
                        >
                          Resync user
                        </Button>
                      </div>
                      <div className="pt-2 border-t border-white/[0.06]">
                        <p className="text-xs text-muted-foreground mb-2">Entitlement override (no Stripe change)</p>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={adminForceProLoading}
                          onClick={async () => {
                            setAdminForceProLoading(true);
                            try {
                              const r = await forceProFor24h(adminResyncUserId.trim() || undefined);
                              if (r.ok) {
                                toast.success(`Force PRO 24h set for ${r.userId}. Expires ${new Date(r.expiresAt).toLocaleString()}`);
                                router.refresh();
                              } else {
                                toast.error(r.error ?? "Failed");
                              }
                            } catch (e) {
                              toast.error(e instanceof Error ? e.message : "Failed");
                            } finally {
                              setAdminForceProLoading(false);
                            }
                          }}
                        >
                          {adminForceProLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Force PRO for 24h"}
                        </Button>
                        <span className="text-[11px] text-muted-foreground ml-2">(current user if ID empty)</span>
                      </div>
                    </div>
                  </SettingsSectionCard>
                )}
              </TabsContent>
            </div>

            <SettingsAiSummaryPanel
              profile={{
                sportPrimary: profile.sportPrimary,
                experienceLevel: profile.experienceLevel,
                weeklyHoursGoal: profile.weeklyHoursGoal,
              }}
              zonesSummary={zonesSummary}
              hasBenchmarks={hasBenchmarks}
            />
          </div>
        </Tabs>
      </div>

      <Dialog open={showUnsavedDialog} onOpenChange={setShowUnsavedDialog}>
        <DialogContent className="rounded-[16px] border-white/[0.08]">
          <DialogHeader>
            <DialogTitle>{t("unsavedChanges")}</DialogTitle>
            <DialogDescription>{t("unsavedChangesDesc")}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => confirmTabChange(false)}>
              {tCommon("stay")}
            </Button>
            <Button variant="destructive" onClick={() => confirmTabChange(true)}>
              {tCommon("discard")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </TooltipProvider>
  );
}

function BenchmarksSportBlock({
  title,
  hint,
  fields,
  benchmarks,
  setBenchmarks,
  errors,
}: {
  title: string;
  hint: string;
  fields: Array<{
    key: keyof typeof INITIAL_BENCHMARKS;
    label: string;
    placeholder: string;
    hint?: string;
    optional?: boolean;
  }>;
  benchmarks: typeof INITIAL_BENCHMARKS;
  setBenchmarks: React.Dispatch<React.SetStateAction<typeof INITIAL_BENCHMARKS>>;
  errors: Record<string, string>;
}) {
  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <span className="text-sm font-medium">{title}</span>
        <span className="text-[11px] text-muted-foreground">{hint}</span>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {fields.map((f) => (
          <SettingsField
            key={f.key}
            label={f.label + (f.optional ? " (optional)" : "")}
            hint={f.hint}
            error={errors[f.key]}
          >
            <Input
              className={INPUT_CLASS}
              value={benchmarks[f.key]}
              onChange={(e) => setBenchmarks({ ...benchmarks, [f.key]: e.target.value })}
              placeholder={f.placeholder}
              inputMode="numeric"
            />
          </SettingsField>
        ))}
      </div>
    </div>
  );
}
