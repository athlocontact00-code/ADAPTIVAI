"use server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getEntitlements } from "@/lib/billing/entitlements";
import { buildAIContextForUser } from "@/lib/services/ai-context.builder";
import {
  buildCoachSystemPrompt,
  buildCoachUserPrompt,
  getCoachToneFromPreference,
} from "@/lib/services/coach-llm-prompts";
import {
  applyConfidenceGuardrail,
  ensureBecauseReasoning,
  type ToneMode,
  type PlanRigidity,
} from "@/lib/services/ai-coach-behavior.service";
import {
  generateTrainingPlan,
  buildWorkoutDescriptionMd,
  buildWorkoutPrescriptionJson,
  type BuiltAIContext,
} from "@/lib/actions/coach";
import { isWorkoutLocked, type PlanRigiditySetting } from "@/lib/services/plan-rigidity.service";
import { createPlanChangeProposal, type ProposalPatch } from "@/lib/actions/plan-rigidity";
import { parseCalendarInsertFromResponse } from "@/lib/schemas/coach-calendar-insert";
import {
  getCoachCalendarSettings,
  insertDraftWorkoutsFromCalendarJson,
} from "@/lib/actions/coach-draft";
import { generateAndSaveWorkout } from "@/lib/services/coach-brain";
import { getAIMemoryContextForPrompt } from "@/lib/services/ai-memory.service";
import { logError } from "@/lib/logger";

export type CoachContextOverrides = {
  useCheckInData?: boolean;
  useDiaryNotes?: boolean;
  useSeasonGoals?: boolean;
  timeBudgetHours?: number;
};

export type SendCoachMessageInput = {
  input: string;
  history?: Array<{ role: "user" | "assistant"; content: string }>;
  contextOverrides?: CoachContextOverrides;
};

export type SendCoachMessageResult =
  | {
      ok: true;
      text: string;
      meta: {
        usedLLM: boolean;
        confidence: number;
        tone: ToneMode;
        isPro: boolean;
        limit: { daily: number; remaining: number };
        /** When coach auto-added workouts as draft, IDs for Undo. */
        createdWorkoutIds?: string[];
      };
    }
  | {
      ok: false;
      error: string;
      code: "UNAUTHORIZED" | "RATE_LIMIT" | "INVALID_INPUT" | "LLM_ERROR" | "PAYWALL";
      meta?: {
        isPro?: boolean;
        limit?: { daily: number; remaining: number };
      };
    };

function isAddWorkoutRequest(input: string): boolean {
  const s = input.toLowerCase();
  const hasVerb = /(^|\b)(dodaj|zaplanuj|wstaw|ustaw|add|schedule|plan)\b/.test(s);
  if (!hasVerb) return false;

  const hasNoun = /(\btrening\b|\bworkout\b|\bsession\b)/.test(s);
  const hasSportWord = /(\bbieg\b|\brun\b|\brower\b|\bbike\b|\bpływanie\b|\bplywanie\b|\bswim\b|\bsiłownia\b|\bsilownia\b|\bstrength\b)/.test(s);

  if (hasNoun || hasSportWord) {
    return true;
  }
  return false;
}

