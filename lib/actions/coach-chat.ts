"use server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getEntitlements } from "@/lib/billing/entitlements";
import { buildAIContextForUser } from "@/lib/services/ai-context.builder";
import {
  buildCoachUserPrompt,
  getCoachToneFromPreference,
  getEffectiveCoachSystemPrompt,
} from "@/lib/services/coach-llm-prompts";
import {
  type ToneMode,
  type PlanRigidity,
} from "@/lib/services/ai-coach-behavior.service";
import {
  generateTrainingPlan,
} from "@/lib/actions/coach";
import { isWorkoutLocked, type PlanRigiditySetting } from "@/lib/services/plan-rigidity.service";
import { createPlanChangeProposal, type ProposalPatch } from "@/lib/actions/plan-rigidity";
import { parseCalendarInsertFromResponse } from "@/lib/schemas/coach-calendar-insert";
import {
  getCoachCalendarSettings,
  insertDraftWorkoutsFromCalendarJson,
  insertWorkoutFromCoachResponse,
} from "@/lib/actions/coach-draft";
import { generateAndSaveWorkout } from "@/lib/services/coach-brain";
import { getAIMemoryContextForPrompt } from "@/lib/services/ai-memory.service";
import { logError, logWarn } from "@/lib/logger";
import { invalidateAdaptiveDayPlannerCacheForWorkoutDate } from "@/lib/services/adaptive-day-planner-cache.service";
import {
  finalizeCoachResponseText,
  inferCoachConfidenceFromText,
} from "@/lib/services/coach-response-finalizer";
import { classifyCoachRequestRoute } from "@/lib/services/coach-request-router";
import { handleManualCoachWorkout } from "@/lib/services/coach-manual-add-handler";
import {
  buildSevenDayPlanResponse,
  buildTodayWorkoutsResponse,
} from "@/lib/services/coach-lightweight-response-handlers";
import { buildDeterministicCoachFallback } from "@/lib/services/coach-deterministic-fallback";
import { parseCoachWorkoutDraft } from "@/lib/services/coach-manual-workout-parser";
import { createWorkoutFromCoach } from "@/lib/services/coach-workout-creator";
import {
  buildCoachErrorResult,
  buildCoachSuccessResult,
} from "@/lib/services/coach-response-envelope";
import {
  endExclusiveOfLocalDay,
  extractPayloadFromCoachText,
  isOpenAIQuotaError,
  isTransientLLMError,
  parseCoachPlanRigidity,
  startOfLocalDay,
  stripMedicalDiagnosisLanguage,
} from "@/lib/services/coach-chat-utils";
import {
  buildSportCorrectionPrompt,
  buildStrictJsonCorrectionPrompt,
  buildStructureCorrectionPrompt,
  buildSwimMetersCorrectionPrompt,
  buildSwimPoolLengthClarification,
  maybeRepairSwimPayloadToIntent,
  shouldBlockSwimSaveAfterRetry,
  shouldRetryCalendarPayloadAsStrictJson,
} from "@/lib/services/coach-correction-orchestrator";
import {
  validateSportCorrectness,
  validateSwimMetersCompleteness,
  validateWorkoutStructure,
  deriveExpectedSport,
} from "@/lib/utils/coach-gates";
import { resolveIntentDate } from "@/lib/utils/coach-intent";
import { extractCoachIntentFull, getCoachActionIntent, validateWorkoutMatchesIntent } from "@/lib/coach/intent";
import { sanitizeCoachText, parseWorkoutFromText, parsedWorkoutToPayload } from "@/lib/coach/workout-parser";
import type { CalendarInsertPayload } from "@/lib/schemas/coach-calendar-insert";

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

const RETRY_DELAYS_MS = [300, 1200];

/** Call OpenAI with retries (2 retries, 300ms and 1200ms) for transient errors. */
async function callOpenAIChatWithRetry(params: {
  system: string;
  user: string;
  history?: Array<{ role: "user" | "assistant"; content: string }>;
  userId?: string;
}): Promise<string> {
  const { userId, ...callParams } = params;
  let lastError: unknown;
  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
    try {
      return await callOpenAIChat(callParams);
    } catch (err) {
      lastError = err;
      if (attempt < RETRY_DELAYS_MS.length && isTransientLLMError(err)) {
        const delay = RETRY_DELAYS_MS[attempt];
        logWarn("coach.llm.retry", { userId, attempt: attempt + 1, delayMs: delay });
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }
      throw err;
    }
  }
  throw lastError;
}

