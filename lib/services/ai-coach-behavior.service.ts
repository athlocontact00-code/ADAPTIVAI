/**
 * AI Coach Behavior Service (Spec v1.0 §6, §8)
 * 
 * Translates data + memory into human coaching language.
 * Implements:
 * - Tone modes (SUPPORTIVE, DIRECT, COACH)
 * - Explanation templates with "because" reasoning
 * - Uncertainty phrasing for low confidence
 * - Quote referencing from athlete feedback
 * - Weekly/Monthly narrative summaries
 * - Guardrails against overconfidence
 */

// ============================================
// TYPES
// ============================================

export type ToneMode = "SUPPORTIVE" | "DIRECT" | "COACH";

export type PlanRigidity =
  | "LOCKED_TODAY"
  | "LOCKED_1_DAY"
  | "LOCKED_2_DAYS"
  | "LOCKED_3_DAYS"
  | "FLEXIBLE_WEEK";

export interface TodayCheckinContext {
  status?: string;
  data?: {
    readinessScore?: number;
    topFactor?: string;
    hasConflict?: boolean;
    conflictReason?: string;
  } | null;
  privacyMode?: string;
  planLocked?: boolean;
}

export interface CoachContext {
  toneMode: ToneMode;
  planRigidity: PlanRigidity;
  athleteName?: string;
  recentQuotes: string[];  // Athlete's own words from feedback
  memoryConfidence: number;  // 0-100, average confidence of AI memories
  simulatorWarnings: SimulatorWarning[];
  overrideRate: number;  // 0-100, how often athlete overrides AI
  todayCheckin?: TodayCheckinContext;
}

export interface SimulatorWarning {
  type: string;
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  message: string;
  confidence: number;
}

export interface ExplanationContext {
  decision: string;
  primaryReason: string;
  secondaryReasons: string[];
  confidence: number;
  athleteQuote?: string;
  simulatorRisk?: SimulatorWarning;
}

export interface WeeklySummaryData {
  weekStart: Date;
  weekEnd: Date;
  plannedHours: number;
  completedHours: number;
  compliancePercent: number;
  avgReadiness: number;
  avgEnjoyment: number;
  hardSessionCount: number;
  restDayCount: number;
  keyInsight: string;
  athleteQuote?: string;
  nextWeekFocus: string;
}

export interface MonthlySummaryData {
  monthStart: Date;
  monthEnd: Date;
  ctlChange: number;
  ctlStart: number;
  ctlEnd: number;
  totalHours: number;
  compliancePercent: number;
  behavioralPattern: string;
  highlight: string;
  concern?: string;
  athleteQuotes: string[];
}

// ============================================
// TONE TEMPLATES
// ============================================

const TONE_TEMPLATES = {
  SUPPORTIVE: {
    greeting: (name?: string) => name ? `Hey ${name}!` : "Hey there!",
    recommendation: "I'd suggest",
    because: "because",
    uncertainty: "I'm not entirely sure, but",
    encouragement: "You've got this!",
    restAdvice: "Your body is telling you it needs a break, and that's okay.",
    overrideAck: "I understand you want to push through",
    warning: "Just a heads up:",
    celebration: "Amazing work!",
    closing: "Take care of yourself!",
  },
  DIRECT: {
    greeting: (name?: string) => name ? `${name}.` : "",
    recommendation: "Recommendation:",
    because: "Reason:",
    uncertainty: "Low confidence:",
    encouragement: "",
    restAdvice: "Rest today. Resume tomorrow.",
    overrideAck: "Override noted.",
    warning: "Warning:",
    celebration: "Good.",
    closing: "",
  },
  COACH: {
    greeting: (name?: string) => name ? `Alright ${name},` : "Alright,",
    recommendation: "Here's what I want you to do:",
    because: "Here's why:",
    uncertainty: "I'm working with limited data here, but",
    encouragement: "Trust the process.",
    restAdvice: "I know you want to train, but your body is telling me no. Take today off.",
    overrideAck: "I see you're pushing through anyway",
    warning: "Listen up:",
    celebration: "That's what I like to see!",
    closing: "Stay focused.",
  },
};

// ============================================
// EXPLANATION GENERATION
// ============================================

/**
 * Generate an explanation with "because" reasoning
 * Always explains why, admits uncertainty, references quotes
 */