function normalizeWhitespace(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

function nextOccurrenceOfDow(params: { now: Date; targetDow: number; allowToday: boolean }): Date {
  const d = new Date(params.now);
  d.setHours(12, 0, 0, 0);
  const current = d.getDay();
  let delta = (params.targetDow - current + 7) % 7;
  if (delta === 0 && !params.allowToday) delta = 7;
  d.setDate(d.getDate() + delta);
  return d;
}

function parseDateFromText(input: string, now: Date): Date | null {
  const raw = input.trim();
  const lower = raw.toLowerCase();

  const iso = raw.match(/\b(\d{4}-\d{2}-\d{2})\b/)?.[1] ?? null;
  if (iso) {
    const [y, m, day] = iso.split("-").map((n) => parseInt(n, 10));
    const dt = new Date(y, m - 1, day);
    dt.setHours(12, 0, 0, 0);
    return dt;
  }

  const d = new Date(now);
  d.setHours(12, 0, 0, 0);

  if (/\b(dzisiaj|dziś|today)\b/.test(lower)) return d;
  if (/\b(jutro|tomorrow)\b/.test(lower)) {
    d.setDate(d.getDate() + 1);
    return d;
  }

  const inDays = raw.match(/\b(za|in)\s*(\d{1,2})\s*(dni|days)\b/i);
  if (inDays) {
    const n = parseInt(inDays[2], 10);
    if (Number.isFinite(n) && n >= 0 && n <= 30) {
      d.setDate(d.getDate() + n);
      return d;
    }
  }

  const hasThis = /\b(this|ten|ta)\b/.test(lower);
  const allowToday = /\b(dzisiaj|dziś|today)\b/.test(lower);

  const dow: Record<string, number> = {
    monday: 1,
    mon: 1,
    poniedzialek: 1,
    poniedziałek: 1,
    pon: 1,
    tuesday: 2,
    tue: 2,
    wtorek: 2,
    wto: 2,
    w: 2,
    wednesday: 3,
    wed: 3,
    sroda: 3,
    środa: 3,
    sr: 3,
    thursday: 4,
    thu: 4,
    czwartek: 4,
    czw: 4,
    friday: 5,
    fri: 5,
    piatek: 5,
    piątek: 5,
    pt: 5,
    saturday: 6,
    sat: 6,
    sobota: 6,
    sob: 6,
    sunday: 0,
    sun: 0,
    niedziela: 0,
    ndz: 0,
  };

  const tokens = lower
    .replace(/[,.;!?]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 12);

  for (const t of tokens) {
    const k = normalizeWhitespace(t);
    if (k in dow) {
      return nextOccurrenceOfDow({ now, targetDow: dow[k]!, allowToday: allowToday || hasThis });
    }
  }

  return null;
}

function parseSectionsFromInput(input: string): {
  warmUpText: string | null;
  mainSetText: string | null;
  coolDownText: string | null;
} {
  const lines = input
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  if (lines.length < 2) {
    return { warmUpText: null, mainSetText: null, coolDownText: null };
  }

  const joined = lines.join("\n");
  const pick = (re: RegExp): string | null => {
    const m = joined.match(re);
    if (!m?.[1]) return null;
    const v = normalizeWhitespace(m[1]);
    return v.length > 2 ? v : null;
  };

  const warmUpText =
    pick(/(?:^|\n)(?:warm-?up|warmup|rozgrzewka|rozgrzewkę)\s*[:\-]\s*([^\n]+(?:\n(?!\s*(?:main|main set|cool|cool-?down|schlodzenie|schłodzenie)\s*[:\-]).+)*)/i) ??
    null;
  const mainSetText =
    pick(/(?:^|\n)(?:main set|main|część\s*główna|czesc\s*glowna|glowna)\s*[:\-]\s*([^\n]+(?:\n(?!\s*(?:cool|cool-?down|schlodzenie|schłodzenie)\s*[:\-]).+)*)/i) ??
    null;
  const coolDownText =
    pick(/(?:^|\n)(?:cool-?down|cooldown|schlodzenie|schłodzenie)\s*[:\-]\s*([^\n]+(?:\n.+)*)/i) ?? null;

  return { warmUpText, mainSetText, coolDownText };
}

function parseExtraTargets(input: string): Array<{ label: string; value: string }> {
  const raw = input;
  const out: Array<{ label: string; value: string }> = [];

  const hr = raw.match(/\b(?:hr|t[eę]tno)\s*[:=]?\s*(\d{2,3})\s*(?:-|–|to)\s*(\d{2,3})\s*(?:bpm)?\b/i);
  if (hr) out.push({ label: "HR", value: `${hr[1]}–${hr[2]} bpm` });

  const pace = raw.match(/\b(?:pace|tempo)\s*[:=]?\s*(\d{1,2}:\d{2})\s*(?:-|–|to)\s*(\d{1,2}:\d{2})\s*\/?km\b/i);
  if (pace) out.push({ label: "Pace", value: `${pace[1]}–${pace[2]}/km` });

  const power = raw.match(/\b(?:power|moc)\s*[:=]?\s*(\d{2,4})\s*(?:-|–|to)\s*(\d{2,4})\s*w\b/i);
  if (power) out.push({ label: "Power", value: `${power[1]}–${power[2]} W` });

  const cadence = raw.match(/\b(?:cadence|kadencja)\s*[:=]?\s*(\d{2,3})\s*(?:-|–|to)\s*(\d{2,3})\b/i);
  if (cadence) out.push({ label: "Cadence", value: `${cadence[1]}–${cadence[2]} spm` });

  const dist = raw.match(/\b(\d{1,3}(?:[\.,]\d+)?)\s*(km|k|m)\b/i);
  if (dist) {
    const v = dist[1].replace(",", ".");
    const unit = dist[2].toLowerCase();
    if (unit === "k") out.push({ label: "Distance", value: `${v} km` });
    else if (unit === "km") out.push({ label: "Distance", value: `${v} km` });
    else if (unit === "m") out.push({ label: "Distance", value: `${v} m` });
  }

  return out;
}

function parseWorkoutDraft(input: string, now: Date): {
  ok: boolean;
  error?: string;
  data?: {
    date: Date;
    type: string;
    durationMin: number;
    intensity: string;
    title: string;
    tss: number;
    warmUpText?: string | null;
    mainSetText?: string | null;
    coolDownText?: string | null;
    extraTargets?: Array<{ label: string; value: string }> | null;
  };
} {
  const raw = input.trim();
  const lower = raw.toLowerCase();

  // Date
  const date = parseDateFromText(raw, now);

  if (!date) {
    return {
      ok: false,
      error: "Podaj dzień treningu (np. 2026-02-05 albo 'jutro').",
    };
  }

  // Duration
  const minMatch = raw.match(/\b(\d{2,3})\s*(min|minutes|m)\b/i);
  const hrMatch = raw.match(/\b(\d+(?:[\.,]\d+)?)\s*h\b/i);
  const durationMin = (() => {
    if (minMatch) return Math.max(10, parseInt(minMatch[1], 10));
    if (hrMatch) {
      const v = parseFloat(hrMatch[1].replace(",", "."));
      if (Number.isFinite(v)) return Math.max(10, Math.round(v * 60));
    }
    return 60;
  })();

  // Type
  const type =
    /\b(swim|plywanie|pływanie)\b/.test(lower)
      ? "swim"
      : /\b(bike|rower)\b/.test(lower)
        ? "bike"
        : /\b(strength|silownia|siłownia)\b/.test(lower)
          ? "strength"
          : /\b(rest|odpoczynek)\b/.test(lower)
            ? "rest"
            : "run";

  // Intensity
  const intensity =
    /\b(recovery|regener|very easy|z1)\b/.test(lower)
      ? "recovery"
      : /\b(easy|spokojnie|luźno|luzno|z2|endurance)\b/.test(lower)
        ? "easy"
        : /\b(tempo|moderate|steady|threshold|prog|z3)\b/.test(lower)
          ? "moderate"
          : /\b(interval|hard|mocno|vo2|max|z4|z5)\b/.test(lower)
            ? "hard"
            : "easy";

  const quotedTitle = raw.match(/"([^"]{3,80})"/)?.[1]?.trim() ?? null;
  const title = quotedTitle
    ? quotedTitle
    : type === "run"
      ? intensity === "hard"
        ? "Intervals Run"
        : intensity === "moderate"
          ? "Tempo Run"
          : intensity === "recovery"
            ? "Recovery Run"
            : "Easy Run"
      : type === "bike"
        ? intensity === "hard"
          ? "Intervals Ride"
          : intensity === "moderate"
            ? "Tempo Ride"
            : intensity === "recovery"
              ? "Recovery Spin"
              : "Endurance Ride"
        : type === "swim"
          ? "Swim Session"
          : type === "strength"
            ? "Strength Session"
            : "Rest Day";

  const tssMatch = raw.match(/\btss\s*[:=]?\s*(\d{1,3})\b/i);
  const tss = (() => {
    if (tssMatch) return Math.max(0, parseInt(tssMatch[1], 10));
    if (type === "rest") return 0;
    const factor = intensity === "hard" ? 1.3 : intensity === "moderate" ? 1.0 : intensity === "recovery" ? 0.5 : 0.8;
    return Math.max(1, Math.round(durationMin * factor));
  })();

  const sections = parseSectionsFromInput(raw);
  const extraTargets = parseExtraTargets(raw);

  const repPattern = /\b\d+\s*x\s*\d+(?:[\.,]\d+)?\s*(?:m|km|min)\b/i.test(raw);
  const hasAt = /\s@\s*\d{1,2}:\d{2}/.test(raw) || /\b@\s*(?:z\d|hr|pace|power)\b/i.test(raw);
  const mainSetHeuristic = (() => {
    if (sections.mainSetText) return sections.mainSetText;
    if (!(repPattern || hasAt)) return null;
    const cleaned = raw
      .replace(/\b\d{4}-\d{2}-\d{2}\b/g, "")
      .replace(/\b(jutro|tomorrow|dzisiaj|dziś|today)\b/gi, "")
      .replace(/\b\d{2,3}\s*(min|minutes|m)\b/gi, "")
      .replace(/\b\d+(?:[\.,]\d+)?\s*h\b/gi, "")
      .trim();
    const candidate = normalizeWhitespace(cleaned);
    return candidate.length > 10 ? candidate : null;
  })();

  return {
    ok: true,
    data: {
      date,
      type,
      durationMin,
      intensity,
      title,
      tss,
      warmUpText: sections.warmUpText,
      mainSetText: mainSetHeuristic,
      coolDownText: sections.coolDownText,
      extraTargets: extraTargets.length > 0 ? extraTargets : null,
    },
  };
}

