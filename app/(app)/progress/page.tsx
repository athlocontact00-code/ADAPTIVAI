import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import {
  getPersonalBests,
  getInjuries,
  getReports,
  getTimelineData,
  getProgressSummary,
  getProgressTrends,
} from "@/lib/actions/progress";
import { getDeterministicProgressNarratives } from "@/lib/actions/progress-narratives";
import { ProgressClient } from "./progress-client";

export default async function ProgressPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const [pbs, injuries, weeklyReports, monthlyReports, timeline, summary, narratives, trends] = await Promise.all([
    getPersonalBests(),
    getInjuries(),
    getReports("WEEKLY"),
    getReports("MONTHLY"),
    getTimelineData(),
    getProgressSummary(),
    getDeterministicProgressNarratives(),
    getProgressTrends(),
  ]);

  return (
    <ProgressClient
      personalBests={pbs}
      injuries={injuries}
      weeklyReports={weeklyReports}
      monthlyReports={monthlyReports}
      timelineData={timeline}
      summary={summary}
      narratives={narratives}
      trends={trends}
    />
  );
}