export function generateExplanation(
  context: ExplanationContext,
  coachContext: CoachContext
): string {
  const tone = TONE_TEMPLATES[coachContext.toneMode];
  const parts: string[] = [];

  // Greeting (optional for DIRECT)
  if (tone.greeting(coachContext.athleteName)) {
    parts.push(tone.greeting(coachContext.athleteName));
  }

  // Main recommendation
  parts.push(`${tone.recommendation} ${context.decision}.`);

  // "Because" reasoning (ALWAYS required)
  parts.push(`${tone.because} ${context.primaryReason}.`);

  // Secondary reasons
  if (context.secondaryReasons.length > 0) {
    const secondary = context.secondaryReasons.slice(0, 2).join(", and ");
    parts.push(`Also, ${secondary}.`);
  }

  // Quote referencing (if available)
  if (context.athleteQuote) {
    parts.push(generateQuoteReference(context.athleteQuote, coachContext.toneMode));
  }

  // Uncertainty phrasing (if confidence < 70)
  if (context.confidence < 70) {
    parts.push(generateUncertaintyPhrase(context.confidence, coachContext.toneMode));
  }

  // Simulator risk warning (if exists)
  if (context.simulatorRisk) {
    parts.push(generateSimulatorWarning(context.simulatorRisk, coachContext.toneMode));
  }

  // Encouragement (for SUPPORTIVE and COACH)
  if (tone.encouragement) {
    parts.push(tone.encouragement);
  }

  return parts.join(" ");
}

/**
 * Generate a quote reference in the athlete's own words
 */