async function createWorkoutFromCoach(params: {
  userId: string;
  aiContext: BuiltAIContext;
  planned?: boolean;
  source?: string;
  draft: {
    date: Date;
    type: string;
    durationMin: number;
    intensity: string;
    title: string;
    tss: number;
    warmUpText?: string | null;
    mainSetText?: string | null;
    coolDownText?: string | null;
    extraTargets?: Array<{ label: string; value: string }> | null;
  };
}): Promise<{ id: string; date: Date; title: string; descriptionMd: string }> {
  const aiReason = "Requested by athlete via AI Coach";

  const workoutForTemplate = {
    title: params.draft.title,
    type: params.draft.type,
    durationMin: params.draft.durationMin,
    intensity: params.draft.intensity,
    aiReason,
    warmUpText: params.draft.warmUpText ?? null,
    mainSetText: params.draft.mainSetText ?? null,
    coolDownText: params.draft.coolDownText ?? null,
    extraTargets: params.draft.extraTargets ?? null,
  };

  const descriptionMd = await buildWorkoutDescriptionMd({ workout: workoutForTemplate, aiContext: params.aiContext });
  const prescriptionJson = await buildWorkoutPrescriptionJson({ workout: workoutForTemplate, aiContext: params.aiContext });

  const created = await db.workout.create({
    data: {
      userId: params.userId,
      title: params.draft.title,
      type: params.draft.type,
      date: params.draft.date,
      durationMin: params.draft.durationMin,
      tss: params.draft.tss,
      planned: params.planned ?? true,
      completed: false,
      aiGenerated: true,
      aiReason,
      aiConfidence: 80,
      descriptionMd,
      prescriptionJson,
      source: params.source ?? "coach",
    },
    select: {
      id: true,
    },
  });

  await db.auditLog.create({
    data: {
      userId: params.userId,
      actorUserId: params.userId,
      actionType: "COACH_WORKOUT_CREATED",
      targetType: "WORKOUT",
      targetId: created.id,
      summary: "Created workout from AI Coach",
      detailsJson: JSON.stringify({ workoutId: created.id, date: params.draft.date, title: params.draft.title }),
    },
  });

  return { id: created.id, date: params.draft.date, title: params.draft.title, descriptionMd };
}

function startOfLocalDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function endExclusiveOfLocalDay(d: Date): Date {
  const x = startOfLocalDay(d);
  x.setDate(x.getDate() + 1);
  return x;
}

function parsePlanRigidity(value: string | null): PlanRigidity {
  if (
    value === "LOCKED_TODAY" ||
    value === "LOCKED_1_DAY" ||
    value === "LOCKED_2_DAYS" ||
    value === "LOCKED_3_DAYS" ||
    value === "FLEXIBLE_WEEK"
  ) {
    return value;
  }
  return "LOCKED_1_DAY";
}

function deterministicFallback(params: {
  tone: ToneMode;
  context: Awaited<ReturnType<typeof buildAIContextForUser>>;
  input: string;
}): { text: string; confidence: number } {
  const raw = params.input.trim();
  const lower = raw.toLowerCase();

  const isGreeting =
    /^\s*(hi|hello|hey|yo|cześć|czesc|hej|siema|elo)\b/.test(lower) ||
    /^\s*(how are you|jak tam|co tam)\b/.test(lower);
  if (isGreeting) {
    const msg =
      params.tone === "DIRECT"
        ? "Hi. Tell me what you're working on today (goal, available time, and how you feel)."
        : params.tone === "COACH"
          ? "Hey. Quick check: how did you sleep, and how do your legs feel right now (fresh / heavy / sore)? Then tell me your goal for today."
          : "Hey! How are you feeling today? Tell me how you slept and how your legs feel (fresh / heavy / sore), and what you want to accomplish.";

    return { text: msg, confidence: 85 };
  }

  const today = params.context.planSummary.today;
  const key = params.context.planSummary.keySessionsNext7d[0];
  const latestReadiness = params.context.recentSignals.checkIns7d.items.at(-1)?.readinessScore ?? null;

  const base = (() => {
    if (typeof latestReadiness === "number" && latestReadiness < 40) {
      return {
        decision: "take a recovery day or do easy movement",
        because: `your readiness has been low recently (latest readiness ${latestReadiness}/100), and pushing hard now increases injury/burnout risk`,
        confidence: 75,
      };
    }

    if (key) {
      return {
        decision: `focus on your next key session (${key.title}) on ${key.date}, and keep other days easy`,
        because: `key sessions drive fitness, and keeping easy days easy improves consistency and recovery`,
        confidence: 80,
      };
    }

    return {
      decision: "keep today simple: an easy session or rest depending on how you feel",
      because: `I don't have a specific key session scheduled next 7 days from the current context (today is ${today})`,
      confidence: 65,
    };
  })();

  let msg = `${base.decision}.`;
  msg = ensureBecauseReasoning(msg, base.because);
  msg = applyConfidenceGuardrail(msg, base.confidence);

  if (base.confidence < 70) {
    msg = `${msg} I'm not entirely sure — my confidence is around ${base.confidence}%.`;
  }

  msg = `${msg}\n\nNext step: tell me how you slept and how your legs feel right now (fresh / heavy / sore).`;

  return { text: msg, confidence: base.confidence };
}

