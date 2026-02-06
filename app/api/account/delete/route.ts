import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  confirm: z.string(),
});

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Invalid body" }, { status: 400 });
  }
  const { confirm } = parsed.data;

  if (confirm !== "DELETE") {
    return NextResponse.json({ ok: false, error: "Missing confirmation" }, { status: 400 });
  }

  await db.user.delete({ where: { id: userId } });

  return NextResponse.json(
    { ok: true, deletedAt: new Date().toISOString() },
    { headers: { "Cache-Control": "no-store" } }
  );
}