export async function sendCoachMessage(input: SendCoachMessageInput): Promise<SendCoachMessageResult> {
  const session = await auth();
  if (!session?.user?.id) {
    return buildCoachErrorResult({ code: "UNAUTHORIZED", error: "Unauthorized" });
  }

  const userId = session.user.id;
  const raw = input?.input ?? "";
  const message = raw.trim();
  if (message.length < 1 || message.length > 2000) {
    return buildCoachErrorResult({ code: "INVALID_INPUT", error: "Invalid input" });
  }

  const ent = await getEntitlements(userId);
  if (!ent.canUseAICoach) {
    return buildCoachErrorResult({
      code: "PAYWALL",
      error: "Trial ended. Upgrade to Pro to use AI Coach.",
    });
  }
  const dailyLimit = ent.isPro ? 100 : 15;
  const usedToday = await countCoachMessagesToday(userId);
  const remaining = Math.max(0, dailyLimit - usedToday);

  if (remaining <= 0) {
    return buildCoachErrorResult({
      code: "RATE_LIMIT",
      error: ent.isPro
        ? "Daily limit reached. Please try again tomorrow."
        : "Daily free message limit reached. Upgrade to Pro for higher limits.",
      isPro: ent.isPro,
      dailyLimit,
      remaining,
    });
  }

  const context = await buildAIContextForUser(userId);
  const tone = getCoachToneFromPreference(context.userProfile.tonePreference) as ToneMode;
  const planRigidity = parseCoachPlanRigidity(context.userProfile.planRigidity);
  const coachSettings = await getCoachCalendarSettings();

  const coachIntent = extractCoachIntentFull(message, {
    defaultSport: (context.userProfile.sportPrimary as "SWIM" | "BIKE" | "RUN" | "STRENGTH") ?? null,
  });
  const actionIntent = getCoachActionIntent(message, coachIntent);
  const requestRoute = classifyCoachRequestRoute(message, actionIntent);

  // ADD_TO_CALENDAR only: save last draft from conversation; never call brain (no template)
  if (requestRoute.immediateRoute === "ADD_TO_CALENDAR") {
    const assistantMessages = (input.history ?? [])
      .filter((m): m is { role: "assistant"; content: string } => m.role === "assistant")
      .map((m) => m.content)
      .reverse();
    const insertResult = await insertWorkoutFromCoachResponse("", {
      assistantMessages,
      sportFilter: coachIntent.sport !== "UNKNOWN" ? coachIntent.sport : undefined,
      dateFilter: coachIntent.targetDateISO ?? undefined,
      forceMode: coachSettings?.autoAddToCalendar === "final" ? "final" : "draft",
    });
    const usedLLM = false;
    const confidence = 85;
    if (!insertResult.success) {
      const text =
        insertResult.error ??
        "Nie znalazłem treningu do zapisania. Napisz np. „trening pływacki 3000 m na jutro”, a potem „dodaj do kalendarza”.";
      await logCoachMessageUsage({ userId, usedLLM, confidence });
      return buildCoachSuccessResult({
        text,
        usedLLM,
        confidence,
        tone,
        isPro: ent.isPro,
        dailyLimit,
        remaining,
      });
    }
    await logCoachMessageUsage({ userId, usedLLM, confidence });
    return buildCoachSuccessResult({
      text: "✅ Dodano do kalendarza.",
      usedLLM,
      confidence,
      tone,
      isPro: ent.isPro,
      dailyLimit,
      remaining,
      createdWorkoutIds: insertResult.createdIds,
    });
  }

  // GENERATE / CHANGE: brain generates and saves. QUESTION_ONLY skips brain and falls through to LLM.
  if (requestRoute.preferBrain) {
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
      const showAddedToCalendar =
        brainResult.workoutId != null &&
        (coachIntent.mode === "generate_and_add" || coachIntent.mode === "add_to_calendar");
      if (showAddedToCalendar) {
        text = `✅ Added to calendar${brainResult.title ? `: **${brainResult.title}**` : ""}\n\n${text}`;
      }
      await logCoachMessageUsage({ userId, usedLLM, confidence });
      return buildCoachSuccessResult({
        text,
        usedLLM,
        confidence,
        tone,
        isPro: ent.isPro,
        dailyLimit,
        remaining,
        createdWorkoutIds: brainResult.createdWorkoutIds,
      });
    }
  }

  if (requestRoute.fallbackRoute === "MANUAL_ADD_WORKOUT") {
    const now = new Date();
    const parsed = parseCoachWorkoutDraft(message, now);
    if (!parsed.ok || !parsed.data) {
      const usedLLM = false;
      const confidence = 85;
      const text = `Nie mogę jeszcze dodać treningu.

${parsed.error ?? "Podaj datę i parametry (np. 2026-02-05, 60 min, easy run)."}`;
      await logCoachMessageUsage({ userId, usedLLM, confidence });
      return buildCoachSuccessResult({
        text,
        usedLLM,
        confidence,
        tone,
        isPro: ent.isPro,
        dailyLimit,
        remaining,
      });
    }
    const manualDraft = parsed.data;
    const manualResult = await handleManualCoachWorkout({
      draft: manualDraft,
      now,
      planRigidity: planRigidity as PlanRigiditySetting,
      isProtected: isWorkoutLocked,
      createWorkout: async (options) =>
        createWorkoutFromCoach({
          userId,
          aiContext: context,
          draft: manualDraft,
          planned: options?.planned,
          source: options?.source,
        }),
      createProposal: async (created) => {
        const dateLabel = manualDraft.date.toLocaleDateString("en-GB", {
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
        });
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
        return createPlanChangeProposal({
          workoutId: created.id,
          summary: `Schedule coach workout on ${dateLabel}: ${created.title}`,
          patch,
          confidence: 85,
          sourceType: "COACH",
        });
      },
      deleteWorkout: async (workoutId) => {
        await db.workout.delete({ where: { id: workoutId } });
      },
    });
    const usedLLM = false;
    const { confidence, text } = manualResult;

    await logCoachMessageUsage({ userId, usedLLM, confidence });
    return buildCoachSuccessResult({
      text,
      usedLLM,
      confidence,
      tone,
      isPro: ent.isPro,
      dailyLimit,
      remaining,
    });
  }

  if (requestRoute.fallbackRoute === "TODAY_WORKOUTS") {
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
    const { text, confidence } = buildTodayWorkoutsResponse({
      workouts,
      date: start,
    });
    const usedLLM = false;
    await logCoachMessageUsage({ userId, usedLLM, confidence });
    return buildCoachSuccessResult({
      text,
      usedLLM,
      confidence,
      tone,
      isPro: ent.isPro,
      dailyLimit,
      remaining,
    });
  }

  if (requestRoute.fallbackRoute === "SEVEN_DAY_PLAN") {
    try {
      const plan = await generateTrainingPlan();
      const planResponse = buildSevenDayPlanResponse(plan);
      if (!planResponse.ok) {
        return buildCoachErrorResult({
          code: "LLM_ERROR",
          error: planResponse.error,
          isPro: ent.isPro,
          dailyLimit,
          remaining,
        });
      }
      const { text, confidence } = planResponse;
      const usedLLM = false;

      await logCoachMessageUsage({ userId, usedLLM, confidence });

      return buildCoachSuccessResult({
        text,
        usedLLM,
        confidence,
        tone,
        isPro: ent.isPro,
        dailyLimit,
        remaining,
      });
    } catch (error) {
      logError("coach.plan_generation.failed", { userId }, error instanceof Error ? error : undefined);
      return buildCoachErrorResult({
        code: "LLM_ERROR",
        error: "Failed to generate training plan",
        isPro: ent.isPro,
        dailyLimit,
        remaining,
      });
    }
  }

  const systemPrompt = getEffectiveCoachSystemPrompt({
    tone,
    planRigidity,
    coachDetailLevel: coachSettings?.detailLevel,
  });
  let userPrompt = buildCoachUserPrompt({
    input: message,
    context,
    intentOverride: coachIntent,
  });
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
    const llmText = await callOpenAIChatWithRetry({
      system: systemPrompt,
      user: userPrompt,
      history: input.history,
      userId,
    });
    usedLLM = true;

    text = stripMedicalDiagnosisLanguage(llmText);

    // Quality gates: sport correctness and swim meters completeness (one retry each)
    const expectedSport = deriveExpectedSport(message, context.userProfile.sportPrimary);
    const sportCheck = validateSportCorrectness(text, expectedSport);
    if (!sportCheck.valid && expectedSport && sportCheck.detectedSport) {
      const retryUser = buildSportCorrectionPrompt(userPrompt, expectedSport, sportCheck.detectedSport);
      const retryText = await callOpenAIChat({ system: systemPrompt, user: retryUser, history: input.history });
      text = stripMedicalDiagnosisLanguage(retryText);
    }
    if (expectedSport === "SWIM" && !validateSwimMetersCompleteness(text)) {
      const retryUser = buildSwimMetersCorrectionPrompt(userPrompt);
      const retryText = await callOpenAIChat({ system: systemPrompt, user: retryUser, history: input.history });
      text = stripMedicalDiagnosisLanguage(retryText);
    }
    if (actionIntent !== "QUESTION_ONLY") {
      const structureCheck = validateWorkoutStructure(text, expectedSport);
      if (!structureCheck.valid) {
        const retryUser = buildStructureCorrectionPrompt({
          userPrompt,
          expectedSport,
          detectedSport: structureCheck.detectedSport,
          missing: structureCheck.missing,
        });
        const retryText = await callOpenAIChat({ system: systemPrompt, user: retryUser, history: input.history });
        text = stripMedicalDiagnosisLanguage(retryText);
      }
    }

    confidence = inferCoachConfidenceFromText(text);
    text = finalizeCoachResponseText({ text, confidence });

    // Auto-add to calendar: validate intent match, retry or auto-adjust if needed
    const calendarPayload = parseCalendarInsertFromResponse(text);
    if (calendarPayload && calendarPayload.items.length > 0 && coachSettings?.autoAddToCalendar && coachSettings.autoAddToCalendar !== "off") {
      let savePayload: CalendarInsertPayload = calendarPayload;
      let validation = validateWorkoutMatchesIntent(coachIntent, savePayload);
      ({ payload: savePayload, validation } = maybeRepairSwimPayloadToIntent({
        intent: coachIntent,
        payload: savePayload,
        validation,
      }));
      if (shouldRetryCalendarPayloadAsStrictJson(validation)) {
        const strictUser = buildStrictJsonCorrectionPrompt(userPrompt, coachIntent);
        const retryText = await callOpenAIChat({ system: systemPrompt, user: strictUser, history: input.history });
        const retryPayload = parseCalendarInsertFromResponse(stripMedicalDiagnosisLanguage(retryText));
        if (retryPayload && retryPayload.items.length > 0) {
          savePayload = retryPayload;
          validation = validateWorkoutMatchesIntent(coachIntent, savePayload);
          ({ payload: savePayload, validation } = maybeRepairSwimPayloadToIntent({
            intent: coachIntent,
            payload: savePayload,
            validation,
          }));
        }
      }
      // Hard guard: requested meters but payload still wrong → do not save template
      const finalValidation = validateWorkoutMatchesIntent(coachIntent, savePayload);
      if (shouldBlockSwimSaveAfterRetry(coachIntent, finalValidation)) {
        text = buildSwimPoolLengthClarification(coachIntent.swimMeters as number);
        await logCoachMessageUsage({ userId, usedLLM: true, confidence: 80 });
        return buildCoachSuccessResult({
          text,
          usedLLM: true,
          confidence: 80,
          tone,
          isPro: ent.isPro,
          dailyLimit,
          remaining,
        });
      }
      const replaceForDateSport =
        coachIntent.mode === "change" &&
        savePayload.items.every((item) => {
          const today = resolveIntentDate("today");
          const tomorrow = resolveIntentDate("tomorrow");
          return item.date === today || item.date === tomorrow;
        });
      const insertResult = await insertDraftWorkoutsFromCalendarJson(savePayload, {
        forceMode: coachSettings.autoAddToCalendar,
        replaceForDateSport,
      });
      if (insertResult.success && insertResult.createdIds.length > 0) {
        createdWorkoutIds = insertResult.createdIds;
      }
    }
  } catch (error) {
    logError("coach.openai.failed", { userId }, error instanceof Error ? error : undefined);
    try {
      const Sentry = await import("@sentry/nextjs");
      Sentry.captureException(error, { extra: { userId } });
    } catch {
      // Sentry not available or import failed
    }

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

      return buildCoachSuccessResult({
        text,
        usedLLM,
        confidence,
        tone,
        isPro: ent.isPro,
        dailyLimit,
        remaining,
      });
    }

    const fallback = buildDeterministicCoachFallback({ tone, context, input: message });
    usedLLM = false;
    text = fallback.text;
    confidence = fallback.confidence;

    await logCoachMessageUsage({ userId, usedLLM, confidence });

    return buildCoachSuccessResult({
      text,
      usedLLM,
      confidence,
      tone,
      isPro: ent.isPro,
      dailyLimit,
      remaining,
    });
  }

  await logCoachMessageUsage({ userId, usedLLM, confidence });

  return buildCoachSuccessResult({
    text,
    usedLLM,
    confidence,
    tone,
    isPro: ent.isPro,
    dailyLimit,
    remaining,
    createdWorkoutIds,
  });
}

