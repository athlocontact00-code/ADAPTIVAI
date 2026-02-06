import { NextResponse } from "next/server";
import { hash } from "bcryptjs";
import { z } from "zod";
import { db } from "@/lib/db";
import { getClientIp, rateLimit } from "@/lib/rate-limit";
import { createRequestId, logError, logInfo } from "@/lib/logger";

function parseTrialDays(): number {
  const raw = process.env.TRIAL_DAYS ?? process.env.BILLING_TRIAL_DAYS;
  if (!raw) return 14;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : 14;
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

const registerSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Invalid email"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export async function POST(req: Request) {
  const requestId = createRequestId();
  const ip = getClientIp(req);

  try {
    const rl = rateLimit({
      key: `register:${ip}`,
      limit: 10,
      windowMs: 10 * 60 * 1000,
    });
    if (!rl.allowed) {
      logInfo("auth.register.rate_limited", { requestId, route: "/api/auth/register", ip });
      return NextResponse.json(
        { error: "Too many requests" },
        {
          status: 429,
          headers: {
            "x-request-id": requestId,
            "retry-after": Math.max(1, Math.ceil((rl.resetAt - Date.now()) / 1000)).toString(),
          },
        }
      );
    }

    const body = await req.json();
    const { name, email, password } = registerSchema.parse(body);

    logInfo("auth.register.attempt", {
      requestId,
      route: "/api/auth/register",
      ip,
      emailDomain: email.includes("@") ? email.split("@")[1].toLowerCase() : null,
    });

    const existingUser = await db.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (existingUser) {
      logInfo("auth.register.email_in_use", { requestId, route: "/api/auth/register", ip });
      return NextResponse.json(
        { error: "Email already in use" },
        { status: 400, headers: { "x-request-id": requestId } }
      );
    }

    const passwordHash = await hash(password, 12);
    const now = new Date();
    const trialDays = parseTrialDays();
    const trialEndsAt = addDays(now, trialDays);

    const user = await db.user.create({
      data: {
        name,
        email: email.toLowerCase(),
        passwordHash,
        trialStartedAt: now,
        trialEndsAt,
      },
    });

    logInfo("auth.register.succeeded", { requestId, route: "/api/auth/register", userId: user.id });

    return NextResponse.json(
      { message: "User created successfully", userId: user.id },
      { status: 201, headers: { "x-request-id": requestId } }
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      logInfo("auth.register.validation_failed", {
        requestId,
        route: "/api/auth/register",
        ip,
        message: error.errors[0]?.message,
      });
      return NextResponse.json(
        { error: error.errors[0].message },
        { status: 400, headers: { "x-request-id": requestId } }
      );
    }

    logError("auth.register.failed", {
      requestId,
      route: "/api/auth/register",
      ip,
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500, headers: { "x-request-id": requestId } }
    );
  }
}
