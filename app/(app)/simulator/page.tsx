import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getEntitlements } from "@/lib/billing/entitlements";
import { getScenarios, getBaselineForSimulator } from "@/lib/actions/simulator";
import { SimulatorClient } from "./simulator-client";

export default async function SimulatorPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const [scenarios, baseline, entitlements] = await Promise.all([
    getScenarios(),
    getBaselineForSimulator(),
    getEntitlements(session.user.id),
  ]);

  return (
    <SimulatorClient
      scenarios={scenarios}
      baseline={baseline}
    />
  );
}