const FALLBACK_CALENDAR_USER_MESSAGE =
  "Generate ONE complete session for today now. Your reply MUST end with a ```json code block containing this exact structure: {\"calendarInsert\":true,\"mode\":\"final\",\"items\":[{\"date\":\"YYYY-MM-DD\",\"sport\":\"RUN\",\"title\":\"...\",\"durationMin\":45,\"descriptionMd\":\"...\"}]}. Use today's date for date. Include full workout text in descriptionMd.";

const STRICT_JSON_ONLY_MESSAGE =
  "Re-export ONLY the last workout you prescribed as a single ```json code block. Output nothing else. Format: {\"calendarInsert\":true,\"mode\":\"final\",\"items\":[{\"date\":\"YYYY-MM-DD\",\"sport\":\"RUN\" or \"SWIM\" or \"BIKE\" or \"STRENGTH\",\"title\":\"...\",\"durationMin\":60,\"descriptionMd\":\"full markdown workout\"}]}. Use today's date.";

export type GenerateWorkoutAndAddToCalendarResult = {
  success: boolean;
  createdIds: string[];
  error?: string;
  generatedText?: string;
};

/**
 * Fallback when user says "add to calendar" but the last assistant message has no extractable workout.
 * Calls the coach to generate today's session; if parsing fails, retries once with strict JSON-only prompt.
 */
