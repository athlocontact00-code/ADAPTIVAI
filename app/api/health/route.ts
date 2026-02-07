import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { logError } from "@/lib/logger";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    // Check DB connectivity
    await db.$queryRaw`SELECT 1 as ok`;
    
    // Get today's date
    const today = new Date();
    today.setHours(12, 0, 0, 0);

    // Try to get authenticated user's readiness
    let readinessData = null;
    const session = await auth();
    
    if (session?.user?.id) {
      const metric = await db.metricDaily.findFirst({
        where: {
          userId: session.user.id,
          date: today,
        },
        select: {
          readinessScore: true,
          readinessStatus: true,
          fatigueType: true,
          weeklyLoad: true,
          rampRate: true,
          rampStatus: true,
        },
      });
      
      if (metric) {
        readinessData = {
          score: metric.readinessScore,
          status: metric.readinessStatus,
          fatigueType: metric.fatigueType,
          weeklyLoad: metric.weeklyLoad,
          rampRate: metric.rampRate,
          rampStatus: metric.rampStatus,
        };
      }
    }

    const res = NextResponse.json({
      status: "healthy",
      timestamp: new Date().toISOString(),
      database: "connected",
      authenticated: !!session?.user?.id,
      todayReadiness: readinessData,
    });
    res.headers.set("Cache-Control", "no-store, no-cache, must-revalidate");
    return res;
  } catch (error) {
    logError("health.check.failed", {}, error instanceof Error ? error : undefined);
    const res = NextResponse.json(
      {
        status: "unhealthy",
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
    res.headers.set("Cache-Control", "no-store, no-cache, must-revalidate");
    return res;
  }
}
