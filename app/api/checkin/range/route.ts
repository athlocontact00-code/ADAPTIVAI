import { NextRequest, NextResponse } from "next/server";
import { getCheckinRange } from "@/lib/actions/daily-checkin";

const MIN_DAYS = 3;
const MAX_DAYS = 60;
const DEFAULT_DAYS = 14;

export async function GET(req: NextRequest) {
  const daysParam = req.nextUrl.searchParams.get("days");
  const parsed = Number.parseInt(daysParam ?? "", 10);
  const days = Number.isFinite(parsed)
    ? Math.min(Math.max(parsed, MIN_DAYS), MAX_DAYS)
    : DEFAULT_DAYS;

  const result = await getCheckinRange(days);
  if (!result.success) {
    return NextResponse.json({ error: result.error || "Failed to load check-ins" }, { status: 500 });
  }
  return NextResponse.json({ data: result.data ?? [] });
}
