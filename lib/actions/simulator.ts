"use server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { addDays } from "@/lib/utils";
import { track } from "@/lib/analytics/events";
import { createRequestId, logError, logInfo } from "@/lib/logger";
import {
  runSimulation,
  ScenarioParams,
  BaselineMetrics,
  parseScenarioParams,
  type IdentityMode,
  WeeklySimulationResult,
} from "@/lib/services/simulator.service";

async function callOpenAIForSimulator(params: { system: string; user: string }): Promise<string> {
  const key = process.env.OPENAI_API_KEY;
  if (!key || key.length < 10) {
    throw new Error("OpenAI not configured");
  }

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

  const data = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
  const content = data.choices?.[0]?.message?.content;
  if (!content || typeof content !== "string") {
    throw new Error("OpenAI returned empty response");
  }
  return content.trim();
}

// ============================================
// SCENARIO ACTIONS
// ============================================

export async function getScenarios() {
  const session = await auth();
  if (!session?.user?.id) return [];

  return db.simulationScenario.findMany({
    where: { userId: session.user.id },
    include: {
      results: {
        orderBy: { weekIndex: "asc" },
      },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function getScenario(id: string) {
  const session = await auth();
  if (!session?.user?.id) return null;

  return db.simulationScenario.findFirst({
    where: { id, userId: session.user.id },
    include: {
      results: {
        orderBy: { weekIndex: "asc" },
      },
    },
  });
}

export async function createScenario(data: {
  name: string;
  durationWeeks: number;
  params: ScenarioParams;
}) {
  const requestId = createRequestId();
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: "Unauthorized" };

  try {
    // Validate duration
    if (data.durationWeeks < 2 || data.durationWeeks > 12) {
      return { success: false, error: "Duration must be between 2 and 12 weeks" };
    }

    const scenario = await db.simulationScenario.create({
      data: {
        userId: session.user.id,
        name: data.name,
        durationWeeks: data.durationWeeks,
        paramsJson: JSON.stringify(data.params),
      },
    });

    return { success: true, data: scenario };
  } catch (error) {
    logError("simulator.scenario.create_failed", {
      requestId,
      userId: session.user.id,
      action: "createScenario",
      error: error instanceof Error ? error.message : String(error),
    });
    return { success: false, error: "Failed to create scenario" };
  }
}

export async function deleteScenario(id: string) {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: "Unauthorized" };

  try {
    await db.simulationScenario.delete({
      where: { id, userId: session.user.id },
    });
    return { success: true };
  } catch {
    return { success: false, error: "Failed to delete scenario" };
  }
}

// ============================================
// SIMULATION ACTIONS
// ============================================

export async function runScenarioSimulation(scenarioId: string) {
  const requestId = createRequestId();
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: "Unauthorized" };

  const userId = session.user.id;

  logInfo("simulator.run.started", {
    requestId,
    userId,
    action: "runScenarioSimulation",
    scenarioId,
  });

  await track({
    name: "simulator_run_started",
    userId,
    requestId,
    route: "/simulator",
    source: "simulator",
    properties: { scenarioId },
  });

  try {
    // Get scenario
    const scenario = await db.simulationScenario.findFirst({
      where: { id: scenarioId, userId },
    });

    if (!scenario) {
      return { success: false, error: "Scenario not found" };
    }

    // Get baseline metrics from last 28 days
    const baseline = await getBaselineMetrics(userId);
    const params = parseScenarioParams(scenario.paramsJson);

    // Run simulation
    const result = runSimulation(baseline, params, scenario.durationWeeks);

    // Delete existing results for this scenario
    await db.simulationResult.deleteMany({
      where: { scenarioId },
    });

    // Store results
    for (const week of result.weeks) {
      await db.simulationResult.create({
        data: {
          scenarioId,
          userId,
          weekIndex: week.weekIndex,
          simulatedCTL: week.simulatedCTL,
          simulatedATL: week.simulatedATL,
          simulatedTSB: week.simulatedTSB,
          simulatedReadinessAvg: week.simulatedReadinessAvg,
          simulatedBurnoutRisk: week.simulatedBurnoutRisk,
          weeklyTSS: week.weeklyTSS,
          insightsJson: JSON.stringify(week.insights),
          warningsJson: week.warnings.length > 0 ? JSON.stringify(week.warnings) : null,
        },
      });
    }

    await track({
      name: "simulator_run_succeeded",
      userId,
      requestId,
      route: "/simulator",
      source: "simulator",
      properties: { scenarioId, durationWeeks: scenario.durationWeeks },
    });

    logInfo("simulator.run.succeeded", {
      requestId,
      userId,
      action: "runScenarioSimulation",
      scenarioId,
      durationWeeks: scenario.durationWeeks,
    });

    return {
      success: true,
      data: {
        weeks: result.weeks,
        summary: result.summary,
      },
    };
  } catch (error) {
    logError("simulator.run.failed", {
      requestId,
      userId,
      action: "runScenarioSimulation",
      scenarioId,
      error: error instanceof Error ? error.message : String(error),
    });

    await track({
      name: "simulator_run_failed",
      userId,
      requestId,
      route: "/simulator",
      source: "simulator",
      properties: { scenarioId },
    });
    return { success: false, error: "Failed to run simulation" };
  }
}

export async function getSimulationResults(scenarioId: string) {
  const session = await auth();
  if (!session?.user?.id) return null;

  const results = await db.simulationResult.findMany({
    where: { scenarioId, userId: session.user.id },
    orderBy: { weekIndex: "asc" },
  });

  if (results.length === 0) return null;

  // Parse JSON fields
  const weeks: WeeklySimulationResult[] = results.map((r) => ({
    weekIndex: r.weekIndex,
    simulatedCTL: r.simulatedCTL,
    simulatedATL: r.simulatedATL,
    simulatedTSB: r.simulatedTSB,
    simulatedReadinessAvg: r.simulatedReadinessAvg,
    simulatedBurnoutRisk: r.simulatedBurnoutRisk,
    weeklyTSS: r.weeklyTSS || 0,
    insights: r.insightsJson ? JSON.parse(r.insightsJson) : [],
    warnings: r.warningsJson ? JSON.parse(r.warningsJson) : [],
  }));

  // Calculate summary
  const finalWeek = weeks[weeks.length - 1];
  const baseline = await getBaselineMetrics(session.user.id);
  const ctlChange = finalWeek.simulatedCTL - baseline.ctl;
  const peakBurnoutRisk = Math.max(...weeks.map((w) => w.simulatedBurnoutRisk));
  const totalWarnings = weeks.reduce((sum, w) => sum + w.warnings.length, 0);

  let recommendation = "";
  if (totalWarnings === 0 && peakBurnoutRisk < 50) {
    recommendation = "This scenario appears safe and sustainable.";
  } else if (totalWarnings <= 2 && peakBurnoutRisk < 70) {
    recommendation = "Moderate risk scenario. Monitor closely.";
  } else {
    recommendation = "High risk scenario. Consider reducing load.";
  }

  return {
    weeks,
    summary: {
      finalCTL: finalWeek.simulatedCTL,
      finalATL: finalWeek.simulatedATL,
      finalTSB: finalWeek.simulatedTSB,
      ctlChange: Math.round(ctlChange * 10) / 10,
      peakBurnoutRisk,
      totalWarnings,
      recommendation,
    },
  };
}

// ============================================
// APPLY SCENARIO
// ============================================

export async function applyScenario(scenarioId: string) {
  const requestId = createRequestId();
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: "Unauthorized" };

  const userId = session.user.id;

  try {
    // Get scenario with results
    const scenario = await db.simulationScenario.findFirst({
      where: { id: scenarioId, userId },
      include: { results: true },
    });

    if (!scenario) {
      return { success: false, error: "Scenario not found" };
    }

    if (scenario.results.length === 0) {
      return { success: false, error: "Run simulation first before applying" };
    }

    // Mark scenario as applied
    await db.simulationScenario.update({
      where: { id: scenarioId },
      data: {
        applied: true,
        appliedAt: new Date(),
      },
    });

    // Note: Actual workout generation would use the existing AI Coach logic
    // For now, we just mark the scenario as applied
    // The user can then go to AI Coach to generate workouts based on the scenario parameters

    return {
      success: true,
      message: "Scenario applied. Go to AI Coach to generate workouts based on this plan.",
    };
  } catch (error) {
    logError("simulator.scenario.apply_failed", {
      requestId,
      userId,
      action: "applyScenario",
      scenarioId,
      error: error instanceof Error ? error.message : String(error),
    });
    return { success: false, error: "Failed to apply scenario" };
  }
}

