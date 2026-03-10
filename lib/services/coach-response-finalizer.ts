import { applyConfidenceGuardrail } from "@/lib/services/ai-coach-behavior.service";
import { sanitizeCoachText } from "@/lib/coach/workout-parser";

const LOW_CONFIDENCE_PATTERNS = [/\bnot (entirely )?sure\b/i, /\blow confidence\b/i];
const UNCERTAINTY_PATTERNS = [/\bnot (entirely )?sure\b/i, /\bmy confidence\b/i, /\blow confidence\b/i];

export function inferCoachConfidenceFromText(text: string): number {
  return LOW_CONFIDENCE_PATTERNS.some((pattern) => pattern.test(text)) ? 60 : 80;
}

export function textAlreadyAdmitsUncertainty(text: string): boolean {
  return UNCERTAINTY_PATTERNS.some((pattern) => pattern.test(text));
}

export function finalizeCoachResponseText(params: {
  text: string;
  confidence: number;
  sanitize?: boolean;
}): string {
  const sanitized = params.sanitize === false ? params.text : sanitizeCoachText(params.text);
  const guarded = applyConfidenceGuardrail(sanitized, params.confidence);
  if (params.confidence < 70 && !textAlreadyAdmitsUncertainty(guarded)) {
    return `${guarded}\n\nI'm not entirely sure - my confidence is around ${params.confidence}%.`;
  }
  return guarded;
}
