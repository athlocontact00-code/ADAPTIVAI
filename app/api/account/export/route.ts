import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;

  const [user, profile, workouts, metrics, diaryEntries, checkIns, feedback, memories] = await Promise.all([
    db.user.findUnique({ where: { id: userId } }),
    db.profile.findUnique({ where: { userId } }),
    db.workout.findMany({ where: { userId }, orderBy: { date: "desc" }, take: 500 }),
    db.metricDaily.findMany({ where: { userId }, orderBy: { date: "desc" }, take: 500 }),
    db.diaryEntry.findMany({ where: { userId }, orderBy: { date: "desc" }, take: 500 }),
    db.dailyCheckIn.findMany({
      where: { userId },
      orderBy: { date: "desc" },
      take: 200,
    }),
    db.postWorkoutFeedback.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: 200 }),
    db.aIMemory.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 200,
    }),
  ]);

  return NextResponse.json(
    {
      ok: true,
      exportedAt: new Date().toISOString(),
      userId,
      data: {
        user,
        profile,
        workouts,
        metrics,
        diaryEntries,
        checkIns,
        feedback,
        memories,
      },
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
