import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getCoachContext, getRecentPlanLogs, getCoachPageData } from "@/lib/actions/coach";
import { getPsychologyData } from "@/lib/actions/psychology";
import { getEntitlements } from "@/lib/billing/entitlements";
import { CoachClient } from "./coach-client";

export default async function CoachPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const [context, recentLogs, psychResult, pageData, entitlements] = await Promise.all([
    getCoachContext(),
    getRecentPlanLogs(),
    getPsychologyData(),
    getCoachPageData(),
    getEntitlements(session.user.id),
  ]);

  return (
    <CoachClient
      userId={session.user.id}
      context={context}
      recentLogs={recentLogs}
      psychologyData={psychResult.success ? psychResult.data : null}
      pageData={pageData}
      canUseAICoach={entitlements.canUseAICoach}
      trialEndsAt={entitlements.trialEndsAt}
    />
  );
}
