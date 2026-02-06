import { db } from "@/lib/db";
import { parseDateToLocalNoon } from "@/lib/utils";
import type { SuggestionPayload } from "@/lib/schemas/coach-suggestion";
import { z } from "zod";

const PayloadKindSchema = z.object({ kind: z.string() });

export async function applySuggestionPayload(
  userId: string,
  payload: unknown
): Promise<{ ok: boolean; error?: string }> {
  const kindParsed = PayloadKindSchema.safeParse(payload);
  if (!kindParsed.success) return { ok: false, error: "Invalid payload" };

  const p = payload as SuggestionPayload & { kind: string };
  switch (p.kind) {
    case "adjustWorkout":
      return applyAdjustWorkout(userId, p);
    case "swapWorkouts":
      return applySwapWorkouts(userId, p);
    case "moveWorkout":
      return applyMoveWorkout(userId, p);
    case "addRecoveryDay":
      return applyAddRecoveryDay(userId, p);
    case "rebalanceWeek":
      return applyRebalanceWeek(userId, p);
    default:
      return { ok: false, error: `Unknown payload kind: ${(p as { kind?: string }).kind}` };
  }
}

async function applyAdjustWorkout(
  userId: string,
  p: { workoutId: string; intensityDeltaPct: number; volumeDeltaPct?: number; notes?: string }
): Promise<{ ok: boolean; error?: string }> {
  return db.$transaction(async (tx) => {
    const workout = await tx.workout.findFirst({
      where: { id: p.workoutId, userId },
    });
    if (!workout) return { ok: false, error: "Workout not found" };

    const annotation = `Adjusted by coach: ${p.intensityDeltaPct > 0 ? "+" : ""}${p.intensityDeltaPct}% intensity${
      p.volumeDeltaPct != null ? `, ${p.volumeDeltaPct > 0 ? "+" : ""}${p.volumeDeltaPct}% volume` : ""
    }. ${p.notes ?? ""}`.trim();

    let prescription = workout.prescriptionJson;
    if (prescription) {
      try {
        const parsed = JSON.parse(prescription) as Record<string, unknown>;
        const existingWhy = (parsed.why as string) ?? "";
        parsed.why = existingWhy + (existingWhy ? " " : "") + annotation;
        prescription = JSON.stringify(parsed);
      } catch {
        prescription = JSON.stringify({ why: annotation });
      }
    } else {
      prescription = JSON.stringify({ why: annotation });
    }

    await tx.workout.update({
      where: { id: workout.id },
      data: { prescriptionJson: prescription, notes: (workout.notes ?? "").trim() ? `${workout.notes}\n${annotation}` : annotation },
    });
    return { ok: true };
  });
}

async function applySwapWorkouts(
  userId: string,
  p: { fromWorkoutId: string; toDate: string; replacementWorkoutTemplate?: { type: string; durationMin: number; title?: string } }
): Promise<{ ok: boolean; error?: string }> {
  return db.$transaction(async (tx) => {
    const from = await tx.workout.findFirst({ where: { id: p.fromWorkoutId, userId } });
    if (!from) return { ok: false, error: "Source workout not found" };

    const toDate = parseDateToLocalNoon(p.toDate);
    await tx.workout.update({
      where: { id: from.id },
      data: { date: toDate },
    });
    return { ok: true };
  });
}

async function applyMoveWorkout(userId: string, p: { workoutId: string; toDate: string }): Promise<{ ok: boolean; error?: string }> {
  return db.$transaction(async (tx) => {
    const w = await tx.workout.findFirst({ where: { id: p.workoutId, userId } });
    if (!w) return { ok: false, error: "Workout not found" };
    await tx.workout.update({
      where: { id: w.id },
      data: { date: parseDateToLocalNoon(p.toDate) },
    });
    return { ok: true };
  });
}

async function applyAddRecoveryDay(
  userId: string,
  p: { date: string; replacement: "rest" | "walk" | "easy_spin"; durationMin?: number }
): Promise<{ ok: boolean; error?: string }> {
  return db.$transaction(async (tx) => {
    const date = parseDateToLocalNoon(p.date);
    const type = p.replacement === "rest" ? "rest" : p.replacement === "walk" ? "other" : "bike";
    const title =
      p.replacement === "rest"
        ? "Rest day"
        : p.replacement === "walk"
          ? "Easy walk"
          : "Easy spin";
    const durationMin = p.durationMin ?? (p.replacement === "rest" ? 0 : 30);

    const existing = await tx.workout.findFirst({
      where: {
        userId,
        date,
        planned: true,
      },
    });

    if (existing) {
      await tx.workout.update({
        where: { id: existing.id },
        data: {
          type,
          title,
          durationMin: durationMin,
          tss: 0,
          aiGenerated: true,
          aiReason: "Recovery day suggested by coach",
        },
      });
    } else {
      await tx.workout.create({
        data: {
          userId,
          title,
          type,
          date,
          durationMin,
          tss: 0,
          planned: true,
          completed: false,
          aiGenerated: true,
          aiReason: "Recovery day suggested by coach",
        },
      });
    }
    return { ok: true };
  });
}

async function applyRebalanceWeek(userId: string, p: { changes?: Array<{ workoutId: string; patch: Record<string, unknown> }> }): Promise<{ ok: boolean; error?: string }> {
  const changes = p.changes;
  if (!changes || changes.length === 0) return { ok: true };

  return db.$transaction(async (tx) => {
    for (const c of changes) {
      const w = await tx.workout.findFirst({ where: { id: c.workoutId, userId } });
      if (!w) continue;
      const patch = c.patch as Record<string, unknown>;
      const data: Record<string, unknown> = {};
      if (typeof patch.title === "string") data.title = patch.title;
      if (typeof patch.type === "string") data.type = patch.type;
      if (typeof patch.durationMin === "number") data.durationMin = patch.durationMin;
      if (typeof patch.tss === "number") data.tss = patch.tss;
      if (Object.keys(data).length > 0) {
        await tx.workout.update({ where: { id: w.id }, data });
      }
    }
    return { ok: true };
  });
}
