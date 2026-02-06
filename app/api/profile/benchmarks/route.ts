import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";

const payloadSchema = z
  .object({
    swimCssSecPer100: z.number().int().min(20).max(600).nullable().optional(),
    swim400TimeSec: z.number().int().min(60).max(7200).nullable().optional(),
    swim100TimeSec: z.number().int().min(20).max(3600).nullable().optional(),
    swim200TimeSec: z.number().int().min(40).max(1800).nullable().optional(),
    swim1500TimeSec: z.number().int().min(900).max(7200).nullable().optional(),

    run5kTimeSec: z.number().int().min(600).max(36000).nullable().optional(),
    run10kTimeSec: z.number().int().min(900).max(72000).nullable().optional(),
    runThresholdSecPerKm: z.number().int().min(120).max(1200).nullable().optional(),
    runHmTimeSec: z.number().int().min(3600).max(14400).nullable().optional(),
    runMarathonTimeSec: z.number().int().min(7200).max(32400).nullable().optional(),

    bikeFtpWatts: z.number().int().min(50).max(600).nullable().optional(),
    bikeBest20minWatts: z.number().int().min(50).max(600).nullable().optional(),
  })
  .strict();

const benchDb = db as unknown as {
  performanceBenchmarks: {
    findUnique: (args: { where: { userId: string } }) => Promise<null | Record<string, unknown>>;
    upsert: (args: {
      where: { userId: string };
      create: Record<string, unknown>;
      update: Record<string, unknown>;
    }) => Promise<unknown>;
  };
  profile: {
    findUnique: (args: { where: { userId: string }; select: { ftp: true } }) => Promise<null | { ftp: number | null }>;
    upsert: (args: { where: { userId: string }; create: { userId: string; ftp: number | null }; update: { ftp: number | null } }) => Promise<unknown>;
  };
};

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;

    const [row, profile] = await Promise.all([
      benchDb.performanceBenchmarks.findUnique({ where: { userId } }),
      benchDb.profile.findUnique({ where: { userId }, select: { ftp: true } }),
    ]);

    return NextResponse.json({
      benchmarks: {
        swimCssSecPer100: row?.swimCssSecPer100 ?? null,
        swim400TimeSec: row?.swim400TimeSec ?? null,
        swim100TimeSec: row?.swim100TimeSec ?? null,
        swim200TimeSec: row?.swim200TimeSec ?? null,
        swim1500TimeSec: row?.swim1500TimeSec ?? null,
        run5kTimeSec: row?.run5kTimeSec ?? null,
        run10kTimeSec: row?.run10kTimeSec ?? null,
        runThresholdSecPerKm: row?.runThresholdSecPerKm ?? null,
        runHmTimeSec: row?.runHmTimeSec ?? null,
        runMarathonTimeSec: row?.runMarathonTimeSec ?? null,
        bikeFtpWatts: profile?.ftp ?? null,
        bikeBest20minWatts: row?.bikeBest20minWatts ?? null,
        updatedAt: row?.updatedAt ?? null,
      },
    });
  } catch (error) {
    console.error("Get benchmarks error:", error);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;
    const body = await req.json();
    const data = payloadSchema.parse(body);

    await Promise.all([
      benchDb.performanceBenchmarks.upsert({
        where: { userId },
        create: {
          userId,
          swimCssSecPer100: data.swimCssSecPer100 ?? null,
          swim400TimeSec: data.swim400TimeSec ?? null,
          swim100TimeSec: data.swim100TimeSec ?? null,
          swim200TimeSec: data.swim200TimeSec ?? null,
          swim1500TimeSec: data.swim1500TimeSec ?? null,
          run5kTimeSec: data.run5kTimeSec ?? null,
          run10kTimeSec: data.run10kTimeSec ?? null,
          runThresholdSecPerKm: data.runThresholdSecPerKm ?? null,
          runHmTimeSec: data.runHmTimeSec ?? null,
          runMarathonTimeSec: data.runMarathonTimeSec ?? null,
          bikeBest20minWatts: data.bikeBest20minWatts ?? null,
        },
        update: {
          swimCssSecPer100: data.swimCssSecPer100 ?? null,
          swim400TimeSec: data.swim400TimeSec ?? null,
          swim100TimeSec: data.swim100TimeSec ?? null,
          swim200TimeSec: data.swim200TimeSec ?? null,
          swim1500TimeSec: data.swim1500TimeSec ?? null,
          run5kTimeSec: data.run5kTimeSec ?? null,
          run10kTimeSec: data.run10kTimeSec ?? null,
          runThresholdSecPerKm: data.runThresholdSecPerKm ?? null,
          runHmTimeSec: data.runHmTimeSec ?? null,
          runMarathonTimeSec: data.runMarathonTimeSec ?? null,
          bikeBest20minWatts: data.bikeBest20minWatts ?? null,
        },
      }),
      data.bikeFtpWatts !== undefined
        ? benchDb.profile.upsert({
            where: { userId },
            create: { userId, ftp: data.bikeFtpWatts ?? null },
            update: { ftp: data.bikeFtpWatts ?? null },
          })
        : Promise.resolve(),
    ]);

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      const issues = error.issues.map((i) => ({
        path: i.path,
        message: i.message,
      }));
      const first = issues[0];
      const msg = first
        ? `${first.path.join(".")}: ${first.message}. Use mm:ss for times (e.g. 1:45), mm:ss/km for pace.`
        : "Invalid benchmark values";
      return NextResponse.json({ error: msg, issues }, { status: 400 });
    }
    const msg = error instanceof Error ? error.message : "Failed to update benchmarks";
    console.error("Update benchmarks error:", error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