function isSevenDayPlanRequest(input: string): boolean {
  const s = input.toLowerCase();
  if (/(^|\b)(generate|create|make|build)(\b|\s).*\b(7|seven)\b.*\b(day|days)\b.*\b(plan)\b/.test(s)) {
    return true;
  }
  if (/\b7\s*day\s*training\s*plan\b/.test(s)) return true;
  if (/\bweekly\s*plan\b/.test(s) && /\b7\b/.test(s)) return true;
  return false;
}

function isTodayWorkoutsRequest(input: string): boolean {
  const s = input.toLowerCase().trim();
  if (/(^|\b)(today|todays|to-day)\b/.test(s) && /\b(workout|workouts|training|session|sessions)\b/.test(s)) {
    return true;
  }
  if (/\b(trening|treningi)\b/.test(s) && /\b(dzisiaj|na\s+dzisiaj|dzis)\b/.test(s)) {
    return true;
  }
  if (/\bco\s+mam\s+dzisiaj\b/.test(s)) return true;
  if (/\bplan\b/.test(s) && /\b(dzisiaj|today)\b/.test(s)) return true;
  return false;
}

function formatWorkoutLine(w: {
  title: string;
  type: string;
  durationMin: number | null;
  planned: boolean;
  completed: boolean;
}): string {
  const dur = typeof w.durationMin === "number" && w.durationMin > 0 ? `${w.durationMin} min` : "—";
  const status = w.completed ? "completed" : w.planned ? "planned" : "";
  const suffix = status ? ` _(${status})_` : "";
  return `- **${w.title}** (${w.type}, ${dur})${suffix}`;
}

async function countCoachMessagesToday(userId: string): Promise<number> {
  const now = new Date();
  const start = startOfLocalDay(now);
  const end = endExclusiveOfLocalDay(now);

  return db.auditLog.count({
    where: {
      userId,
      actionType: "AI_COACH_MESSAGE",
      createdAt: { gte: start, lt: end },
    },
  });
}

async function logCoachMessageUsage(params: {
  userId: string;
  usedLLM: boolean;
  confidence: number;
}): Promise<void> {
  await db.auditLog.create({
    data: {
      userId: params.userId,
      actorUserId: params.userId,
      actionType: "AI_COACH_MESSAGE",
      targetType: "COACH",
      targetId: null,
      summary: params.usedLLM ? "Coach message (LLM)" : "Coach message (fallback)",
      detailsJson: JSON.stringify({ usedLLM: params.usedLLM, confidence: params.confidence }),
    },
  });
}

async function callOpenAIChat(params: {
  system: string;
  user: string;
  history?: Array<{ role: "user" | "assistant"; content: string }>;
}): Promise<string> {
  const key = process.env.OPENAI_API_KEY;
  if (!key || key.length < 10) {
    throw new Error("OpenAI not configured");
  }

  const history = (params.history ?? [])
    .filter(
      (m): m is { role: "user" | "assistant"; content: string } =>
        m != null &&
        (m.role === "user" || m.role === "assistant") &&
        typeof m.content === "string" &&
        m.content.trim().length > 0
    )
    .slice(-14)
    .map((m) => ({ ...m, content: m.content.slice(0, 1200) }));

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model: "gpt-4.1",
      messages: [
        { role: "system", content: params.system },
        ...history.map((m) => ({ role: m.role, content: m.content })),
        { role: "user", content: params.user },
      ],
      temperature: 0.4,
      max_tokens: 450,
    }),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`OpenAI error: ${response.status} ${text}`);
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };

  const content = data.choices?.[0]?.message?.content;
  if (!content || typeof content !== "string") {
    throw new Error("OpenAI returned empty response");
  }

  return content.trim();
}

function stripMedicalDiagnosisLanguage(text: string): string {
  const patterns: RegExp[] = [
    /\byou (have|might have|likely have)\b/gi,
    /\bdiagnos(e|is|ing)\b/gi,
    /\bmedical diagnosis\b/gi,
    /\bclinically\b/gi,
  ];

  let out = text;
  for (const re of patterns) out = out.replace(re, "");
  return out;
}

