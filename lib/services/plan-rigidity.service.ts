import { parseDateToLocalNoon } from "@/lib/utils";

export type PlanRigiditySetting =
  | "LOCKED_TODAY"
  | "LOCKED_1_DAY"
  | "LOCKED_2_DAYS"
  | "LOCKED_3_DAYS"
  | "FLEXIBLE_WEEK";

export function isWorkoutLocked(params: {
  workoutDate: Date;
  now?: Date;
  planRigidity: PlanRigiditySetting;
}): boolean {
  const now = params.now ? new Date(params.now) : new Date();
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);

  const workoutDay = new Date(params.workoutDate);
  workoutDay.setHours(0, 0, 0, 0);

  const days = getLockDays(params.planRigidity);
  if (params.planRigidity === "FLEXIBLE_WEEK") return false;

  const lockEndExclusive = new Date(today);
  lockEndExclusive.setDate(lockEndExclusive.getDate() + days + 1);

  return workoutDay >= today && workoutDay < lockEndExclusive;
}

export function parseLocalDateInputToLocalNoon(dateInput: string): Date {
  return parseDateToLocalNoon(dateInput);
}

function getLockDays(planRigidity: PlanRigiditySetting): number {
  switch (planRigidity) {
    case "LOCKED_TODAY":
      return 0;
    case "LOCKED_1_DAY":
      return 1;
    case "LOCKED_2_DAYS":
      return 2;
    case "LOCKED_3_DAYS":
      return 3;
    case "FLEXIBLE_WEEK":
      return 7;
  }
}
