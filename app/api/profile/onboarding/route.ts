import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";

const onboardingSchema = z.object({
  sportPrimary: z.string().optional(),
  experienceLevel: z.string().optional(),
  weeklyHoursGoal: z.string().optional(),
  restingHR: z.string().optional(),
  maxHR: z.string().optional(),
  goal: z.enum(["race", "general_fitness", "build_base"]).optional(),
  availability: z
    .object({
      daysAvailable: z.array(z.number().min(0).max(6)).optional(),
      maxMinutesPerDay: z.union([z.number().min(15).max(480), z.null()]).optional(),
      preferredTime: z.enum(["morning", "evening", "any"]).optional(),
    })
    .optional(),
  complete: z.boolean().optional(),
  dismiss: z.boolean().optional(),
});

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const data = onboardingSchema.parse(body);

    if (data.dismiss) {
      await db.user.update({
        where: { id: session.user.id },
        data: { onboardingDismissedAt: new Date() },
      });
      return NextResponse.json({ success: true, dismissed: true });
    }

    const profileData: {
      sportPrimary?: string | null;
      experienceLevel?: string | null;
      weeklyHoursGoal?: number | null;
      restingHR?: number | null;
      maxHR?: number | null;
    } = {
      sportPrimary: data.sportPrimary ?? undefined,
      experienceLevel: data.experienceLevel ?? undefined,
      weeklyHoursGoal: data.weeklyHoursGoal ? parseFloat(data.weeklyHoursGoal) : undefined,
      restingHR: data.restingHR ? parseInt(data.restingHR, 10) : undefined,
      maxHR: data.maxHR ? parseInt(data.maxHR, 10) : undefined,
    };

    const existing = await db.profile.findUnique({
      where: { userId: session.user.id },
      select: { preferences: true, availability: true },
    });

    const currentPrefs = (existing?.preferences as Record<string, unknown>) ?? {};
    const currentAvail = (existing?.availability as Record<string, unknown>) ?? {};
    const newPrefs = data.goal ? { ...currentPrefs, primaryGoal: data.goal } : currentPrefs;
    const newAvail = data.availability
      ? {
          ...currentAvail,
          ...(data.availability.daysAvailable != null && { daysAvailable: data.availability.daysAvailable }),
          ...(data.availability.maxMinutesPerDay !== undefined && {
            maxMinutesPerDay: data.availability.maxMinutesPerDay,
          }),
          ...(data.availability.preferredTime != null && { preferredTime: data.availability.preferredTime }),
        }
      : currentAvail;

    await db.profile.upsert({
      where: { userId: session.user.id },
      create: {
        userId: session.user.id,
        ...profileData,
        preferences: Object.keys(newPrefs).length > 0 ? (newPrefs as Prisma.InputJsonValue) : undefined,
        availability: Object.keys(newAvail).length > 0 ? (newAvail as Prisma.InputJsonValue) : undefined,
      },
      update: {
        ...profileData,
        ...(Object.keys(newPrefs).length > 0 && { preferences: newPrefs as Prisma.InputJsonValue }),
        ...(Object.keys(newAvail).length > 0 && { availability: newAvail as Prisma.InputJsonValue }),
      },
    });

    if (data.complete) {
      await db.user.update({
        where: { id: session.user.id },
        data: { onboardingDone: true },
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Onboarding error:", error);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