// ============================================
// BASELINE METRICS
// ============================================

async function getBaselineMetrics(userId: string): Promise<BaselineMetrics> {
  const today = new Date();
  today.setHours(23, 59, 59, 999);
  const fourWeeksAgo = addDays(today, -28);

  // Get user identity mode
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { identityMode: true },
  });

  const rawIdentityMode = typeof user?.identityMode === "string" ? user.identityMode : null;
  const identityMode: IdentityMode =
    rawIdentityMode === "competitive" ||
    rawIdentityMode === "longevity" ||
    rawIdentityMode === "comeback" ||
    rawIdentityMode === "busy_pro"
      ? rawIdentityMode
      : "competitive";

  // Get recent metrics
  const metrics = await db.metricDaily.findMany({
    where: {
      userId,
      date: { gte: fourWeeksAgo, lte: today },
    },
    orderBy: { date: "desc" },
  });

  // Get recent workouts for TSS calculation
  const workouts = await db.workout.findMany({
    where: {
      userId,
      date: { gte: fourWeeksAgo, lte: today },
      completed: true,
    },
  });

  // Calculate averages
  const latestMetric = metrics[0];
  const avgWeeklyTSS = workouts.length > 0
    ? Math.round(workouts.reduce((sum, w) => sum + (w.tss || 0), 0) / 4)
    : 250;

  const readinessScores = metrics
    .filter((m) => m.readinessScore != null)
    .map((m) => m.readinessScore!);
  const avgReadiness = readinessScores.length > 0
    ? Math.round(readinessScores.reduce((a, b) => a + b, 0) / readinessScores.length)
    : 65;

  const burnoutRisks = metrics
    .filter((m) => m.burnoutRisk != null)
    .map((m) => m.burnoutRisk!);
  const avgBurnoutRisk = burnoutRisks.length > 0
    ? Math.round(burnoutRisks.reduce((a, b) => a + b, 0) / burnoutRisks.length)
    : 20;

  return {
    ctl: latestMetric?.ctl || 50,
    atl: latestMetric?.atl || 40,
    tsb: latestMetric?.tsb || 10,
    avgWeeklyTSS,
    avgReadiness,
    avgBurnoutRisk,
    identityMode,
  };
}

