import { db } from "@/lib/db";
import { buildAIContextForUser } from "@/lib/services/ai-context.builder";
import { explainWhyAIKnowsThis } from "@/lib/services/memory-engine.service";
import { getEntitlements } from "@/lib/billing/entitlements";

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
        throw new Error(`Leak: raw notes at ${[...path, k].join(".")}`);
      }
      walk(child, [...path, k]);
    }
  }

  walk(value, []);
}

async function main() {
  const userId = process.env.HARDENING_USER_ID;
  if (!userId) {
    throw new Error("Missing HARDENING_USER_ID env var");
  }

  console.log("[hardening-checks] userId:", userId);

  // 1) AI context privacy
  const ctx = await buildAIContextForUser(userId);
  assertNoNotesKey(ctx);
  console.log("[hardening-checks] OK: buildAIContextForUser has no raw notes");

  // 2) Memory why payload privacy (if any memory exists)
  const mem = await db.aIMemory.findFirst({
    where: { userId, supersededBy: null },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });

  if (mem?.id) {
    const why = await explainWhyAIKnowsThis(userId, mem.id);
    if (why) {
      assertNoNotesKey(why);
      console.log("[hardening-checks] OK: explainWhyAIKnowsThis has no raw notes", mem.id);
    }
  } else {
    console.log("[hardening-checks] SKIP: no memories exist yet");
  }

  // 3) Entitlements sanity
  const ent = await getEntitlements(userId);
  console.log("[hardening-checks] entitlements:", {
    isPro: ent.isPro,
    plan: ent.plan,
    status: ent.status,
    renewAt: ent.renewAt?.toISOString() ?? null,
  });

  console.log("[hardening-checks] DONE");
}

main().catch((err) => {
  console.error("[hardening-checks] FAILED:", err);
  process.exit(1);
});
