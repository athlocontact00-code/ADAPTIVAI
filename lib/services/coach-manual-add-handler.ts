import type { PlanRigiditySetting } from "@/lib/services/plan-rigidity.service";

export type CoachManualWorkoutDraft = {
  date: Date;
  type: string;
  durationMin: number;
  intensity: string;
  title: string;
  tss: number;
  warmUpText?: string | null;
  mainSetText?: string | null;
  coolDownText?: string | null;
  extraTargets?: Array<{ label: string; value: string }> | null;
};

export type CoachCreatedWorkoutSummary = {
  id: string;
  date: Date;
  title: string;
  descriptionMd: string;
};

function startOfLocalDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export async function handleManualCoachWorkout(params: {
  draft: CoachManualWorkoutDraft;
  now: Date;
  planRigidity: PlanRigiditySetting;
  isProtected: (args: { workoutDate: Date; now: Date; planRigidity: PlanRigiditySetting }) => boolean;
  createWorkout: (options?: { planned?: boolean; source?: string }) => Promise<CoachCreatedWorkoutSummary>;
  createProposal: (created: CoachCreatedWorkoutSummary) => Promise<{ success: boolean; proposalId?: string | null }>;
  deleteWorkout: (workoutId: string) => Promise<void>;
}): Promise<{ text: string; confidence: number }> {
  const today0 = startOfLocalDay(params.now);
  if (params.draft.date < today0) {
    return {
      confidence: 90,
      text: `Nie dodaję treningów wstecz.

Podaj dzień od dziś w górę (np. 2026-02-05 albo "jutro").`,
    };
  }

  const isProtected = params.isProtected({
    workoutDate: params.draft.date,
    now: params.now,
    planRigidity: params.planRigidity,
  });

  if (isProtected) {
    const created = await params.createWorkout({ planned: false, source: "coach_proposal" });
    const dateLabel = params.draft.date.toLocaleDateString("en-GB", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    const proposal = await params.createProposal(created);

    if (!proposal.success || !proposal.proposalId) {
      await params.deleteWorkout(created.id);
      return {
        confidence: 80,
        text: "Nie mogę teraz utworzyć propozycji zmiany planu. Spróbuj ponownie.",
      };
    }

    return {
      confidence: 90,
      text: `Plan jest zablokowany na najbliższe dni, więc przygotowałem propozycję zmiany.

Otwórz Calendar → ten dzień → szczegóły treningu i zaakceptuj/odrzuć propozycję, żeby dodać go na stałe.

${created.descriptionMd}`,
    };
  }

  const created = await params.createWorkout();
  const dateLabel = created.date.toLocaleDateString("en-GB", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  return {
    confidence: 90,
    text: `✅ Added to Calendar (${dateLabel}): **${created.title}**

${created.descriptionMd}`,
  };
}
