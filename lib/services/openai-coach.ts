import { PlanGenerationResult } from "./coach-engine";

export function isOpenAIAvailable(): boolean {
  const key = process.env.OPENAI_API_KEY;
  return !!key && key.length > 10;
}

export async function enhancePlanWithOpenAI(
  plan: PlanGenerationResult,
  athleteContext: {
    sport: string;
    level: string;
    weeklyHoursGoal: number;
  }
): Promise<PlanGenerationResult> {
  if (!isOpenAIAvailable()) {
    return plan;
  }

  try {
    const key = process.env.OPENAI_API_KEY;
    if (!key || key.length < 10) return plan;

    const workoutList = plan.workouts
      .map(w => `- ${w.date.toLocaleDateString("en-US", { weekday: "short" })}: ${w.title} (${w.durationMin}min, ${w.intensity})`)
      .join("\n");

    const prompt = `You are an expert endurance coach. An athlete has the following profile:
- Sport: ${athleteContext.sport}
- Experience Level: ${athleteContext.level}
- Weekly Hours Goal: ${athleteContext.weeklyHoursGoal}h

A rules-based engine has generated this 7-day training plan:
${workoutList}

Please provide:
1. A brief motivational summary (2-3 sentences) about this training week
2. One key focus tip for the athlete

Keep your response concise and encouraging. Format as markdown.`;

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: "gpt-4.1",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 200,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      console.warn("OpenAI API error:", response.status);
      return plan;
    }

    const data = await response.json();
    const aiSummary = data.choices?.[0]?.message?.content;

    if (aiSummary) {
      return {
        ...plan,
        summaryMd: plan.summaryMd + `\n\n### 🤖 AI Coach Notes\n\n${aiSummary}`,
      };
    }

    return plan;
  } catch (error) {
    console.warn("OpenAI enhancement failed:", error);
    return plan;
  }
}

export async function improveWorkoutDescription(
  workoutTitle: string,
  workoutType: string,
  duration: number,
  intensity: string,
  aiReason: string
): Promise<string> {
  if (!isOpenAIAvailable()) {
    return aiReason;
  }

  try {
    const key = process.env.OPENAI_API_KEY;
    if (!key || key.length < 10) return aiReason;

    const prompt = `You are an expert coach. Improve this workout description in ONE sentence:
Workout: ${workoutTitle} (${workoutType}, ${duration}min, ${intensity} intensity)
Current reason: ${aiReason}

Make it more specific and motivating. Keep under 100 characters.`;

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: "gpt-4.1",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 50,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      return aiReason;
    }

    const data = await response.json();
    const improved = data.choices?.[0]?.message?.content?.trim();

    return improved || aiReason;
  } catch {
    return aiReason;
  }
}
