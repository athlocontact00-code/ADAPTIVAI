import { NextResponse } from "next/server";
import { verifyCronSecretFromRequest } from "@/lib/internal/cron-auth";
import { db } from "@/lib/db";
import { buildAIContextForUser } from "@/lib/services/ai-context.builder";
import { assertAIContextNoRawDiaryNotes } from "@/lib/services/ai-context.builder";
import { explainWhyAIKnowsThis } from "@/lib/services/memory-engine.service";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  userId: z.string().min(1),
});

function assertNoNotesKey(value: unknown): void {
  function walk(v: unknown, path: string[]): void {
    if (v == null) return;
    if (Array.isArray(v)) {
      v.forEach((x, i) => walk(x, [...path, String(i)]));
      return;
    }
    if (typeof v !== "object") return;

    const obj = v as Record<string, unknown>;
    for (const [k, child] of Object.entries(obj)) {
      if (k === "notes" && typeof child === "string" && child.trim().length > 0) {
        throw new Error(`Privacy leak: raw notes at ${[...path, k].join(".")}`);
      }
      walk(child, [...path, k]);
    }
  }

  walk(value, []);
}

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

  const report: Record<string, unknown> = {
    userId,
    checks: [],
    ok: true,
    timestamp: new Date().toISOString(),
  };

  try {
    const ctx = await buildAIContextForUser(userId);
    assertAIContextNoRawDiaryNotes(ctx);
    assertNoNotesKey(ctx);
    (report.checks as unknown[]).push({ name: "ai_context_no_raw_notes", ok: true });
  } catch (err) {
    report.ok = false;
    (report.checks as unknown[]).push({
      name: "ai_context_no_raw_notes",
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    });
  }

  try {
    const memory = await db.aIMemory.findFirst({
      where: { userId, supersededBy: null },
      orderBy: { createdAt: "desc" },
      select: { id: true },
    });

    if (memory?.id) {
      const why = await explainWhyAIKnowsThis(userId, memory.id);
      if (why) {
        assertNoNotesKey(why);
        (report.checks as unknown[]).push({ name: "memory_why_payload_no_raw_notes", ok: true, memoryId: memory.id });
      } else {
        (report.checks as unknown[]).push({ name: "memory_why_payload_no_raw_notes", ok: true, skipped: true });
      }
    } else {
      (report.checks as unknown[]).push({ name: "memory_why_payload_no_raw_notes", ok: true, skipped: true });
    }
  } catch (err) {
    report.ok = false;
    (report.checks as unknown[]).push({
      name: "memory_why_payload_no_raw_notes",
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    });
  }

  return NextResponse.json(report, { headers: { "Cache-Control": "no-store" } });
}
