import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { logError } from "@/lib/logger";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function getBuildEnv(): "production" | "preview" | "development" {
  const v = process.env.VERCEL_ENV ?? process.env.NODE_ENV;
  if (v === "production") return "production";
  if (v === "preview") return "preview";
  return "development";
}

export async function GET() {
  const time = new Date().toISOString();
  const build = {
    commit: process.env.VERCEL_GIT_COMMIT_SHA ?? undefined,
    env: getBuildEnv(),
  };

  let dbOk = false;
  let dbLatencyMs: number | undefined;
  try {
    const start = Date.now();
    await db.$queryRaw`SELECT 1 as ok`;
    dbOk = true;
    dbLatencyMs = Date.now() - start;
  } catch (error) {
    logError("health.db_failed", {}, error instanceof Error ? error : undefined);
  }

  let stripeOk = false;
  let stripeMode: "live" | "test" = "test";
  try {
    const key = process.env.STRIPE_SECRET_KEY;
    if (key && key.length > 10) {
      stripeOk = true;
      stripeMode = key.startsWith("sk_live_") ? "live" : "test";
    }
  } catch {
    // no stripe
  }

  const ok = dbOk;
  const maskUrl = (url: string | undefined): string => {
    if (!url) return "—";
    try {
      const u = new URL(url);
      return u.hostname || u.origin;
    } catch {
      return "—";
    }
  };
  const body = {
    ok,
    build,
    db: { ok: dbOk, latencyMs: dbLatencyMs },
    stripe: { ok: stripeOk, mode: stripeMode },
    time,
    urls: {
      nextAuthUrl: maskUrl(process.env.NEXTAUTH_URL),
      appUrl: maskUrl(process.env.APP_URL),
    },
  };

  const res = NextResponse.json(body, {
    status: ok ? 200 : 503,
    headers: { "Cache-Control": "no-store, no-cache, must-revalidate" },
  });
  return res;
}
