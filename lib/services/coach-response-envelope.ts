import type { ToneMode } from "@/lib/services/ai-coach-behavior.service";

type CoachSuccessResult = {
  ok: true;
  text: string;
  meta: {
    usedLLM: boolean;
    confidence: number;
    tone: ToneMode;
    isPro: boolean;
    limit: { daily: number; remaining: number };
    createdWorkoutIds?: string[];
  };
};

type CoachErrorCode = "UNAUTHORIZED" | "RATE_LIMIT" | "INVALID_INPUT" | "LLM_ERROR" | "PAYWALL";

type CoachErrorResult = {
  ok: false;
  error: string;
  code: CoachErrorCode;
  meta?: {
    isPro?: boolean;
    limit?: { daily: number; remaining: number };
  };
};

export function buildCoachSuccessResult(params: {
  text: string;
  usedLLM: boolean;
  confidence: number;
  tone: ToneMode;
  isPro: boolean;
  dailyLimit: number;
  remaining: number;
  createdWorkoutIds?: string[];
}): CoachSuccessResult {
  return {
    ok: true,
    text: params.text,
    meta: {
      usedLLM: params.usedLLM,
      confidence: params.confidence,
      tone: params.tone,
      isPro: params.isPro,
      limit: { daily: params.dailyLimit, remaining: params.remaining - 1 },
      ...(params.createdWorkoutIds && params.createdWorkoutIds.length > 0
        ? { createdWorkoutIds: params.createdWorkoutIds }
        : {}),
    },
  };
}

export function buildCoachErrorResult(params: {
  code: CoachErrorCode;
  error: string;
  isPro?: boolean;
  dailyLimit?: number;
  remaining?: number;
}): CoachErrorResult {
  return {
    ok: false,
    code: params.code,
    error: params.error,
    ...(typeof params.dailyLimit === "number" && typeof params.remaining === "number"
      ? {
          meta: {
            isPro: params.isPro,
            limit: { daily: params.dailyLimit, remaining: params.remaining },
          },
        }
      : params.isPro !== undefined
        ? { meta: { isPro: params.isPro } }
        : {}),
  };
}
