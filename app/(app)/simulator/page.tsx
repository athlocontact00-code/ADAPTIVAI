import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getEntitlements } from "@/lib/billing/entitlements";
import { getScenarios, getBaselineForSimulator } from "@/lib/actions/simulator";
import { SimulatorClient } from "./simulator-client";
import { PaywallCard } from "@/components/paywall-card";

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

  if (!entitlements.canUseSimulator) {
    return (
      <div className="space-y-6 p-6">
        <h1 className="text-2xl font-bold">Simulator</h1>
        <PaywallCard
          title="Pro feature"
          message="Upgrade to Pro to use the What-If Simulator and advanced reports."
        />
      </div>
    );
  }

  return (
    <SimulatorClient
      scenarios={scenarios}
      baseline={baseline}
    />
  );
}
