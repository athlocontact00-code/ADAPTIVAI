import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { parseDateToLocalNoon } from "@/lib/utils";

const workoutDb = db as unknown as {
  workout: {
    findUnique: (args: { where: { id: string } }) => Promise<null | { id: string; userId: string; title: string; type: string; date: Date; durationMin: number | null; distanceKm: number | null; distanceM: number | null; tss: number | null; notes: string | null; descriptionMd: string | null; prescriptionJson: string | null; planned: boolean; completed: boolean }>;
    update: (args: { where: { id: string }; data: { title: string; type: string; date: Date; durationMin: number | null; distanceKm: number | null; distanceM: number | null; tss: number | null; notes: string | null; descriptionMd: string | null; prescriptionJson: string | null; planned: boolean; completed: boolean } }) => Promise<unknown>;
    delete: (args: { where: { id: string } }) => Promise<unknown>;
  };
};

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

    const existing = await workoutDb.workout.findUnique({
      where: { id },
    });

    if (!existing || existing.userId !== session.user.id) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const workout = await workoutDb.workout.update({
      where: { id },
      data: {
        title: body.title ?? existing.title,
        type: body.type ?? existing.type,
        date: body.date ? parseDateToLocalNoon(body.date) : existing.date,
        durationMin: body.durationMin !== undefined ? body.durationMin : existing.durationMin,
        distanceKm: body.distanceKm !== undefined ? body.distanceKm : existing.distanceKm,
        distanceM: body.distanceM !== undefined ? body.distanceM : existing.distanceM,
        tss: body.tss !== undefined ? body.tss : existing.tss,
        notes: body.notes !== undefined ? body.notes : existing.notes,
        descriptionMd: body.descriptionMd !== undefined ? body.descriptionMd : existing.descriptionMd,
        prescriptionJson: body.prescriptionJson !== undefined ? body.prescriptionJson : existing.prescriptionJson,
        planned: body.planned !== undefined ? body.planned : existing.planned,
        completed: body.completed !== undefined ? body.completed : existing.completed,
      },
    });

    return NextResponse.json(workout);
  } catch (error) {
    console.error("Update workout error:", error);
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

    const existing = await workoutDb.workout.findUnique({
      where: { id },
    });

    if (!existing || existing.userId !== session.user.id) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    await workoutDb.workout.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete workout error:", error);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
