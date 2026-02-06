import { NextResponse } from "next/server";
import { getTodayPremiumCheckin } from "@/lib/actions/daily-checkin";

export async function GET() {
  const result = await getTodayPremiumCheckin();
  if (!result.success) {
    return NextResponse.json({ error: result.error || "Failed to load check-in" }, { status: 500 });
  }
  return NextResponse.json({ status: result.status, data: result.data ?? null });
}
