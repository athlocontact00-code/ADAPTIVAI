import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { parseDateToLocalNoon } from "@/lib/utils";
import { z } from "zod";

const workoutDb = db as unknown as {
  workout: {
    create: (args: {
      data: {
        userId: string;
        title: string;
        type: string;
        date: Date;
        durationMin: number | null | undefined;
        distanceKm: number | null | undefined;
        distanceM: number | null | undefined;
        tss: number | null | undefined;
        notes: string | null | undefined;
        descriptionMd: string | null | undefined;
        prescriptionJson: string | null | undefined;
        planned: boolean;
        completed: boolean;
      };
    }) => Promise<unknown>;
  };
};

const workoutSchema = z.object({
  title: z.string().min(1),
  type: z.string(),
  date: z.string(),
  durationMin: z.number().nullable().optional(),
  distanceKm: z.number().nullable().optional(),
  distanceM: z.number().nullable().optional(),
  tss: z.number().nullable().optional(),
  notes: z.string().nullable().optional(),
  descriptionMd: z.string().nullable().optional(),
  prescriptionJson: z.string().nullable().optional(),
  planned: z.boolean().optional(),
  completed: z.boolean().optional(),
});

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const workouts = await db.workout.findMany({
      where: { userId: session.user.id },
      orderBy: { date: "desc" },
    });

    return NextResponse.json(workouts);
  } catch (error) {
    console.error("Get workouts error:", error);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const data = workoutSchema.parse(body);

    const workout = await workoutDb.workout.create({
      data: {
        userId: session.user.id,
        title: data.title,
        type: data.type,
        date: parseDateToLocalNoon(data.date),
        durationMin: data.durationMin,
        distanceKm: data.distanceKm,
        distanceM: data.distanceM,
        tss: data.tss,
        notes: data.notes,
        descriptionMd: data.descriptionMd,
        prescriptionJson: data.prescriptionJson,
        planned: data.planned ?? true,
        completed: data.completed ?? false,
      },
    });

    return NextResponse.json(workout, { status: 201 });
  } catch (error) {
    console.error("Create workout error:", error);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