export async function generateWorkoutAndAddToCalendar(
  history: Array<{ role: "user" | "assistant"; content: string }>
): Promise<GenerateWorkoutAndAddToCalendarResult> {
  const result = await sendCoachMessage({
    input: FALLBACK_CALENDAR_USER_MESSAGE,
    history,
  });
  if (!result.ok) {
    return { success: false, createdIds: [], error: result.error };
  }
  let payload = extractPayloadFromCoachText(result.text);
  let generatedText = result.text;
  if (!payload || payload.items.length === 0) {
    const retryResult = await sendCoachMessage({
      input: STRICT_JSON_ONLY_MESSAGE,
      history: [...history, { role: "assistant", content: result.text }, { role: "user", content: STRICT_JSON_ONLY_MESSAGE }],
    });
    if (retryResult.ok) {
      payload = extractPayloadFromCoachText(retryResult.text);
      if (retryResult.text) generatedText = retryResult.text;
    }
  }
  if (!payload || payload.items.length === 0) {
    return {
      success: false,
      createdIds: [],
      error: "I couldn't detect a workout to save — say 'write me a swim session for 3000m' and I'll save it.",
      generatedText,
    };
  }
  const insertResult = await insertDraftWorkoutsFromCalendarJson(payload, { forceMode: "final" });
  return {
    success: insertResult.success,
    createdIds: insertResult.createdIds ?? [],
    error: insertResult.error,
    generatedText,
  };
}
