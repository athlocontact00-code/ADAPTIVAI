export type NarrativeConfidence = "LOW" | "MED" | "HIGH";

export type WeeklyNarrative = {
  headline: string;
  loadVsPlan: string;
  keyInsight: string;
  quote?: string;
  recommendation: string;
  markdown: string;
  basedOn: string[];
  why: string;
  confidence: NarrativeConfidence;
  confidenceReason: string;
};

export type MonthlyNarrative = {
  headline: string;
  trend: string;
  behavioralPattern: string;
  highlight: string;
  quote?: string;
  watchOut?: string;
  markdown: string;
  basedOn: string[];
  why: string;
  confidence: NarrativeConfidence;
  confidenceReason: string;
};

function clampText(input: string, maxLen: number): string {
  const trimmed = input.replace(/\s+/g, " ").trim();
  if (trimmed.length <= maxLen) return trimmed;
  return `${trimmed.slice(0, maxLen - 1).trim()}…`;
}

function directionFromDelta(delta: number): "UP" | "DOWN" | "FLAT" {
  if (delta >= 5) return "UP";
  if (delta <= -5) return "DOWN";
  return "FLAT";
}

export function buildWeeklyNarrative(params: {
  weekStart: Date;
  weekEnd: Date;
  plannedHours: number;
  completedHours: number;
  compliancePercent: number;
  avgReadiness: number | null;
  prevAvgReadiness: number | null;
  quote?: string;
}): WeeklyNarrative {
  const readinessDelta =
    typeof params.avgReadiness === "number" && typeof params.prevAvgReadiness === "number"
      ? params.avgReadiness - params.prevAvgReadiness
      : 0;
  const readinessDir = directionFromDelta(readinessDelta);

  const completed = Math.round(params.completedHours * 10) / 10;
  const planned = Math.round(params.plannedHours * 10) / 10;

  const headline =
    params.compliancePercent >= 85
      ? "You executed the plan with high consistency."
      : params.compliancePercent >= 60
      ? "You got meaningful work done, with room to tighten consistency."
      : "This was a lighter week—focus on rebuilding rhythm."

  const loadVsPlan = `${completed}h completed of ${planned}h planned (${params.compliancePercent}% compliance).`;

  const keyInsight = (() => {
    if (typeof params.avgReadiness !== "number") {
      return "Readiness data was limited—use daily check-ins to improve accuracy.";
    }

    if (readinessDir === "UP") return `Readiness improved (avg ${params.avgReadiness}/100).`;
    if (readinessDir === "DOWN") return `Readiness dipped (avg ${params.avgReadiness}/100)—prioritize recovery inputs.`;
    return `Readiness was stable (avg ${params.avgReadiness}/100).`;
  })();

  const recommendation = (() => {
    if (params.compliancePercent < 60) return "Next week focus: keep sessions short and consistent—aim for completion over intensity.";
    if (typeof params.avgReadiness === "number" && params.avgReadiness < 55)
      return "Next week focus: bias toward easy aerobic work and recovery; avoid stacking hard days.";
    return "Next week focus: keep the plan structure, and be deliberate about one key quality session.";
  })();

  const quote = params.quote ? clampText(params.quote, 180) : undefined;

  const basedOn: string[] = [];
  basedOn.push(`Compliance: ${params.compliancePercent}% (plan vs done)`);
  basedOn.push(`Load: ${completed}h completed of ${planned}h planned`);
  if (typeof params.avgReadiness === "number") {
    basedOn.push(`Readiness: avg ${params.avgReadiness}/100 (7-day trend)`);
  } else {
    basedOn.push(`Readiness: limited—use check-ins`);
  }
  if (quote) basedOn.push(`Diary: 1 feedback quote`);

  const why = `This insight comes from your planned vs completed hours, compliance rate, and readiness trend. ${params.compliancePercent >= 85 ? "High consistency indicates the plan fit well." : params.compliancePercent >= 60 ? "Moderate consistency suggests room to optimize." : "Lower completion suggests adjusting plan complexity."}`;

  const hasReadiness = typeof params.avgReadiness === "number";
  const confidence: NarrativeConfidence = hasReadiness && params.compliancePercent >= 80 ? "HIGH" : hasReadiness ? "MED" : "LOW";
  const confidenceReason = confidence === "LOW" ? "Limited check-in data—add daily check-ins for accuracy." : confidence === "MED" ? "Some check-in data available." : "Strong check-in coverage.";

  const markdownParts: string[] = [];
  markdownParts.push(`## ${headline}`);
  markdownParts.push("");
  markdownParts.push(`**Load vs plan:** ${loadVsPlan}`);
  markdownParts.push("");
  markdownParts.push(`**Key insight:** ${keyInsight}`);
  if (quote) {
    markdownParts.push("");
    markdownParts.push(`**Your words:** "${quote}"`);
  }
  markdownParts.push("");
  markdownParts.push(`**Recommendation:** ${recommendation}`);

  return {
    headline,
    loadVsPlan,
    keyInsight,
    quote,
    recommendation,
    basedOn,
    why,
    confidence,
    confidenceReason,
    markdown: markdownParts.join("\n"),
  };
}