export function generateQuoteReference(quote: string, toneMode: ToneMode): string {
  const cleanQuote = quote.replace(/^["']|["']$/g, "").trim();
  
  switch (toneMode) {
    case "SUPPORTIVE":
      return `Last time you mentioned "${cleanQuote}" — I'm keeping that in mind.`;
    case "DIRECT":
      return `Your words: "${cleanQuote}".`;
    case "COACH":
      return `Remember when you said "${cleanQuote}"? That's exactly why I'm making this call.`;
  }
}

/**
 * Generate uncertainty phrasing based on confidence level
 */
export function generateUncertaintyPhrase(confidence: number, toneMode: ToneMode): string {
  const tone = TONE_TEMPLATES[toneMode];
  
  if (confidence < 40) {
    switch (toneMode) {
      case "SUPPORTIVE":
        return `${tone.uncertainty} I don't have enough data to be certain. Let me know how this feels.`;
      case "DIRECT":
        return `${tone.uncertainty} (${confidence}% confidence). Verify with how you feel.`;
      case "COACH":
        return `${tone.uncertainty} I'm only ${confidence}% confident here. If this doesn't feel right, tell me.`;
    }
  } else if (confidence < 70) {
    switch (toneMode) {
      case "SUPPORTIVE":
        return `${tone.uncertainty} I'm about ${confidence}% confident in this suggestion.`;
      case "DIRECT":
        return `Confidence: ${confidence}%.`;
      case "COACH":
        return `${tone.uncertainty} my confidence is around ${confidence}%. We'll adjust as we learn more.`;
    }
  }
  
  return "";
}

/**
 * Generate simulator risk warning
 */
export function generateSimulatorWarning(
  warning: SimulatorWarning,
  toneMode: ToneMode
): string {
  const tone = TONE_TEMPLATES[toneMode];
  
  switch (toneMode) {
    case "SUPPORTIVE":
      return `${tone.warning} When we simulated this scenario, it showed ${warning.message}. Just something to be aware of.`;
    case "DIRECT":
      return `${tone.warning} Simulator projection: ${warning.message} (${warning.confidence}% confidence).`;
    case "COACH":
      return `${tone.warning} I ran the numbers, and ${warning.message}. Let's not ignore that.`;
  }
}

// ============================================
// PLAN RIGIDITY HANDLING
// ============================================

/**
 * Generate message respecting plan rigidity
 */
export function generateRigidityMessage(
  proposedChange: string,
  rigidity: PlanRigidity,
  toneMode: ToneMode
): string {
  switch (rigidity) {
    case "LOCKED_TODAY":
      switch (toneMode) {
        case "SUPPORTIVE":
          return `Suggestion for later: ${proposedChange}. If you want me to adjust today's session too, you can loosen your plan rigidity in Settings.`;
        case "DIRECT":
          return `Suggestion (later): ${proposedChange}.`;
        case "COACH":
          return `Suggestion for later: ${proposedChange}. If you want changes to apply immediately, loosen plan rigidity in Settings.`;
      }
      break;
    case "LOCKED_1_DAY":
    case "LOCKED_2_DAYS":
    case "LOCKED_3_DAYS":
      switch (toneMode) {
        case "SUPPORTIVE":
          return `Suggestion for later: ${proposedChange}.`;
        case "DIRECT":
          return `Suggestion (later): ${proposedChange}.`;
        case "COACH":
          return `Suggestion for later: ${proposedChange}.`;
      }
      break;
    case "FLEXIBLE_WEEK":
      switch (toneMode) {
        case "SUPPORTIVE":
          return `I'm going to ${proposedChange} since your plan is flexible this week.`;
        case "DIRECT":
          return `Applying: ${proposedChange}.`;
        case "COACH":
          return `Making a call: ${proposedChange}. Your flexible plan lets me do this.`;
      }
      break;
  }
  
  return proposedChange;
}

// ============================================
// WEEKLY SUMMARY GENERATION (Spec v1.0 §8.2)
// ============================================

/**
 * Generate narrative-first weekly summary
 * Structure: Headline → Load vs Plan → Key insight → Athlete quote → Recommendation
 */
export function generateWeeklySummary(
  data: WeeklySummaryData,
  toneMode: ToneMode
): string {
  const tone = TONE_TEMPLATES[toneMode];
  const parts: string[] = [];

  // 1. HEADLINE (narrative-first, not metrics-first)
  const headline = generateWeeklyHeadline(data, toneMode);
  parts.push(`## ${headline}\n`);

  // 2. LOAD vs PLAN (brief)
  const loadSummary = generateLoadSummary(data, toneMode);
  parts.push(loadSummary);

  // 3. KEY INSIGHT (what changed, what matters)
  parts.push(`\n**Key Insight:** ${data.keyInsight}`);

  // 4. ATHLETE'S OWN WORDS (if available)
  if (data.athleteQuote) {
    parts.push(`\n**Your words:** "${data.athleteQuote}"`);
  }

  // 5. RECOMMENDATION for next week
  parts.push(`\n**Next Week:** ${data.nextWeekFocus}`);

  // Closing
  if (tone.closing) {
    parts.push(`\n\n${tone.closing}`);
  }

  return parts.join("\n");
}

function generateWeeklyHeadline(data: WeeklySummaryData, toneMode: ToneMode): string {
  const compliance = data.compliancePercent;
  const readiness = data.avgReadiness;
  
  // Narrative headlines based on patterns, not just metrics
  if (compliance >= 90 && readiness >= 70) {
    switch (toneMode) {
      case "SUPPORTIVE": return "A Strong Week All Around! 💪";
      case "DIRECT": return "Week Complete: High Compliance, Good Readiness";
      case "COACH": return "Solid Execution This Week";
    }
  }
  
  if (compliance >= 80 && readiness < 50) {
    switch (toneMode) {
      case "SUPPORTIVE": return "You Pushed Through a Tough Week";
      case "DIRECT": return "High Compliance Despite Low Readiness";
      case "COACH": return "Gritty Week — But Watch the Fatigue";
    }
  }
  
  if (compliance < 70 && readiness >= 70) {
    switch (toneMode) {
      case "SUPPORTIVE": return "A Lighter Week — And That's Okay";
      case "DIRECT": return "Reduced Volume, Good Recovery";
      case "COACH": return "You Backed Off — Smart Move";
    }
  }
  
  if (data.hardSessionCount >= 3) {
    switch (toneMode) {
      case "SUPPORTIVE": return "An Intense Week of Training";
      case "DIRECT": return "High Intensity Week";
      case "COACH": return "You Put in the Hard Work";
    }
  }
  
  // Default
  switch (toneMode) {
    case "SUPPORTIVE": return "Another Week in the Books";
    case "DIRECT": return `Week Summary: ${compliance}% Compliance`;
    case "COACH": return "Let's Look at This Week";
  }
}

function generateLoadSummary(data: WeeklySummaryData, toneMode: ToneMode): string {
  const hours = data.completedHours.toFixed(1);
  const planned = data.plannedHours.toFixed(1);
  const pct = data.compliancePercent;
  
  switch (toneMode) {
    case "SUPPORTIVE":
      return `You completed ${hours}h of your planned ${planned}h (${pct}% of target). ${data.restDayCount} rest day${data.restDayCount !== 1 ? "s" : ""} taken.`;
    case "DIRECT":
      return `Load: ${hours}h / ${planned}h (${pct}%). Rest days: ${data.restDayCount}.`;
    case "COACH":
      return `You logged ${hours} hours out of ${planned} planned — that's ${pct}% compliance. ${data.restDayCount > 0 ? `Good to see you took ${data.restDayCount} rest day${data.restDayCount !== 1 ? "s" : ""}.` : "No rest days — keep an eye on that."}`;
  }
}

// ============================================
// MONTHLY SUMMARY GENERATION (Spec v1.0 §8.3)
// ============================================

/**
 * Generate narrative-first monthly summary
 * Structure: Headline → Trend → Behavioral pattern → Highlight → Watch out
 */
export function generateMonthlySummary(
  data: MonthlySummaryData,
  toneMode: ToneMode
): string {
  const tone = TONE_TEMPLATES[toneMode];
  const parts: string[] = [];

  // 1. HEADLINE
  const headline = generateMonthlyHeadline(data, toneMode);
  parts.push(`# ${headline}\n`);

  // 2. TREND (fitness/fatigue/form)
  const trend = generateTrendSummary(data, toneMode);
  parts.push(`**Trend:** ${trend}`);

  // 3. BEHAVIORAL PATTERN (what AI learned)
  parts.push(`\n**Pattern:** ${data.behavioralPattern}`);

  // 4. HIGHLIGHT (best moment)
  parts.push(`\n**Highlight:** ${data.highlight}`);

  // 5. WATCH OUT (concern, if any)
  if (data.concern) {
    parts.push(`\n**Watch Out:** ${data.concern}`);
  }

  // 6. ATHLETE QUOTES (if any)
  if (data.athleteQuotes.length > 0) {
    parts.push(`\n**Your Words This Month:**`);
    for (const quote of data.athleteQuotes.slice(0, 3)) {
      parts.push(`- "${quote}"`);
    }
  }

  // Closing
  if (tone.closing) {
    parts.push(`\n\n${tone.closing}`);
  }

  return parts.join("\n");
}

function generateMonthlyHeadline(data: MonthlySummaryData, toneMode: ToneMode): string {
  const ctlDelta = data.ctlChange;
  const monthName = data.monthStart.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  
  if (ctlDelta >= 10) {
    switch (toneMode) {
      case "SUPPORTIVE": return `${monthName}: A Month of Real Progress! 🚀`;
      case "DIRECT": return `${monthName}: CTL +${ctlDelta}`;
      case "COACH": return `${monthName}: You Built Some Serious Fitness`;
    }
  }
  
  if (ctlDelta >= 5) {
    switch (toneMode) {
      case "SUPPORTIVE": return `${monthName}: Steady Growth`;
      case "DIRECT": return `${monthName}: CTL +${ctlDelta}`;
      case "COACH": return `${monthName}: Consistent Progress`;
    }
  }
  
  if (ctlDelta < 0) {
    switch (toneMode) {
      case "SUPPORTIVE": return `${monthName}: A Recovery-Focused Month`;
      case "DIRECT": return `${monthName}: CTL ${ctlDelta}`;
      case "COACH": return `${monthName}: We Backed Off — Intentionally`;
    }
  }
  
  // Default
  switch (toneMode) {
    case "SUPPORTIVE": return `${monthName}: Staying the Course`;
    case "DIRECT": return `${monthName} Summary`;
    case "COACH": return `${monthName}: Let's Review`;
  }
}

function generateTrendSummary(data: MonthlySummaryData, toneMode: ToneMode): string {
  const ctlDelta = data.ctlChange;
  const direction = ctlDelta >= 0 ? "up" : "down";
  const absChange = Math.abs(ctlDelta);
  
  switch (toneMode) {
    case "SUPPORTIVE":
      return `Your fitness (CTL) went ${direction} by ${absChange} points (${data.ctlStart} → ${data.ctlEnd}). You logged ${data.totalHours.toFixed(1)} hours with ${data.compliancePercent}% compliance.`;
    case "DIRECT":
      return `CTL: ${data.ctlStart} → ${data.ctlEnd} (${ctlDelta >= 0 ? "+" : ""}${ctlDelta}). Hours: ${data.totalHours.toFixed(1)}. Compliance: ${data.compliancePercent}%.`;
    case "COACH":
      return `CTL moved from ${data.ctlStart} to ${data.ctlEnd} — that's ${ctlDelta >= 0 ? "+" : ""}${ctlDelta} points. You put in ${data.totalHours.toFixed(1)} hours at ${data.compliancePercent}% compliance.`;
  }
}

// ============================================
// GUARDRAILS
// ============================================

/**
 * Guardrail: Never claim certainty when confidence is low
 */
export function applyConfidenceGuardrail(
  message: string,
  confidence: number
): string {
  // Remove overconfident phrases if confidence < 70
  if (confidence < 70) {
    const overconfidentPhrases = [
      /\bwill definitely\b/gi,
      /\bguaranteed\b/gi,
      /\bfor sure\b/gi,
      /\babsolutely\b/gi,
      /\bno doubt\b/gi,
      /\bcertainly\b/gi,
      /\bwithout question\b/gi,
    ];
    
    for (const phrase of overconfidentPhrases) {
      message = message.replace(phrase, "likely");
    }
  }
  
  return message;
}

/**
 * Guardrail: Always include "because" reasoning
 */
export function ensureBecauseReasoning(message: string, reason: string): string {
  const hasBecause = /\bbecause\b/i.test(message) || 
                     /\breason\b/i.test(message) || 
                     /\bhere's why\b/i.test(message) ||
                     /\bdue to\b/i.test(message);
  
  if (!hasBecause) {
    return `${message} This is because ${reason}.`;
  }
  
  return message;
}

/**
 * Guardrail: Check for simulator warnings and include if relevant
 */
export function includeSimulatorWarningIfRelevant(
  message: string,
  warnings: SimulatorWarning[],
  toneMode: ToneMode
): string {
  const relevantWarnings = warnings.filter(w => 
    w.severity === "HIGH" || w.severity === "CRITICAL"
  );
  
  if (relevantWarnings.length === 0) return message;
  
  const warning = relevantWarnings[0];
  const warningText = generateSimulatorWarning(warning, toneMode);
  
  return `${message}\n\n${warningText}`;
}

/**
 * Guardrail: Respect plan rigidity in recommendations
 */
export function respectPlanRigidity(
  recommendation: string,
  rigidity: PlanRigidity,
  toneMode: ToneMode
): { message: string; canApply: boolean } {
  const isLocked = rigidity !== "FLEXIBLE_WEEK";
  
  if (isLocked) {
    const message = generateRigidityMessage(recommendation, rigidity, toneMode);
    return { message, canApply: false };
  }
  
  return { message: recommendation, canApply: true };
}

// ============================================
// PROMPT TEMPLATES
// ============================================

/**
 * Generate system prompt for AI Coach based on context
 */
export function generateCoachSystemPrompt(context: CoachContext): string {
  const toneInstructions = getToneInstructions(context.toneMode);
  const rigidityInstructions = getRigidityInstructions(context.planRigidity);
  
  const todayCheckin = context.todayCheckin || { status: "pending", data: null, privacyMode: "FULL_AI_ACCESS", planLocked: false };

  return `You are an AI endurance coach for an athlete${context.athleteName ? ` named ${context.athleteName}` : ""}.

## Tone
${toneInstructions}

## Rules (MUST FOLLOW)
1. ALWAYS explain "because" — never give advice without reasoning
2. If confidence < 70%, explicitly say "I'm not certain" or similar
3. Reference the athlete's own words when available: "you said..."
4. ${rigidityInstructions}
5. If simulator shows risk, mention it: "When we simulated this..."
6. Admit when you don't have enough data
7. Recommend rest even if athlete wants to train, if signals are bad

## Athlete Context
- Override rate: ${context.overrideRate}% (${context.overrideRate > 50 ? "tends to push through" : "usually follows advice"})
- Memory confidence: ${context.memoryConfidence}%
- Daily check-in: ${todayCheckin.status}${
    todayCheckin.data
      ? ` (Readiness ${todayCheckin.data.readinessScore}/100, top factor ${todayCheckin.data.topFactor})`
      : ""
  }
- Check-in visibility: ${todayCheckin.privacyMode}
- Today is ${todayCheckin.planLocked ? "locked" : "editable"} for plan changes.
${todayCheckin.data?.hasConflict ? `- Conflict: ${todayCheckin.data.conflictReason}` : ""}
${context.recentQuotes.length > 0 ? `- Recent quotes: "${context.recentQuotes.slice(0, 3).join('", "')}"` : ""}
${context.simulatorWarnings.length > 0 ? `- Active warnings: ${context.simulatorWarnings.map(w => w.message).join("; ")}` : ""}

## Output Format
- Narrative first, metrics second
- Short paragraphs (2-3 sentences max)
- Use markdown for structure
- End with actionable next step`;
}

function getToneInstructions(toneMode: ToneMode): string {
  switch (toneMode) {
    case "SUPPORTIVE":
      return `Be warm, encouraging, and empathetic. Use phrases like "I'd suggest", "You've got this", "That's okay". Celebrate wins. Be gentle with criticism.`;
    case "DIRECT":
      return `Be factual and concise. No fluff. Use short sentences. State facts, then recommendations. Minimal emotional language.`;
    case "COACH":
      return `Be firm but caring. Use phrases like "Here's what I want you to do", "Trust the process", "I know you want to train, but...". Challenge when needed, support when earned.`;
  }
}

function getRigidityInstructions(rigidity: PlanRigidity): string {
  switch (rigidity) {
    case "LOCKED_TODAY":
      return "Avoid proposing calendar changes for today's session unless the athlete explicitly asks.";
    case "LOCKED_1_DAY":
      return "Suggest changes for later sessions unless the athlete explicitly asks to change the calendar now.";
    case "LOCKED_2_DAYS":
      return "Suggest changes for later sessions unless the athlete explicitly asks to change the calendar now.";
    case "LOCKED_3_DAYS":
      return "Suggest changes for later sessions unless the athlete explicitly asks to change the calendar now.";
    case "FLEXIBLE_WEEK":
      return "Plan is flexible. You may suggest changes to any session this week.";
  }
}

/**
 * Generate user prompt for specific coaching scenarios
 */
export function generateCoachUserPrompt(
  scenario: "daily_checkin" | "post_workout" | "weekly_summary" | "plan_change",
  data: Record<string, unknown>
): string {
  switch (scenario) {
    case "daily_checkin":
      return `The athlete just completed their daily check-in:
- Sleep: ${data.sleepDuration}h (quality: ${data.sleepQuality}/5)
- Physical fatigue: ${data.physicalFatigue}/5
- Mental readiness: ${data.mentalReadiness}/5
- Motivation: ${data.motivation}/5
- Stress: ${data.stressLevel}/5
- Soreness: ${data.muscleSoreness}
${data.notes ? `- Notes: "${data.notes}"` : ""}

Today's planned workout: ${data.plannedWorkout || "None"}

Provide your assessment and recommendation. Remember to explain "because".`;

    case "post_workout":
      return `The athlete just finished a workout and left feedback:
- Workout: ${data.workoutTitle}
- Perceived difficulty: ${data.perceivedDifficulty}
- vs. Planned: ${data.vsPlanned}
- Enjoyment: ${data.enjoyment}/5
- Mental state after: ${data.mentalState}/5
${data.comment ? `- Comment: "${data.comment}"` : ""}

Provide brief feedback. Reference their words if they left a comment.`;

    case "weekly_summary":
      return `Generate a weekly summary for the athlete.
- Week: ${data.weekStart} to ${data.weekEnd}
- Completed: ${data.completedHours}h of ${data.plannedHours}h planned
- Compliance: ${data.compliancePercent}%
- Avg readiness: ${data.avgReadiness}/100
- Hard sessions: ${data.hardSessionCount}
- Rest days: ${data.restDayCount}
${data.athleteQuotes ? `- Athlete quotes: "${(data.athleteQuotes as string[]).join('", "')}"` : ""}

Write a narrative-first summary. Lead with insight, not metrics.`;

    case "plan_change":
      return `You want to suggest a plan change:
- Proposed change: ${data.proposedChange}
- Reason: ${data.reason}
- Confidence: ${data.confidence}%
- Plan rigidity: ${data.planRigidity}

Generate the recommendation message, respecting plan rigidity.`;

    default:
      return "";
  }
}
