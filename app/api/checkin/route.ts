import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { savePremiumCheckin } from "@/lib/actions/daily-checkin";

const checkinSchema = z.object({
  sleepQuality: z.number().min(0).max(100),
  fatigue: z.number().min(0).max(100),
  motivation: z.number().min(0).max(100),
  soreness: z.number().min(0).max(100),
  stress: z.number().min(0).max(100),
  notes: z.string().max(240).optional(),
  notesVisibility: z.enum(["FULL_AI_ACCESS", "METRICS_ONLY", "HIDDEN"]).optional(),
});

export async function POST(req: NextRequest) {
  try {
    const payload = await req.json();
    const validated = checkinSchema.parse(payload);
    const result = await savePremiumCheckin(validated);
    if (!result.success || !result.data) {
      return NextResponse.json(
        { error: result.error || "Failed to save check-in" },
        { status: 400 }
      );
    }
    return NextResponse.json(result.data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid payload", issues: error.issues },
        { status: 422 }
      );
    }
    return NextResponse.json({ error: "Failed to save check-in" }, { status: 500 });
  }
}