export function buildMonthlyNarrative(params: {
  monthStart: Date;
  monthEnd: Date;
  totalHours: number;
  compliancePercent: number;
  avgReadiness: number | null;
  prevAvgReadiness: number | null;
  totalTss: number;
  prevTotalTss: number;
  quote?: string;
}): MonthlyNarrative {
  const hours = Math.round(params.totalHours * 10) / 10;

  const readinessDelta =
    typeof params.avgReadiness === "number" && typeof params.prevAvgReadiness === "number"
      ? params.avgReadiness - params.prevAvgReadiness
      : 0;
  const readinessDir = directionFromDelta(readinessDelta);

  const tssDelta = params.totalTss - params.prevTotalTss;

  const headline =
    params.compliancePercent >= 85
      ? "A consistent month with strong follow-through."
      : params.compliancePercent >= 60
      ? "A productive month—consistency is trending in the right direction."
      : "A rebuilding month—focus on routine and manageable volume."

  const trend = (() => {
    const loadPart = tssDelta >= 30 ? "training load increased" : tssDelta <= -30 ? "training load decreased" : "training load was steady";
    const readinessPart =
      typeof params.avgReadiness === "number"
        ? readinessDir === "UP"
          ? "readiness improved"
          : readinessDir === "DOWN"
          ? "readiness declined"
          : "readiness was steady"
        : "readiness data was limited";
    return `This month, ${loadPart} and ${readinessPart}.`;
  })();

  const behavioralPattern = (() => {
    if (params.compliancePercent < 60) return "Pattern: missed sessions clustered—aim for smaller defaults rather than all-or-nothing weeks.";
    if (typeof params.avgReadiness === "number" && params.avgReadiness < 55)
      return "Pattern: recovery signals were consistently low—sleep/stress inputs likely constrained training quality.";
    return "Pattern: steady execution with manageable load—keep the routine stable.";
  })();

  const highlight = `${hours}h completed with ${params.compliancePercent}% compliance.`;

  const watchOut = (() => {
    if (typeof params.avgReadiness === "number" && params.avgReadiness < 50) {
      return "Watch out: low readiness baseline—consider deloading intensity before adding volume.";
    }
    if (params.compliancePercent < 60) {
      return "Watch out: low consistency—reduce plan complexity to avoid compounding missed sessions.";
    }
    return undefined;
  })();

  const quote = params.quote ? clampText(params.quote, 180) : undefined;

  const basedOn: string[] = [];
  basedOn.push(`Compliance: ${params.compliancePercent}% (plan vs done)`);
  basedOn.push(`Load: ${params.totalTss} TSS (vs ${params.prevTotalTss} prev month)`);
  if (typeof params.avgReadiness === "number") {
    basedOn.push(`Readiness: avg ${params.avgReadiness}/100`);
  } else {
    basedOn.push(`Readiness: limited data`);
  }
  if (quote) basedOn.push(`Diary: feedback included`);

  const why = `Based on monthly TSS, compliance, and readiness trends. ${params.compliancePercent >= 85 ? "Strong consistency indicates sustainable load." : "Room to improve consistency or recovery."}`;

  const confidence: NarrativeConfidence = typeof params.avgReadiness === "number" && params.compliancePercent > 0 ? "MED" : "LOW";
  const confidenceReason = confidence === "LOW" ? "Limited data—log more workouts and check-ins." : "Reasonable coverage for the month.";

  const markdownParts: string[] = [];
  markdownParts.push(`## ${headline}`);
  markdownParts.push("");
  markdownParts.push(`**Trend:** ${trend}`);
  markdownParts.push("");
  markdownParts.push(`**Behavioral pattern:** ${behavioralPattern}`);
  markdownParts.push("");
  markdownParts.push(`**Highlight:** ${highlight}`);
  if (quote) {
    markdownParts.push("");
    markdownParts.push(`**Your words:** "${quote}"`);
  }
  if (watchOut) {
    markdownParts.push("");
    markdownParts.push(`**Watch out:** ${watchOut}`);
  }

  return {
    headline,
    trend,
    behavioralPattern,
    highlight,
    quote,
    watchOut,
    basedOn,
    why,
    confidence,
    confidenceReason,
    markdown: markdownParts.join("\n"),
  };
}