export async function getBaselineForSimulator() {
  const session = await auth();
  if (!session?.user?.id) return null;

  return getBaselineMetrics(session.user.id);
}

export async function explainScenarioWithCoach(scenarioId: string): Promise<{ success: boolean; text?: string; error?: string }> {
  const requestId = createRequestId();
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: "Unauthorized" };

  const userId = session.user.id;

  try {
    const scenario = await db.simulationScenario.findFirst({
      where: { id: scenarioId, userId },
      include: { results: { orderBy: { weekIndex: "asc" } } },
    });

    if (!scenario) return { success: false, error: "Scenario not found" };
    if (!scenario.results || scenario.results.length === 0) {
      return { success: false, error: "Run simulation first" };
    }

    const baseline = await getBaselineMetrics(userId);
    const params = parseScenarioParams(scenario.paramsJson);
    const weeks = scenario.results.map((r) => ({
      weekIndex: r.weekIndex,
      simulatedCTL: r.simulatedCTL,
      simulatedATL: r.simulatedATL,
      simulatedTSB: r.simulatedTSB,
      simulatedReadinessAvg: r.simulatedReadinessAvg,
      simulatedBurnoutRisk: r.simulatedBurnoutRisk,
      weeklyTSS: r.weeklyTSS || 0,
      insights: r.insightsJson ? (JSON.parse(r.insightsJson) as string[]) : [],
      warnings: r.warningsJson ? (JSON.parse(r.warningsJson) as string[]) : [],
    }));

    const final = weeks[weeks.length - 1];
    const peakBurnout = Math.max(...weeks.map((w) => w.simulatedBurnoutRisk));
    const totalWarnings = weeks.reduce((sum, w) => sum + (w.warnings?.length || 0), 0);

    const fallback = (() => {
      const ctlChange = Math.round((final.simulatedCTL - baseline.ctl) * 10) / 10;
      const risk = peakBurnout;
      const guard = risk >= 70 || final.simulatedTSB < -30 || totalWarnings >= 3;

      const lines: string[] = [];
      lines.push(`## Coach summary`);
      lines.push(`- CTL change: ${ctlChange >= 0 ? "+" : ""}${ctlChange}`);
      lines.push(`- Peak burnout risk: ${risk}%`);
      lines.push(`- Readiness trend: ends ~${final.simulatedReadinessAvg}/100`);
      lines.push("");
      lines.push("## Recommendation");
      lines.push(
        guard
          ? "This looks aggressive. I'd reduce volume or intensity, and add a recovery week to keep this sustainable."
          : "This looks broadly sustainable. Keep it consistent, and monitor readiness + burnout week to week."
      );
      lines.push("");
      lines.push("## Next step");
      lines.push("Tell me your goal (race date / priority) and weekly availability, and I’ll translate this into a concrete weekly plan.");
      return lines.join("\n");
    })();

    const system = `You are AdaptivAI Coach. Analyze a deterministic training simulation scenario.
Rules:
- Be precise and practical.
- Use short markdown.
- Provide a recommendation with a clear "because" sentence.
- Do not claim certainty; this is a projection.
- Do not include medical diagnosis.
`;

    const user = `Scenario name: ${scenario.name}
Duration weeks: ${scenario.durationWeeks}

Baseline: ${JSON.stringify(baseline)}
Params: ${JSON.stringify(params)}

Final week: ${JSON.stringify(final)}
Peak burnout risk: ${peakBurnout}
Total warnings: ${totalWarnings}
`;

    let text = fallback;
    try {
      text = await callOpenAIForSimulator({ system, user });
    } catch {
    }

    return { success: true, text };
  } catch (error) {
    logError("simulator.coach_explain.failed", {
      requestId,
      userId,
      action: "explainScenarioWithCoach",
      scenarioId,
      error: error instanceof Error ? error.message : String(error),
    });
    return { success: false, error: "Failed to generate explanation" };
  }
}

// ============================================
// QUICK STATS FOR DASHBOARD
// ============================================

export async function getSimulatorQuickStats() {
  const session = await auth();
  if (!session?.user?.id) return null;

  const scenarios = await db.simulationScenario.findMany({
    where: { userId: session.user.id },
    include: {
      results: {
        orderBy: { weekIndex: "desc" },
        take: 1,
      },
    },
    orderBy: { createdAt: "desc" },
    take: 3,
  });

  return {
    totalScenarios: scenarios.length,
    recentScenarios: scenarios.map((s) => ({
      id: s.id,
      name: s.name,
      durationWeeks: s.durationWeeks,
      applied: s.applied,
      hasResults: s.results.length > 0,
      finalCTL: s.results[0]?.simulatedCTL,
    })),
  };
}
