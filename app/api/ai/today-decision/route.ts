import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { buildAIContextForUser } from "@/lib/services/ai-context.builder";
import { startOfDay } from "@/lib/utils";
import { z } from "zod";

const InputSchema = z.object({
  date: z.string().datetime().optional(),
  force: z.boolean().optional(),
});

const DecisionSchema = z.object({
  decision: z.enum(["DO_THIS_WORKOUT", "LIGHT_ALTERNATIVE", "REST_TODAY"]),
  action: z.object({
    title: z.string(),
    details: z.string(),
    targets: z
      .object({
        discipline: z.enum(["run", "bike", "swim", "strength"]).optional(),
        paceRange: z.string().optional(),
        powerRange: z.string().optional(),
        hrRange: z.string().optional(),
        durationMin: z.number().optional(),
      })
      .optional(),
    link: z
      .object({
        type: z.enum(["workout", "calendar_day", "coach_chat"]),
        id: z.string().optional(),
        date: z.string().optional(),
      })
      .optional(),
  }),
  why: z.string(),
  confidence: z.enum(["LOW", "MED", "HIGH"]),
});

async function callTodayDecisionLLM(contextJson: string): Promise<z.infer<typeof DecisionSchema>> {
  const key = process.env.OPENAI_API_KEY;
  if (!key || key.length < 10) {
    throw new Error("OpenAI not configured");
  }

  const system = `You are an expert endurance coach. Given the athlete's context, decide what they should do TODAY.

Always output EXACTLY one of these decisions:
- DO_THIS_WORKOUT: Proceed with the planned workout (or a concrete suggestion if none)
- LIGHT_ALTERNATIVE: Suggest an easier/modified session
- REST_TODAY: Recommend rest or very light movement only

Output STRICT JSON only, no markdown. Schema:
{
  "decision": "DO_THIS_WORKOUT" | "LIGHT_ALTERNATIVE" | "REST_TODAY",
  "action": {
    "title": "Short action title",
    "details": "1-2 sentences of what to do",
    "targets": { "discipline": "run"|"bike"|"swim"|"strength", "paceRange": "...", "durationMin": number } (optional),
    "link": { "type": "workout"|"calendar_day"|"coach_chat", "id": "...", "date": "YYYY-MM-DD" } (optional)
  },
  "why": "Max 2 sentences",
  "confidence": "LOW"|"MED"|"HIGH"
}`;

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model: "gpt-4.1",
      messages: [
        { role: "system", content: system },
        { role: "user", content: `Athlete context:\n${contextJson}` },
      ],
      response_format: { type: "json_object" },
      max_tokens: 400,
      temperature: 0.3,
    }),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`OpenAI error: ${response.status} ${text}`);
  }

  const data = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
  const content = data.choices?.[0]?.message?.content;
  if (!content || typeof content !== "string") {
    throw new Error("Empty AI response");
  }

  const parsed = JSON.parse(content) as unknown;
  return DecisionSchema.parse(parsed);
}

function fallbackDecision(): z.infer<typeof DecisionSchema> {
  return {
    decision: "REST_TODAY",
    action: {
      title: "Set up your plan",
      details: "Create a 7-day plan in the AI Coach or Calendar to get personalized daily recommendations.",
      link: { type: "coach_chat" },
    },
    why: "No training plan or check-in data yet.",
    confidence: "LOW",
  };
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { date?: string; force?: boolean } = {};
  try {
    body = await req.json().catch(() => ({}));
  } catch {
    // empty body ok
  }
  const parsed = InputSchema.safeParse(body);
  const { date: dateStr, force } = parsed.success ? parsed.data : { date: undefined, force: false };

  const decisionDate = dateStr ? startOfDay(new Date(dateStr)) : startOfDay(new Date());

  if (!force) {
    const cached = await db.todayDecision.findUnique({
      where: {
        userId_date: { userId: session.user.id, date: decisionDate },
      },
    });
    if (cached) {
      const payload = JSON.parse(cached.payload) as z.infer<typeof DecisionSchema>;
      return NextResponse.json({
        decision: payload,
        cached: true,
        date: decisionDate.toISOString(),
      });
    }
  }

  let decision: z.infer<typeof DecisionSchema>;

  try {
    const context = await buildAIContextForUser(session.user.id);
    const contextStr = JSON.stringify(
      {
        planSummary: context.planSummary,
        todayCheckin: context.todayCheckin,
        recentSignals: {
          checkIns7d: context.recentSignals.checkIns7d,
          metrics14d: context.recentSignals.metrics14d,
        },
        recentTraining: context.recentTraining,
        goals: context.goals,
      },
      null,
      2
    );
    decision = await callTodayDecisionLLM(contextStr);
  } catch (err) {
    console.error("[today-decision] LLM failed:", err);
    decision = fallbackDecision();
  }

  await db.todayDecision.upsert({
    where: {
      userId_date: { userId: session.user.id, date: decisionDate },
    },
    create: {
      userId: session.user.id,
      date: decisionDate,
      payload: JSON.stringify(decision),
    },
    update: { payload: JSON.stringify(decision) },
  });

  return NextResponse.json({
    decision,
    cached: false,
    date: decisionDate.toISOString(),
  });
}
