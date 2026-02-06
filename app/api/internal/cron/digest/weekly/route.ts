import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { addDays, startOfDay, startOfWeek } from "@/lib/utils";

async function callOpenAIDigest(context: string): Promise<string | null> {
  const key = process.env.OPENAI_API_KEY;
  if (!key || key.length < 10) return null;

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: "gpt-4.1",
        messages: [
          {
            role: "system",
            content:
              "You are an expert endurance coach. Generate a brief weekly digest. Max 5 bullet points, 1 sentence each. End with 1 recommendation for next week. Be concise and motivating. Output plain text, no markdown.",
          },
          { role: "user", content: context },
        ],
        max_tokens: 300,
        temperature: 0.5,
      }),
    });
    if (!response.ok) return null;
    const data = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
    return data.choices?.[0]?.message?.content?.trim() ?? null;
  } catch {
    return null;
  }
}

async function sendDigestEmail(to: string, subject: string, text: string): Promise<boolean> {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM ?? "AdaptivAI <onboarding@resend.dev>";
  if (!key || key.length < 10) return false;
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({ from, to, subject, text }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

function isWeeklyDigestEnabled(prefs: unknown): boolean {
  if (!prefs || typeof prefs !== "object") return true;
  return (prefs as Record<string, unknown>).enableWeeklyDigest !== false;
}

export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization");
  const secret = process.env.INTERNAL_CRON_SECRET;
  if (!secret || authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const lastMonday = addDays(startOfWeek(now), -7);
  const weekStart = startOfDay(lastMonday);
  const weekEnd = addDays(weekStart, 6);
  weekEnd.setHours(23, 59, 59, 999);

  const users = await db.user.findMany({
    where: { onboardingDone: true },
    select: {
      id: true,
      email: true,
      name: true,
      profile: { select: { sportPrimary: true, weeklyHoursGoal: true, preferences: true } },
    },
  });

  let created = 0;
  let sent = 0;

  for (const user of users) {
    if (!isWeeklyDigestEnabled(user.profile?.preferences)) continue;
    const existing = await db.weeklyDigest.findFirst({
      where: { userId: user.id, weekStart, weekEnd },
    });
    if (existing) continue;

    const workouts = await db.workout.findMany({
      where: { userId: user.id, date: { gte: weekStart, lte: weekEnd } },
    });
    const checkIns = await db.dailyCheckIn.findMany({
      where: { userId: user.id, date: { gte: weekStart, lte: weekEnd } },
    });
    const feedback = await db.postWorkoutFeedback.findMany({
      where: {
        userId: user.id,
        createdAt: { gte: weekStart, lte: weekEnd },
        visibleToAI: true,
      },
    });

    const planned = workouts.filter((w) => w.planned);
    const completed = workouts.filter((w) => w.completed);
    const plannedHours = planned.reduce((s, w) => s + (w.durationMin ?? 0) / 60, 0);
    const completedHours = completed.reduce((s, w) => s + (w.durationMin ?? 0) / 60, 0);
    const compliancePercent = plannedHours > 0 ? Math.round((completedHours / plannedHours) * 100) : 0;
    const totalTSS = completed.reduce((s, w) => s + (w.tss ?? 0), 0);
    const readinessScores = checkIns
      .map((c) => c.readinessScore)
      .filter((r): r is number => typeof r === "number");
    const avgReadiness =
      readinessScores.length > 0
        ? Math.round(readinessScores.reduce((a, b) => a + b, 0) / readinessScores.length)
        : null;
    const avgEnjoyment =
      feedback.length > 0
        ? Math.round((feedback.reduce((s, f) => s + f.enjoyment, 0) / feedback.length) * 10) / 10
        : null;

    const context = [
      `Athlete: ${user.name ?? "Athlete"}`,
      `Sport: ${user.profile?.sportPrimary ?? "general"}`,
      `Weekly hours goal: ${user.profile?.weeklyHoursGoal ?? "—"}`,
      `Last week: ${plannedHours.toFixed(1)}h planned, ${completedHours.toFixed(1)}h completed (${compliancePercent}% compliance)`,
      `TSS: ${totalTSS}`,
      avgReadiness != null ? `Avg readiness: ${avgReadiness}/100` : "",
      avgEnjoyment != null ? `Avg enjoyment: ${avgEnjoyment}/5` : "",
    ]
      .filter(Boolean)
      .join("\n");

    let aiSummary = await callOpenAIDigest(context);
    if (!aiSummary) {
      aiSummary = [
        `You completed ${completedHours.toFixed(1)}h of training (${compliancePercent}% of planned).`,
        totalTSS > 0 ? `Total TSS: ${totalTSS}.` : "",
        avgReadiness != null
          ? avgReadiness >= 70
            ? "Readiness was solid — good recovery."
            : "Recovery could be better — watch your load."
          : "",
        `Next week: ${compliancePercent >= 80 ? "Keep the momentum." : "Focus on consistency."}`,
      ]
        .filter(Boolean)
        .join(" ");
    }

    const subject = `Your AdaptivAI weekly digest: ${weekStart.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    })} – ${weekEnd.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;

    const digestData = {
      weekStart: weekStart.toISOString(),
      weekEnd: weekEnd.toISOString(),
      totalHours: completedHours,
      totalTSS,
      compliancePercent,
      avgReadiness,
      avgEnjoyment,
      plannedWorkouts: planned.length,
      completedWorkouts: completed.length,
      bullets: aiSummary.split("\n").filter(Boolean),
    };

    const digest = await db.weeklyDigest.create({
      data: {
        userId: user.id,
        weekStart,
        weekEnd,
        subject,
        text: aiSummary,
        data: JSON.stringify(digestData),
        status: "created",
      },
    });

    created += 1;

    const emailSent = await sendDigestEmail(user.email, subject, aiSummary);
    if (emailSent) {
      await db.weeklyDigest.update({
        where: { id: digest.id },
        data: { status: "sent", sentAt: new Date() },
      });
      sent += 1;
    }
  }

  return NextResponse.json({ ok: true, created, sent });
}
