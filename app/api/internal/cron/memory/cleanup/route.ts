import { NextResponse } from "next/server";
import { verifyCronSecretFromRequest } from "@/lib/internal/cron-auth";
import { cleanupExpiredMemories } from "@/lib/services/memory-engine.service";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  userId: z.string().min(1),
});

export async function POST(req: Request) {
  const auth = verifyCronSecretFromRequest(req);
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Invalid body" }, { status: 400 });
  }
  const { userId } = parsed.data;

  const deletedCount = await cleanupExpiredMemories(userId);
  return NextResponse.json(
    { ok: true, userId, deletedCount },
    { headers: { "Cache-Control": "no-store" } }
  );
}
