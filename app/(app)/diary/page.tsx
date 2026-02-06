import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { DiaryClient } from "./diary-client";

function parseMonthParam(month?: string): Date {
  // Expected format: YYYY-MM
  if (month && /^\d{4}-\d{2}$/.test(month)) {
    const [y, m] = month.split("-").map((n) => parseInt(n, 10));
    const d = new Date(y, m - 1, 1);
    d.setHours(0, 0, 0, 0);
    return d;
  }
  const now = new Date();
  const d = new Date(now.getFullYear(), now.getMonth(), 1);
  d.setHours(0, 0, 0, 0);
  return d;
}

export default async function DiaryPage({
  searchParams,
}: {
  searchParams?: Promise<{ month?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const resolvedSearchParams = searchParams ? await searchParams : undefined;

  const monthStart = parseMonthParam(resolvedSearchParams?.month);
  const monthEndExclusive = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 1);
  monthEndExclusive.setHours(0, 0, 0, 0);

  const [entries, workouts] = await Promise.all([
    db.diaryEntry.findMany({
      where: {
        userId: session.user.id,
        date: { gte: monthStart, lt: monthEndExclusive },
      },
      include: { workout: true },
      orderBy: { date: "desc" },
    }),
    db.workout.findMany({
      where: {
        userId: session.user.id,
        date: { gte: monthStart, lt: monthEndExclusive },
      },
      orderBy: { date: "desc" },
    }),
  ]);

  return (
    <DiaryClient
      initialEntries={entries}
      workouts={workouts}
      monthStart={monthStart}
    />
  );
}
