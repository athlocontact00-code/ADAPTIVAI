import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { parseDateToLocalNoon } from "@/lib/utils";

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();

    const visibilityLevel: string | undefined = body.visibilityLevel;
    const normalizedVisibilityLevel =
      visibilityLevel === "FULL_AI_ACCESS" ||
      visibilityLevel === "METRICS_ONLY" ||
      visibilityLevel === "HIDDEN"
        ? visibilityLevel
        : undefined;

    const entry = await db.diaryEntry.create({
      data: {
        userId: session.user.id,
        date: parseDateToLocalNoon(body.date),
        mood: body.mood,
        energy: body.energy,
        sleepHrs: body.sleepHrs,
        sleepQual: body.sleepQual,
        stress: body.stress,
        soreness: body.soreness,
        motivation: body.motivation,
        notes: body.notes,
        workoutId: body.workoutId,
        visibilityLevel: normalizedVisibilityLevel ?? "FULL_AI_ACCESS",
      } as any,
    });

    return NextResponse.json(entry, { status: 201 });
  } catch (error) {
    console.error("Create diary entry error:", error);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