function isOpenAIQuotaError(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error);
  return (
    msg.includes("insufficient_quota") ||
    msg.includes("You exceeded your current quota") ||
    msg.includes("OpenAI error: 429")
  );
}

export async function sendCoachMessage(input: SendCoachMessageInput): Promise<SendCoachMessageResult> {
  const session = await auth();
  if (!session?.user?.id) {
    return { ok: false, code: "UNAUTHORIZED", error: "Unauthorized" };
  }

  const userId = session.user.id;
  const raw = input?.input ?? "";
  const message = raw.trim();
  if (message.length < 1 || message.length > 2000) {
    return { ok: false, code: "INVALID_INPUT", error: "Invalid input" };
  }

  const ent = await getEntitlements(userId);
  if (!ent.canUseAICoach) {
    return {
      ok: false,
      code: "PAYWALL",
      error: "Trial ended. Upgrade to Pro to use AI Coach.",
    };
  }
  const dailyLimit = ent.isPro ? 100 : 15;
  const usedToday = await countCoachMessagesToday(userId);
  const remaining = Math.max(0, dailyLimit - usedToday);

  if (remaining <= 0) {
    return {
      ok: false,
      code: "RATE_LIMIT",
      error: ent.isPro
        ? "Daily limit reached. Please try again tomorrow."
        : "Daily free message limit reached. Upgrade to Pro for higher limits.",
      meta: { isPro: ent.isPro, limit: { daily: dailyLimit, remaining } },
    };
  }

  const context = await buildAIContextForUser(userId);
  const tone = getCoachToneFromPreference(context.userProfile.tonePreference) as ToneMode;
  const planRigidity = parsePlanRigidity(context.userProfile.planRigidity);
  const coachSettings = await getCoachCalendarSettings();

  // Unified coach brain: single-workout request → generate + adapt + save idempotently
  const brainResult = await generateAndSaveWorkout(userId, message, {
    addToCalendar: coachSettings?.autoAddToCalendar !== "off",
    explainLevel: (context.userProfile.explainLevel as "minimal" | "standard" | "deep") ?? "standard",
    source: coachSettings?.autoAddToCalendar === "draft" ? "AI_DRAFT" : "AI",
  });
  if (brainResult.success && brainResult.markdown) {
    const usedLLM = false;
    const confidence = 90;
    let text = brainResult.markdown;
    if (brainResult.warnings?.length) {
      text += "\n\n⚠️ " + brainResult.warnings.join(" ");
    }
    if (brainResult.workoutId != null) {
      text = `✅ Added to calendar${brainResult.title ? `: **${brainResult.title}**` : ""}\n\n${text}`;
    }
    await logCoachMessageUsage({ userId, usedLLM, confidence });
    return {
      ok: true,
      text,
      meta: {
        usedLLM,
        confidence,
        tone,
        isPro: ent.isPro,
        limit: { daily: dailyLimit, remaining: remaining - 1 },
        ...(brainResult.createdWorkoutIds?.length ? { createdWorkoutIds: brainResult.createdWorkoutIds } : {}),
      },
    };
  }

  if (isAddWorkoutRequest(message)) {
    const now = new Date();
    const parsed = parseWorkoutDraft(message, now);
    if (!parsed.ok || !parsed.data) {
      const usedLLM = false;
      const confidence = 85;
      const text = `Nie mogę jeszcze dodać treningu.

${parsed.error ?? "Podaj datę i parametry (np. 2026-02-05, 60 min, easy run)."}`;
      await logCoachMessageUsage({ userId, usedLLM, confidence });
      return {
        ok: true,
        text,
        meta: { usedLLM, confidence, tone, isPro: ent.isPro, limit: { daily: dailyLimit, remaining: remaining - 1 } },
      };
    }

    const today0 = startOfLocalDay(now);
    if (parsed.data.date < today0) {
      const usedLLM = false;
      const confidence = 90;
      const text = `Nie dodaję treningów wstecz.

Podaj dzień od dziś w górę (np. 2026-02-05 albo "jutro").`;
      await logCoachMessageUsage({ userId, usedLLM, confidence });
      return {
        ok: true,
        text,
        meta: { usedLLM, confidence, tone, isPro: ent.isPro, limit: { daily: dailyLimit, remaining: remaining - 1 } },
      };
    }

    const requestedDate = parsed.data.date;
    const rigiditySetting = planRigidity as PlanRigiditySetting;
    const isProtected = isWorkoutLocked({ workoutDate: requestedDate, now, planRigidity: rigiditySetting });

    if (isProtected) {
      const created = await createWorkoutFromCoach({
        userId,
        aiContext: context,
        planned: false,
        source: "coach_proposal",
        draft: parsed.data,
      });

      const dateLabel = requestedDate.toLocaleDateString("en-GB", { year: "numeric", month: "2-digit", day: "2-digit" });

      const patch: ProposalPatch = {
        workout: {
          id: created.id,
          update: {
            planned: true,
            completed: false,
            source: "coach",
          },
        },
      };

      const proposal = await createPlanChangeProposal({
        workoutId: created.id,
        summary: `Schedule coach workout on ${dateLabel}: ${created.title}`,
        patch,
        confidence: 85,
        sourceType: "COACH",
      });

      if (!proposal.success || !proposal.proposalId) {
        await db.workout.delete({ where: { id: created.id } });
        const usedLLM = false;
        const confidence = 80;
        const text = "Nie mogę teraz utworzyć propozycji zmiany planu. Spróbuj ponownie.";
        await logCoachMessageUsage({ userId, usedLLM, confidence });
        return {
          ok: true,
          text,
          meta: { usedLLM, confidence, tone, isPro: ent.isPro, limit: { daily: dailyLimit, remaining: remaining - 1 } },
        };
      }

      const usedLLM = false;
      const confidence = 90;
      const text = `Plan jest zablokowany na najbliższe dni, więc przygotowałem propozycję zmiany.

Otwórz Calendar → ten dzień → szczegóły treningu i zaakceptuj/odrzuć propozycję, żeby dodać go na stałe.

${created.descriptionMd}`;

      await logCoachMessageUsage({ userId, usedLLM, confidence });
      return {
        ok: true,
        text,
        meta: { usedLLM, confidence, tone, isPro: ent.isPro, limit: { daily: dailyLimit, remaining: remaining - 1 } },
      };
    }

    const created = await createWorkoutFromCoach({ userId, aiContext: context, draft: parsed.data });
    const dateLabel = created.date.toLocaleDateString("en-GB", { year: "numeric", month: "2-digit", day: "2-digit" });
    const usedLLM = false;
    const confidence = 90;

    const text = `✅ Added to Calendar (${dateLabel}): **${created.title}**

${created.descriptionMd}`;

    await logCoachMessageUsage({ userId, usedLLM, confidence });
    return {
      ok: true,
      text,
      meta: { usedLLM, confidence, tone, isPro: ent.isPro, limit: { daily: dailyLimit, remaining: remaining - 1 } },
    };
  }

  if (isTodayWorkoutsRequest(message)) {
    const today = new Date();
    const start = startOfLocalDay(today);
    const end = endExclusiveOfLocalDay(today);

    const workouts = await db.workout.findMany({
      where: {
        userId,
        date: { gte: start, lt: end },
      },
      orderBy: [{ date: "asc" }, { createdAt: "asc" }],
      select: {
        title: true,
        type: true,
        durationMin: true,
        planned: true,
        completed: true,
      },
    });

    const lines = workouts.map((w) => formatWorkoutLine(w));
    const dateLabel = start.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });

    const text =
      lines.length > 0
        ? `## Today's workouts (${dateLabel})\n\n${lines.join("\n")}\n\nNext step: tell me how you slept and how your legs feel (fresh / heavy / sore).`
        : `## Today's workouts (${dateLabel})\n\nNo workouts scheduled for today.\n\nNext step: tell me your goal for today (and how you slept + how your legs feel).`;

    const confidence = 90;
    const usedLLM = false;
    await logCoachMessageUsage({ userId, usedLLM, confidence });
    return {
      ok: true,
      text,
      meta: {
        usedLLM,
        confidence,
        tone,
        isPro: ent.isPro,
        limit: { daily: dailyLimit, remaining: remaining - 1 },
      },
    };
  }

  if (isSevenDayPlanRequest(message)) {
    try {
      const plan = await generateTrainingPlan();
      if (!plan.success || !plan.summaryMd) {
        return {
          ok: false,
          code: "LLM_ERROR",
          error: plan.error || "Failed to generate training plan",
          meta: { isPro: ent.isPro, limit: { daily: dailyLimit, remaining } },
        };
      }

      const text = `${plan.summaryMd}\n`;
      const confidence = 85;
      const usedLLM = false;

      await logCoachMessageUsage({ userId, usedLLM, confidence });

      return {
        ok: true,
        text,
        meta: {
          usedLLM,
          confidence,
          tone,
          isPro: ent.isPro,
          limit: { daily: dailyLimit, remaining: remaining - 1 },
        },
      };
    } catch (error) {
      logError("coach.plan_generation.failed", { userId }, error instanceof Error ? error : undefined);
      return {
        ok: false,
        code: "LLM_ERROR",
        error: "Failed to generate training plan",
        meta: { isPro: ent.isPro, limit: { daily: dailyLimit, remaining } },
      };
    }
  }

  const systemPrompt = buildCoachSystemPrompt({
    tone,
    planRigidity,
    coachDetailLevel: coachSettings?.detailLevel,
  });
  let userPrompt = buildCoachUserPrompt({ input: message, context });
  const overrides = input.contextOverrides;
  if (overrides) {
    const pre = `Context preferences: useCheckIn=${overrides.useCheckInData !== false}, useDiary=${overrides.useDiaryNotes === true}, useSeasonGoals=${overrides.useSeasonGoals !== false}, timeBudgetHours=${overrides.timeBudgetHours ?? "profile"}\n\n`;
    userPrompt = pre + userPrompt;
  }
  const aimemoryContext = await getAIMemoryContextForPrompt(userId);
  if (aimemoryContext && aimemoryContext.trim().length > 0) {
    userPrompt = userPrompt + "\n\n" + aimemoryContext;
  }

  let usedLLM = false;
  let text: string;
  let confidence = 70;
  let createdWorkoutIds: string[] | undefined;

  try {
    const llmText = await callOpenAIChat({
      system: systemPrompt,
      user: userPrompt,
      history: input.history,
    });
    usedLLM = true;

    text = stripMedicalDiagnosisLanguage(llmText);

    confidence = /\bnot (entirely )?sure\b/i.test(text) || /\blow confidence\b/i.test(text) ? 60 : 80;

    const becauseSeed = "the recent signals and plan summary in your context";
    text = ensureBecauseReasoning(text, becauseSeed);
    text = applyConfidenceGuardrail(text, confidence);

    const alreadyAdmitsUncertainty =
      /\bnot (entirely )?sure\b/i.test(text) ||
      /\bmy confidence\b/i.test(text) ||
      /\blow confidence\b/i.test(text);
    if (confidence < 70 && !alreadyAdmitsUncertainty) {
      text = `${text}\n\nI'm not entirely sure — my confidence is around ${confidence}%.`;
    }

    // Auto-add to calendar as draft/final when AI returns calendarInsert JSON
    const calendarPayload = parseCalendarInsertFromResponse(text);
    if (calendarPayload && calendarPayload.items.length > 0 && coachSettings?.autoAddToCalendar && coachSettings.autoAddToCalendar !== "off") {
      const insertResult = await insertDraftWorkoutsFromCalendarJson(calendarPayload, {
        forceMode: coachSettings.autoAddToCalendar,
      });
      if (insertResult.success && insertResult.createdIds.length > 0) {
        createdWorkoutIds = insertResult.createdIds;
      }
    }
  } catch (error) {
    logError("coach.openai.failed", { userId }, error instanceof Error ? error : undefined);

    if (isOpenAIQuotaError(error)) {
      const usedLLM = false;
      const confidence = 70;
      const text =
        "OpenAI API returned **insufficient quota (429)**, so I'm running in **offline coach mode** right now.\n\n" +
        "What I can still do without OpenAI:\n" +
        "- **Treningi na dzisiaj** (or: today's workouts)\n" +
        "- **Generate a 7 day training plan** (rules engine)\n\n" +
        "To unlock full ChatGPT-like conversation, enable billing / add credits on your OpenAI account (or use an API key with quota).";

      await logCoachMessageUsage({ userId, usedLLM, confidence });

      return {
        ok: true,
        text,
        meta: {
          usedLLM,
          confidence,
          tone,
          isPro: ent.isPro,
          limit: { daily: dailyLimit, remaining: remaining - 1 },
        },
      };
    }

    const fallback = deterministicFallback({ tone, context, input: message });
    usedLLM = false;
    text = fallback.text;
    confidence = fallback.confidence;

    await logCoachMessageUsage({ userId, usedLLM, confidence });

    return {
      ok: true,
      text,
      meta: {
        usedLLM,
        confidence,
        tone,
        isPro: ent.isPro,
        limit: { daily: dailyLimit, remaining: remaining - 1 },
      },
    };
  }

  await logCoachMessageUsage({ userId, usedLLM, confidence });

  return {
    ok: true,
    text,
    meta: {
      usedLLM,
      confidence,
      tone,
      isPro: ent.isPro,
      limit: { daily: dailyLimit, remaining: remaining - 1 },
      ...(createdWorkoutIds && createdWorkoutIds.length > 0 ? { createdWorkoutIds } : {}),
    },
  };
}
