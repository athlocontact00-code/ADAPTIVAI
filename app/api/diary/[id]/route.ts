import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { parseDateToLocalNoon } from "@/lib/utils";

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await req.json();

    const visibilityLevel: string | undefined = body.visibilityLevel;
    const normalizedVisibilityLevel =
      visibilityLevel === "FULL_AI_ACCESS" ||
      visibilityLevel === "METRICS_ONLY" ||
      visibilityLevel === "HIDDEN"
        ? visibilityLevel
        : undefined;

    const existing = await db.diaryEntry.findUnique({ where: { id } });
    if (!existing || existing.userId !== session.user.id) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const entry = await db.diaryEntry.update({
      where: { id },
      data: {
        date: body.date ? parseDateToLocalNoon(body.date) : existing.date,
        mood: body.mood ?? existing.mood,
        energy: body.energy ?? existing.energy,
        sleepHrs: body.sleepHrs !== undefined ? body.sleepHrs : existing.sleepHrs,
        sleepQual: body.sleepQual ?? existing.sleepQual,
        stress: body.stress ?? existing.stress,
        soreness: body.soreness ?? existing.soreness,
        motivation: body.motivation ?? (existing as any).motivation,
        notes: body.notes !== undefined ? body.notes : existing.notes,
        workoutId: body.workoutId !== undefined ? body.workoutId : existing.workoutId,
        ...(normalizedVisibilityLevel ? { visibilityLevel: normalizedVisibilityLevel } : {}),
      } as any,
    });

    return NextResponse.json(entry);
  } catch (error) {
    console.error("Update diary entry error:", error);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const existing = await db.diaryEntry.findUnique({ where: { id } });
    if (!existing || existing.userId !== session.user.id) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    await db.diaryEntry.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete diary entry error:", error);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
